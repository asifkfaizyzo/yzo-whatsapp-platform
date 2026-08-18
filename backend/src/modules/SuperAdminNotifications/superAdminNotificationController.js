// backend/src/modules/superAdminNotifications/superAdminNotificationController.js

import * as notificationService from "./superAdminNotificationService.js";

// ── Get all notifications ──
export const getNotifications = async (req, res) => {
  try {
    const notifications = await notificationService.getNotifications();
    const unreadCount   = await notificationService.getUnreadCount();

    return res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ── Mark one as read ──
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    await notificationService.markAsRead(id);
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ── Mark all as read ──
export const markAllAsRead = async (req, res) => {
  try {
    await notificationService.markAllAsRead();
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ── Clear all ──
export const clearAll = async (req, res) => {
  try {
    await notificationService.clearAllNotifications();
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



// ── 🆕 Get paginated notifications ──
export const getPaginatedNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, filter = "all", type = "all" } = req.query;

    const data = await notificationService.getPaginatedNotifications({
      page,
      limit,
      filter,
      type,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ── 🆕 Delete a single notification ──
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    await notificationService.deleteNotification(id);
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};