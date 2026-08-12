// backend/src/modules/superAdminNotifications/superAdminNotificationService.js

import prisma from "../../config/prisma.js";

// ── Get all superadmin notifications ──
export const getNotifications = async () => {
  return await prisma.superAdminNotification.findMany({
    orderBy: { createdAt: "desc" },
    take: 50, // last 50 only
  });
};

// ── Get unread count ──
export const getUnreadCount = async () => {
  return await prisma.superAdminNotification.count({
    where: { isRead: false },
  });
};

// ── Create a new notification ──
export const createSuperAdminNotification = async ({ type, title, message, metadata }) => {
  return await prisma.superAdminNotification.create({
    data: {
      type,
      title,
      message,
      metadata: metadata || {},
      isRead: false,
    },
  });
};

// ── Mark one as read ──
export const markAsRead = async (id) => {
  return await prisma.superAdminNotification.update({
    where: { id },
    data: { isRead: true },
  });
};

// ── Mark all as read ──
export const markAllAsRead = async () => {
  return await prisma.superAdminNotification.updateMany({
    where: { isRead: false },
    data: { isRead: true },
  });
};

// ── Clear all notifications ──
export const clearAllNotifications = async () => {
  return await prisma.superAdminNotification.deleteMany({});
};