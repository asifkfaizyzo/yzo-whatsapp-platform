// backend/src/modules/notifications/notificationController.js

import * as notificationService from "./notificationService.js";

// ── Get notifications ──
export const getNotifications = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const userId   = req.userId || req.user?.id || null;
    const userType = req.userType; // "TENANT" or "USER"

    console.log("📋 getNotifications:", { tenantId, userId, userType });

    const notifications = await notificationService.getNotifications(
      tenantId,
      userId,
      userType
    );

    const unreadCount = await notificationService.getUnreadCount(
      tenantId,
      userId,
      userType
    );

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
    const tenantId = req.tenantId;
    const userId   = req.userId || req.user?.id || null;
    const userType = req.userType;

    await notificationService.markAllAsRead(tenantId, userId, userType);

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
    const tenantId = req.tenantId;
    const userId   = req.userId || req.user?.id || null;
    const userType = req.userType;

    await notificationService.clearAllNotifications(tenantId, userId, userType);

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
    const tenantId = req.tenantId;
    const userId = req.userId || req.user?.id || null;
    const userType = req.userType;

    const { page = 1, limit = 20, filter = "all", type = "all" } = req.query;

    const data = await notificationService.getPaginatedNotifications(
      tenantId,
      userId,
      userType,
      { page, limit, filter, type }
    );

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
    const tenantId = req.tenantId;
    const userId = req.userId || req.user?.id || null;
    const userType = req.userType;

    await notificationService.deleteNotification(id, tenantId, userId, userType);

    return res.status(200).json({ success: true });
  } catch (error) {
    const status = error.message === "Unauthorized" ? 403 :
                   error.message === "Notification not found" ? 404 : 500;
    return res.status(status).json({
      success: false,
      message: error.message,
    });
  }
};