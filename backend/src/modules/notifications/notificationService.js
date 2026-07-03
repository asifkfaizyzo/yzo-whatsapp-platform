// backend/src/modules/notifications/notificationService.js


import prisma from '../../config/prisma.js';

// ── Create notification ──
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
export const getNotifications = async (tenantId, userId) => {
  const notifications = await prisma.notification.findMany({
    where: {
      tenantId,
      OR: [
        { userId: null },       // for all tenant users
        { userId: userId },     // for specific user
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return notifications;
};

// ── Get unread count ──
export const getUnreadCount = async (tenantId, userId) => {
  const count = await prisma.notification.count({
    where: {
      tenantId,
      isRead: false,
      OR: [
        { userId: null },
        { userId: userId },
      ],
    },
  });
  return count;
};

// ── Mark as read ──
export const markAsRead = async (notificationId) => {
  return await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
};

// ── Mark all as read ──
export const markAllAsRead = async (tenantId, userId) => {
  return await prisma.notification.updateMany({
    where: {
      tenantId,
      isRead: false,
      OR: [
        { userId: null },
        { userId: userId },
      ],
    },
    data: { isRead: true },
  });
};

// ── Delete all ──
export const clearAllNotifications = async (tenantId, userId) => {
  return await prisma.notification.deleteMany({
    where: {
      tenantId,
      OR: [
        { userId: null },
        { userId: userId },
      ],
    },
  });
};