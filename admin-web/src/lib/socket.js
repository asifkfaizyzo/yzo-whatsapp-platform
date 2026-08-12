//Admin-Web Notification System
// admin-web/src/lib/socket.js
import { io } from "socket.io-client";

const socketUrl = import.meta.env.VITE_API_URL;

export const socket = io(socketUrl, {
  withCredentials: true,
  transports: ["websocket"],
  autoConnect: false,
});