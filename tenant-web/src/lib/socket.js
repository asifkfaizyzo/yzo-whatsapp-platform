// src/lib/socket.js
import { io } from "socket.io-client";

const socketUrl = import.meta.env.VITE_BACKEND_URL;

export const socket = io(socketUrl, {
  withCredentials: true,
  transports: ["websocket"],
  autoConnect: false, // we manually connect in Inbox
});