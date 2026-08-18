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


// ── 🆕 Get paginated notifications with filters ──
export const getPaginatedNotifications = async ({
  page = 1,
  limit = 20,
  filter = "all",   // all | unread | read
  type = "all",     // all | tenant_payment | tenant_registered | etc.
}) => {
  // Build where clause based on filters
  const where = {};

  if (filter === "unread") {
    where.isRead = false;
  } else if (filter === "read") {
    where.isRead = true;
  }

  if (type && type !== "all") {
    where.type = type;
  }

  // Parse pagination values
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.max(1, Math.min(100, parseInt(limit))); // cap at 100
  const skip = (pageNum - 1) * limitNum;

  // Run queries in parallel for performance
  const [notifications, total, unreadCount] = await Promise.all([
    prisma.superAdminNotification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limitNum,
    }),
    prisma.superAdminNotification.count({ where }),
    prisma.superAdminNotification.count({ where: { isRead: false } }),
  ]);

  const totalPages = Math.ceil(total / limitNum) || 1;

  return {
    notifications,
    total,
    totalPages,
    currentPage: pageNum,
    unreadCount,
  };
};

// ── 🆕 Delete a single notification ──
export const deleteNotification = async (id) => {
  return await prisma.superAdminNotification.delete({
    where: { id },
  });
};