// tenant-web/src/lib/socket.js
import { io } from "socket.io-client";
import { useAuthStore } from "../store/useAuthStore";

const socketUrl = import.meta.env.VITE_BACKEND_URL;

// ═══════════════════════════════════════════════════════════
// Helper: Get auth token from Zustand store (in-memory)
// ═══════════════════════════════════════════════════════════
const getAuthToken = () => {
  const token = useAuthStore.getState().accessToken;
  return token;
};

// ── For Inbox (manual connect) ──
export const socket = io(socketUrl, {
  auth: (cb) => {
    cb({ token: getAuthToken() });
  },
  withCredentials: true,
  transports: ["websocket"],
  autoConnect: false,
});

// ── For TopNavBar (stable persistent connection) ──
let _persistentSocket = null;

// lib/socket.js

export const getSocket = () => {
  // ✅ Guard: no token = no socket
  const token = useAuthStore.getState().accessToken;
  if (!token) {
    console.log("⏳ getSocket() called with no token — returning null");
    return null;
  }

  if (!_persistentSocket) {
    _persistentSocket = io(socketUrl, {
      auth: (cb) => {
        cb({ token: useAuthStore.getState().accessToken });
      },
      withCredentials: true,
      transports: ["websocket"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    _persistentSocket.on("connect", () => {
      console.log("✅ Persistent socket connected:", _persistentSocket.id);
    });

    _persistentSocket.on("connect_error", (err) => {
      console.error("❌ Socket error:", err.message);
    });

    _persistentSocket.on("disconnect", (reason) => {
      console.log("🔌 Socket disconnected:", reason);
    });
  }

  return _persistentSocket;
};

export const disconnectSocket = () => {
  if (_persistentSocket) {
    _persistentSocket.disconnect();
    _persistentSocket = null;
  }
};