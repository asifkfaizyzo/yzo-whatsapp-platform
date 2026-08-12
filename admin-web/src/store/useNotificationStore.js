// admin-web/src/store/useNotificationStore.js
import { create } from "zustand";
import {
  getAdminNotifications,
  markAdminNotifAsRead,
  markAllAdminNotifsAsRead,
  clearAllAdminNotifs,
} from "../services/notification.service";

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  // ── Fetch from API ──
  fetchNotifications: async () => {
    set({ isLoading: true });
    const res = await getAdminNotifications();
    if (res.success) {
      set({
        notifications: res.data.notifications || [],
        unreadCount: res.data.unreadCount || 0,
        isLoading: false,
      });
    } else {
      set({ isLoading: false });
    }
  },

  // ── Add incoming real-time notification (from socket) ──
  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 20),
      unreadCount: state.unreadCount + 1,
    }));
  },

  // ── Mark one as read ──
  markAsRead: async (id) => {
    const res = await markAdminNotifAsRead(id);
    if (res.success) {
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, isRead: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    }
  },

  // ── Mark all as read ──
  markAllAsRead: async () => {
    const res = await markAllAdminNotifsAsRead();
    if (res.success) {
      set((state) => ({
        notifications: state.notifications.map((n) => ({
          ...n,
          isRead: true,
        })),
        unreadCount: 0,
      }));
    }
  },

  // ── Clear all ──
  clearAll: async () => {
    const res = await clearAllAdminNotifs();
    if (res.success) {
      set({ notifications: [], unreadCount: 0 });
    }
  },
}));