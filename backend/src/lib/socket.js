// backend/src/lib/socket.js
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

let io = null;

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

  // 1. Handshake Authentication Middleware
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication token required for WebSocket connection'));
      }

      const decoded = jwt.verify(token, process.env.ACCESS_SECRET);
      socket.user = decoded;
      socket.tenantId = decoded.type === 'TENANT' ? decoded.id : decoded.tenantId;

      next();
    } catch (err) {
      console.warn(`⚠️ Socket connection authentication rejected: ${err.message}`);
      return next(new Error('Unauthorized socket connection'));
    }
  });

  // 2. Verified Connection & Room Management
  io.on('connection', (socket) => {
    console.log(`🔌 Authenticated Socket connected: ${socket.id} (Tenant: ${socket.tenantId}, User: ${socket.user?.id}, Type: ${socket.user?.type})`);

    // ── Tenant room ──
    socket.on('join_tenant', (tenantId) => {
      if (tenantId) {
        socket.join(tenantId);
        console.log(`👤 Socket ${socket.id} joined tenant room: ${tenantId}`);
      }
    });

    // ── SuperAdmin room ── NEW
    socket.on('join_superadmin', () => {
      socket.join('superadmin_room');
      console.log(`👑 Socket ${socket.id} joined superadmin room`);
    });

        // ✅ ADD THIS - User room
    socket.on('join_user', (userId) => {
      if (userId) {
        socket.join(`user_${userId}`);
        console.log(`👤 User ${userId} joined room`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

// ✅ ADD THIS - emitToUser function
export const emitToUser = (userId, event, data) => {
  if (!io) return;
  io.to(`user_${userId}`).emit(event, data);
  console.log(`📤 USER EVENT: ${event} → user_${userId}`);
};

// ── Emit to tenant room ── (existing, no change)
export const emitToTenant = (tenantId, event, data) => {
  if (!io) {
    console.log("❌ Socket.io not initialized");
    return;
  }

  const room = io.sockets.adapter.rooms.get(tenantId);
  console.log("🏠 ROOM:", tenantId);
  console.log("👥 CLIENTS IN ROOM:", room ? [...room] : []);

  io.to(tenantId).emit(event, data);

  console.log("📤 EVENT EMITTED:", event);
  console.log("📦 PAYLOAD:", data);
};

// ── Emit to superadmin room ── NEW
export const emitToSuperAdmin = (event, data) => {
  if (!io) {
    console.log("❌ Socket.io not initialized");
    return;
  }

  const room = io.sockets.adapter.rooms.get('superadmin_room');
  console.log("👑 SUPERADMIN ROOM CLIENTS:", room ? [...room] : []);

  io.to('superadmin_room').emit(event, data);

  console.log("📤 SUPERADMIN EVENT EMITTED:", event);
  console.log("📦 PAYLOAD:", data);
};


