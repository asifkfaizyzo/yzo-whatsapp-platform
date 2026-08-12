// admin-web/src/services/notification.service.js
import api from "../lib/axios";

const BASE_URL = "/super-admin/notifications";

// ── Get all superadmin notifications ──
export const getAdminNotifications = async () => {
  try {
    const res = await api.get(BASE_URL);
    return {
      success: true,
      data: res.data.data, // { notifications: [], unreadCount: 0 }
    };
  } catch (error) {
    return {
      success: false,
      message:
        error.response?.data?.message || "Failed to fetch notifications",
    };
  }
};

// ── Mark one as read ──
export const markAdminNotifAsRead = async (id) => {
  try {
    await api.patch(`${BASE_URL}/${id}/read`);
    return { success: true };
  } catch (error) {
    return { success: false };
  }
};

// ── Mark all as read ──
export const markAllAdminNotifsAsRead = async () => {
  try {
    await api.patch(`${BASE_URL}/read-all`);
    return { success: true };
  } catch (error) {
    return { success: false };
  }
};

// ── Clear all ──
export const clearAllAdminNotifs = async () => {
  try {
    await api.delete(`${BASE_URL}/clear-all`);
    return { success: true };
  } catch (error) {
    return { success: false };
  }
};