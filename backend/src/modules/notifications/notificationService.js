// backend/src/modules/notifications/notificationService.js

import prisma from '../../config/prisma.js';

// ── Create notification ── ✅ ADDED BACK
export const createNotification = async ({
  tenantId,
  userId,
  type,
  title,
  message,
  metadata,
}) => {
  const notification = await prisma.notification.create({
    data: {
      tenantId,
      userId:   userId || null,
      type,
      title,
      message,
      metadata: metadata || {},
      isRead:   false,
    },
  });
  return notification;
};

// ── Get notifications ──
export const getNotifications = async (tenantId, userId, userType) => {

  let where = { tenantId };

  if (userType === "TENANT") {
    // ✅ TENANT sees:
    // → Tenant-wide notifications (userId: null)
    // → NOT user-specific notifications
    where = {
      tenantId,
      userId: null,
    };
  } else if (userType === "USER") {
    // ✅ USER sees:
    // → Only their own notifications (userId: their id)
    // → NOT tenant-wide notifications
    where = {
      tenantId,
      userId: userId,
    };
  }

  return await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 20,
  });
};

// ── Get unread count ──
export const getUnreadCount = async (tenantId, userId, userType) => {

  let where = { tenantId, isRead: false };

  if (userType === "TENANT") {
    where = {
      tenantId,
      isRead: false,
      userId: null,
    };
  } else if (userType === "USER") {
    where = {
      tenantId,
      isRead: false,
      userId: userId,
    };
  }

  return await prisma.notification.count({ where });
};

// ── Mark as read ──
export const markAsRead = async (notificationId) => {
  return await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
};

// ── Mark all as read ──
export const markAllAsRead = async (tenantId, userId, userType) => {
  let where = { tenantId, isRead: false };

  if (userType === "TENANT") {
    where = { tenantId, isRead: false, userId: null };
  } else if (userType === "USER") {
    where = { tenantId, isRead: false, userId: userId };
  }

  return await prisma.notification.updateMany({
    where,
    data: { isRead: true },
  });
};

// ── Clear all ──
export const clearAllNotifications = async (tenantId, userId, userType) => {
  let where = { tenantId };

  if (userType === "TENANT") {
    where = { tenantId, userId: null };
  } else if (userType === "USER") {
    where = { tenantId, userId: userId };
  }

  return await prisma.notification.deleteMany({ where });
};