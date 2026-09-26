import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (
  API_URL.startsWith("http") ? new URL(API_URL).origin : window.location.origin
);

let socket;
let socketToken;

export function getRealtimeSocket() {
  const token = localStorage.getItem("booking_token");
  if (!token) return null;

  if (!socket || socketToken !== token) {
    socket?.disconnect();
    socketToken = token;
    socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["polling", "websocket"],
      upgrade: true,
      timeout: 20000,
      reconnection: true
    });
  }

  return socket;
}

export function disconnectRealtime() {
  socket?.disconnect();
  socket = undefined;
  socketToken = undefined;
}
