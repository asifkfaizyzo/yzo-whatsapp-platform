// backend/src/lib/socket.js
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

let io = null;

// ═══════════════════════════════════════════════════════════
// ONLINE USER TRACKING (in-memory)
// Map<tenantId, Set<userId>>
// ═══════════════════════════════════════════════════════════
const onlineUsers = new Map();

const addOnlineUser = (tenantId, userId) => {
  if (!tenantId || !userId) return;
  if (!onlineUsers.has(tenantId)) {
    onlineUsers.set(tenantId, new Set());
  }
  onlineUsers.get(tenantId).add(userId);
  console.log(`🟢 User online: ${userId} (tenant ${tenantId})`);
  console.log(`   Currently online in this tenant: ${onlineUsers.get(tenantId).size}`);
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
      console.log(`\n🔐 Socket auth attempt...`);
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        console.warn(`⚠️ NO TOKEN provided`);
        return next(new Error('Authentication token required for WebSocket connection'));
      }

      console.log(`🔐 Token exists, verifying...`);
      const decoded = jwt.verify(token, process.env.ACCESS_SECRET);
      
      socket.user = decoded;
      socket.tenantId = decoded.type === 'TENANT' ? decoded.id : decoded.tenantId;
      socket.userId = decoded.id;
      socket.userType = decoded.type;

      console.log(`✅ Auth SUCCESS - Type: ${socket.userType}, User: ${socket.userId}, Tenant: ${socket.tenantId}`);
      next();
    } catch (err) {
      console.warn(`⚠️ Socket connection authentication rejected: ${err.message}`);
      return next(new Error('Unauthorized socket connection'));
    }
  });

  // 2. Connection Handler
  io.on('connection', async (socket) => {
    console.log(`\n🔌🔌🔌 SOCKET CONNECTED! 🔌🔌🔌`);
    console.log(`   Socket ID: ${socket.id}`);
    console.log(`   Tenant ID: ${socket.tenantId}`);
    console.log(`   User ID: ${socket.userId}`);
    console.log(`   User Type: ${socket.userType}`);

    // ── Track online agents (USER type only, not TENANT admins) ──
    if (socket.userType === 'USER' && socket.tenantId && socket.userId) {
  console.log(`✅ Conditions met - marking user online...`);
  addOnlineUser(socket.tenantId, socket.userId);

  // 🕐 Wait 2 seconds for frontend to set up listeners
  setTimeout(async () => {
    try {
      console.log(`🔄 Importing queueService...`);
      const { processQueuedConversations } = await import('../modules/contacts/queueService.js');
      console.log(`✅ Import successful, processing queue...`);
      await processQueuedConversations(socket.tenantId);
    } catch (err) {
      console.error('❌ Failed to process queue on user connect:', err);
    }
  }, 2000); // 2 second delay
} else {
      console.log(`⛔ Conditions NOT met for queue processing:`);
      console.log(`   userType === 'USER': ${socket.userType === 'USER'}`);
      console.log(`   tenantId exists: ${!!socket.tenantId}`);
      console.log(`   userId exists: ${!!socket.userId}`);
    }

    // ── Room joining ──
    socket.on('join_tenant', (tenantId) => {
      // Verify socket owner actually belongs to the requested tenantId
      if (tenantId && socket.tenantId === tenantId) {
        socket.join(tenantId);
        console.log(`👤 Socket ${socket.id} joined tenant room: ${tenantId}`);
      } else {
        console.warn(`⚠️ Unauthorized attempt by user ${socket.userId} to join tenant room ${tenantId}`);
      }
    });

    socket.on('join_superadmin', () => {
      // Only allow SUPERADMIN user types to join superadmin_room
      if (socket.userType === 'SUPERADMIN') {
        socket.join('superadmin_room');
        console.log(`👑 Socket ${socket.id} joined superadmin room`);
      } else {
        console.warn(`⚠️ Unauthorized attempt by ${socket.userId} (${socket.userType}) to join superadmin_room`);
      }
    });

    socket.on('join_user', (userId) => {
      if (userId) {
        socket.join(`user_${userId}`);
        console.log(`👤 User ${userId} joined room`);
      }
    });

    // ── Disconnect ──
    socket.on('disconnect', () => {
      console.log(`\n🔌 Socket disconnected: ${socket.id}`);
      if (socket.userType === 'USER' && socket.tenantId && socket.userId) {
        removeOnlineUser(socket.tenantId, socket.userId);
      }
    });
  });

  return io;
};

// ═══════════════════════════════════════════════════════════
// EMIT FUNCTIONS
// ═══════════════════════════════════════════════════════════
export const emitToUser = (userId, event, data) => {
  if (!io) return;
  io.to(`user_${userId}`).emit(event, data);
  console.log(`📤 USER EVENT: ${event} → user_${userId}`);
};

export const emitToTenant = (tenantId, event, data) => {
  if (!io) {
    console.log("❌ Socket.io not initialized");
    return;
  }

  const room = io.sockets.adapter.rooms.get(tenantId);
  console.log("🏠 ROOM:", tenantId);
  console.log("👥 CLIENTS IN ROOM:", room ? [...room] : []);

  io.to(tenantId).emit(event, data);
  console.log("📤 TENANT EVENT EMITTED:", event);
};

export const emitToSuperAdmin = (event, data) => {
  if (!io) {
    console.log("❌ Socket.io not initialized");
    return;
  }

  io.to('superadmin_room').emit(event, data);
  console.log("📤 SUPERADMIN EVENT EMITTED:", event);
};