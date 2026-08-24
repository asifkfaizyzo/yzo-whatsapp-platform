//Admin-Web Notification System
// admin-web/src/lib/socket.js
import { io } from "socket.io-client";
import { useAdminAuthStore } from "../store/useAdminAuthStore";

const socketUrl = import.meta.env.VITE_API_URL;

// export const socket = io(socketUrl, {
//   withCredentials: true,
//   transports: ["websocket"],
//   autoConnect: false,
// });


let _adminSocket = null;
let _currentToken = null;

export const getAdminSocket = () => {
  const token = useAdminAuthStore.getState().accessToken;

  if (!token) {
    console.log("⏳ getAdminSocket() — no token, returning null");
    return null;
  }

  // If token changes, reset socket connection
  if (_adminSocket && _currentToken !== token) {
    console.log("🔄 Admin token changed — resetting admin socket");
    _adminSocket.removeAllListeners();
    _adminSocket.disconnect();
    _adminSocket = null;
    _currentToken = null;
  }

  if (!_adminSocket) {
    console.log("🔌 Creating new persistent admin socket...");

    _adminSocket = io(socketUrl, {
      auth: (cb) => {
        cb({ token: useAdminAuthStore.getState().accessToken });
      },
      withCredentials: true,
      transports: ["websocket"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    _currentToken = token;

    _adminSocket.on("connect", () => {
      console.log("✅ Admin socket connected:", _adminSocket.id);
    });

    _adminSocket.on("connect_error", (err) => {
      console.error("❌ Admin socket error:", err.message);
    });

    _adminSocket.on("disconnect", (reason) => {
      console.log("🔌 Admin socket disconnected:", reason);
    });
  }

  return _adminSocket;
};

export const disconnectAdminSocket = () => {
  if (_adminSocket) {
    console.log("🔌 Disconnecting admin socket...");
    _adminSocket.removeAllListeners();
    _adminSocket.disconnect();
    _adminSocket = null;
    _currentToken = null;
  }
};