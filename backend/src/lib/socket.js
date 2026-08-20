
// backend/src/lib/socket.js
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

let io = null;

// ── Online User Tracking (in-memory) ──
const onlineUsers = new Map();

const addOnlineUser = (tenantId, userId) => {
  if (!tenantId || !userId) return;
  if (!onlineUsers.has(tenantId)) {
    onlineUsers.set(tenantId, new Set());
  }
  onlineUsers.get(tenantId).add(userId);
  console.log(`🟢 User online: ${userId} (tenant ${tenantId})`);
};

const removeOnlineUser = (tenantId, userId) => {
  if (!tenantId || !userId) return;
  const set = onlineUsers.get(tenantId);
  if (set) {
    set.delete(userId);
    if (set.size === 0) onlineUsers.delete(tenantId);
  }
  console.log(`🔴 User offline: ${userId} (tenant ${tenantId})`);
};

export const isUserOnline = (tenantId, userId) => {
  return onlineUsers.get(tenantId)?.has(userId) || false;
};

export const getOnlineUsers = (tenantId) => {
  return Array.from(onlineUsers.get(tenantId) || []);
};

// ── Conversation Presence & Live Typing ──
const conversationViewers = new Map();
const conversationTyping = new Map();

// ═══════════════════════════════════════════════════════════
// SOCKET INITIALIZATION
// ═══════════════════════════════════════════════════════════
export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URLS
        ? process.env.FRONTEND_URLS.split(",")
        : "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // 1. Handshake Authentication
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication token required for WebSocket connection'));
      }

      const decoded = jwt.verify(token, process.env.ACCESS_SECRET);
      
      socket.user = decoded;
      socket.tenantId = decoded.type === 'TENANT' ? decoded.id : decoded.tenantId;
      socket.userId = decoded.id;
      socket.userType = decoded.type;

      next();
    } catch (err) {
      console.warn(`⚠️ Socket auth rejected: ${err.message}`);
      return next(new Error('Unauthorized socket connection'));
    }
  });

  // 2. Connection Handler
  io.on('connection', async (socket) => {
    console.log(`🔌 Socket connected: ${socket.id} (${socket.userType} - ${socket.userId})`);

    // Track online agents
    if (socket.userType === 'USER' && socket.tenantId && socket.userId) {
      addOnlineUser(socket.tenantId, socket.userId);

      setTimeout(async () => {
        try {
          const { processQueuedConversations } = await import('../modules/contacts/queueService.js');
          await processQueuedConversations(socket.tenantId);
        } catch (err) {
          console.error('❌ Failed to process queue on user connect:', err);
        }
      }, 2000);
    }

    // Room joining
    socket.on('join_tenant', (tenantId) => {
      if (tenantId && socket.tenantId === tenantId) {
        socket.join(tenantId);
        console.log(`👤 Socket ${socket.id} joined tenant room: ${tenantId}`);
      }
    });

    socket.on('join_superadmin', () => {
      if (socket.userType === 'SUPERADMIN') {
        socket.join('superadmin_room');
        console.log(`👑 Socket ${socket.id} joined superadmin room`);
      }
    });

    socket.on('join_user', (userId) => {
      if (userId && (socket.userId === userId || socket.userType === 'TENANT')) {
        socket.join(`user_${userId}`);
        console.log(`👤 User ${userId} joined room`);
      }
    });

    // ── Conversation Presence & Live Typing ──
    const getUserInfo = () => ({
      userId: socket.userId,
      name: socket.user?.name || socket.user?.email?.split('@')[0] || (socket.userType === 'TENANT' ? 'Admin' : 'Agent'),
      email: socket.user?.email || '',
      type: socket.userType
    });

    const broadcastViewers = (conversationId) => {
      const socketMap = conversationViewers.get(conversationId);
      const viewersList = [];
      const seenUsers = new Set();
      if (socketMap) {
        for (const info of socketMap.values()) {
          if (!seenUsers.has(info.userId)) {
            seenUsers.add(info.userId);
            viewersList.push(info);
          }
        }
      }
      io.to(`conversation_${conversationId}`).emit('conversation_viewers_updated', {
        conversationId,
        viewers: viewersList
      });
    };

    const broadcastTyping = (conversationId) => {
      const userMap = conversationTyping.get(conversationId);
      const typingList = [];
      if (userMap) {
        for (const [uId, entry] of userMap.entries()) {
          typingList.push({ userId: uId, name: entry.name });
        }
      }
      io.to(`conversation_${conversationId}`).emit('agent_typing_updated', {
        conversationId,
        typingAgents: typingList
      });
    };

    socket.on('join_conversation', (data) => {
      const conversationId = typeof data === 'object' ? data?.conversationId : data;
      if (!conversationId) return;

      socket.join(`conversation_${conversationId}`);
      socket.activeConversationId = conversationId;

      if (!conversationViewers.has(conversationId)) {
        conversationViewers.set(conversationId, new Map());
      }
      conversationViewers.get(conversationId).set(socket.id, getUserInfo());
      broadcastViewers(conversationId);
    });

    socket.on('leave_conversation', (data) => {
      const conversationId = typeof data === 'object' ? data?.conversationId : data;
      if (!conversationId) return;

      socket.leave(`conversation_${conversationId}`);

      if (conversationViewers.has(conversationId)) {
        conversationViewers.get(conversationId).delete(socket.id);
        if (conversationViewers.get(conversationId).size === 0) {
          conversationViewers.delete(conversationId);
        }
      }

      if (conversationTyping.has(conversationId) && conversationTyping.get(conversationId).has(socket.userId)) {
        const entry = conversationTyping.get(conversationId).get(socket.userId);
        if (entry?.timerId) clearTimeout(entry.timerId);
        conversationTyping.get(conversationId).delete(socket.userId);
        if (conversationTyping.get(conversationId).size === 0) {
          conversationTyping.delete(conversationId);
        }
        broadcastTyping(conversationId);
      }

      socket.activeConversationId = null;
      broadcastViewers(conversationId);
    });

    socket.on('agent_typing_start', (data) => {
      const conversationId = typeof data === 'object' ? data?.conversationId : data;
      if (!conversationId) return;

      const userInfo = getUserInfo();

      if (!conversationTyping.has(conversationId)) {
        conversationTyping.set(conversationId, new Map());
      }

      const userMap = conversationTyping.get(conversationId);
      const existingEntry = userMap.get(socket.userId);
      if (existingEntry?.timerId) clearTimeout(existingEntry.timerId);

      const timerId = setTimeout(() => {
        if (conversationTyping.has(conversationId)) {
          conversationTyping.get(conversationId).delete(socket.userId);
          if (conversationTyping.get(conversationId).size === 0) {
            conversationTyping.delete(conversationId);
          }
          broadcastTyping(conversationId);
        }
      }, 4000);

      userMap.set(socket.userId, { name: userInfo.name, timerId });
      broadcastTyping(conversationId);
    });

    socket.on('agent_typing_stop', (data) => {
      const conversationId = typeof data === 'object' ? data?.conversationId : data;
      if (!conversationId) return;

      if (conversationTyping.has(conversationId)) {
        const userMap = conversationTyping.get(conversationId);
        const existingEntry = userMap.get(socket.userId);
        if (existingEntry?.timerId) clearTimeout(existingEntry.timerId);
        userMap.delete(socket.userId);
        if (userMap.size === 0) {
          conversationTyping.delete(conversationId);
        }
        broadcastTyping(conversationId);
      }
    });

    // ── Disconnect ──
    socket.on('disconnect', () => {
      if (socket.userType === 'USER' && socket.tenantId && socket.userId) {
        removeOnlineUser(socket.tenantId, socket.userId);
      }

      for (const [convId, socketMap] of conversationViewers.entries()) {
        if (socketMap.has(socket.id)) {
          socketMap.delete(socket.id);
          if (socketMap.size === 0) {
            conversationViewers.delete(convId);
          }
          broadcastViewers(convId);
        }
      }

      if (socket.userId) {
        for (const [convId, userMap] of conversationTyping.entries()) {
          if (userMap.has(socket.userId)) {
            const entry = userMap.get(socket.userId);
            if (entry?.timerId) clearTimeout(entry.timerId);
            userMap.delete(socket.userId);
            if (userMap.size === 0) {
              conversationTyping.delete(convId);
            }
            broadcastTyping(convId);
          }
        }
      }
    });
  });

  return io;
};

// ═══════════════════════════════════════════════════════════
// EMIT FUNCTIONS
// ═══════════════════════════════════════════════════════════
export const getIO = () => io;

export const emitToUser = (userId, event, data) => {
  if (!io) return;
  io.to(`user_${userId}`).emit(event, data);
  console.log(`📤 USER EVENT: ${event} → user_${userId}`);
};

export const emitToTenant = (tenantId, event, data) => {
  if (!io) return;
  io.to(tenantId).emit(event, data);
  console.log(`📤 TENANT EVENT: ${event} → ${tenantId}`);
};

export const emitToSuperAdmin = (event, data) => {
  if (!io) return;
  io.to('superadmin_room').emit(event, data);
  console.log(`📤 SUPERADMIN EVENT: ${event}`);
};