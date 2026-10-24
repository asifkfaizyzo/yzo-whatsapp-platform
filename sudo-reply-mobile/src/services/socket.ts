import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config/api';
import { useAuthStore } from '../stores/authStore';

class SocketService {
  private socket: Socket | null = null;

  connect() {
    if (this.socket?.connected) return;

    const token = useAuthStore.getState().accessToken;
    if (!token) return;

    this.socket = io(API_BASE_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket?.id);
      this.joinRooms();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.log('[Socket] Connection error:', err.message);
    });
  }

  private joinRooms() {
    const { user } = useAuthStore.getState();
    if (!user || !this.socket) return;

    if (user.tenantId) {
      this.socket.emit('join_tenant', { tenantId: user.tenantId });
    }
    this.socket.emit('join_user', { userId: user.id });
  }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event: string, callback: (...args: any[]) => void) {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void) {
    this.socket?.off(event, callback);
  }

  emit(event: string, data?: any) {
    this.socket?.emit(event, data);
  }

  joinConversation(conversationId: string) {
    this.socket?.emit('join_conversation', { conversationId });
  }

  leaveConversation(conversationId: string) {
    this.socket?.emit('leave_conversation', { conversationId });
  }

  typingStart(conversationId: string) {
    this.socket?.emit('agent_typing_start', { conversationId });
  }

  typingStop(conversationId: string) {
    this.socket?.emit('agent_typing_stop', { conversationId });
  }

  get isConnected() {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();