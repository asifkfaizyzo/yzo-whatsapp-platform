// tenant-web/src/services/notification.service.js

import api from "../lib/axios";

const BASE_URL = "/notifications";

// Get all notifications
export const getNotifications = async () => {
  try {
    const res = await api.get(BASE_URL);
    return {
      success: true,
      data: res.data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to fetch notifications",
    };
  }
};

// Mark one as read
export const markAsRead = async (id) => {
  try {
    await api.patch(`${BASE_URL}/${id}/read`);
    return { success: true };
  } catch (error) {
    return { success: false };
  }
};

// Mark all as read
export const markAllAsRead = async () => {
  try {
    await api.patch(`${BASE_URL}/read-all`);
    return { success: true };
  } catch (error) {
    return { success: false };
  }
};

// Clear all
export const clearAll = async () => {
  try {
    await api.delete(`${BASE_URL}/clear-all`);
    return { success: true };
  } catch (error) {
    return { success: false };
  }
};



// 🆕 Get paginated notifications (for full page)
export const getPaginatedNotifications = async ({
  page = 1,
  limit = 20,
  filter = "all",
  type = "all",
} = {}) => {
  try {
    const res = await api.get(`${BASE_URL}/paginated`, {
      params: { page, limit, filter, type },
    });
    return {
      success: true,
      data: res.data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to fetch notifications",
    };
  }
};

// 🆕 Delete a single notification
export const deleteNotification = async (id) => {
  try {
    await api.delete(`${BASE_URL}/${id}`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to delete",
    };
  }
};