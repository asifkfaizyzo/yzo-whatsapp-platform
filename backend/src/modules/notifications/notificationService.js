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


// ── 🆕 Get paginated notifications with filters ──
export const getPaginatedNotifications = async (
  tenantId,
  userId,
  userType,
  { page = 1, limit = 20, filter = "all", type = "all" }
) => {
  // Base where clause: apply role-based filtering (same as getNotifications)
  let where = { tenantId };

  if (userType === "TENANT") {
    where = { tenantId, userId: null };
  } else if (userType === "USER") {
    where = { tenantId, userId: userId };
  }

  // Apply read/unread filter
  if (filter === "unread") {
    where.isRead = false;
  } else if (filter === "read") {
    where.isRead = true;
  }

  // Apply type filter
  if (type && type !== "all") {
    where.type = type;
  }

  // Parse pagination
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;

  // Unread count uses same role filter but ignores read/type filters
  let unreadWhere = { tenantId, isRead: false };
  if (userType === "TENANT") {
    unreadWhere.userId = null;
  } else if (userType === "USER") {
    unreadWhere.userId = userId;
  }

  // Run queries in parallel
  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limitNum,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: unreadWhere }),
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

// ── 🆕 Delete a single notification (with role validation) ──
export const deleteNotification = async (id, tenantId, userId, userType) => {
  // First find the notification to verify ownership
  const notif = await prisma.notification.findUnique({
    where: { id },
  });

  if (!notif) {
    throw new Error("Notification not found");
  }

  // Verify tenant match
  if (notif.tenantId !== tenantId) {
    throw new Error("Unauthorized");
  }

  // TENANT can only delete tenant-wide (userId: null)
  if (userType === "TENANT" && notif.userId !== null) {
    throw new Error("Unauthorized");
  }

  // USER can only delete their own
  if (userType === "USER" && notif.userId !== userId) {
    throw new Error("Unauthorized");
  }

  return await prisma.notification.delete({
    where: { id },
  });
};