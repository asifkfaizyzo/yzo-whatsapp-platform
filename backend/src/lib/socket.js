// backend/src/lib/socket.js
import { Server } from 'socket.io';

let io = null;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URLS ? process.env.FRONTEND_URLS.split(",") : "*",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Join room based on tenant ID to isolate socket traffic per tenant
    socket.on('join_tenant', (tenantId) => {
      if (tenantId) {
        socket.join(tenantId);
        console.log(`👤 Socket ${socket.id} joined tenant room: ${tenantId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const emitToTenant = (tenantId, event, data) => {
  if (io) {
    io.to(tenantId).emit(event, data);
  }
};