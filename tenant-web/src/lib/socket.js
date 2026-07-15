// tenant-web/src/lib/socket.js
import { io } from "socket.io-client";

const socketUrl = import.meta.env.VITE_BACKEND_URL;

// ── For Inbox (manual connect) ──
export const socket = io(socketUrl, {
  withCredentials: true,
  transports: ["websocket"],
  autoConnect: false, // manually connect in Inbox ✅ kept as is
});

// ── For TopNavBar (stable persistent connection) ──
let _persistentSocket = null;

export const getSocket = () => {
  if (!_persistentSocket) {
    _persistentSocket = io(socketUrl, {
      withCredentials: true,
      transports: ["websocket"],
      autoConnect: true,        // auto connects immediately
      reconnection: true,       // auto reconnects if dropped
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
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