import bcrypt from "bcrypt";
import pkg from "@prisma/client";
import prisma from "../../config/prisma.js";
import { logActivity } from "../activity/activityService.js";
import { emitToTenant } from "../../lib/socket.js";
import { createNotification } from "../notifications/notificationService.js";
import { generateSignedUrl } from "../../lib/utils/signedUrl.js";
import { createAuditLog } from "../audit/auditLogService.js";

//AUTO / MANUAL: Get or create conversation
export const getOrCreateConversation = async (contactId, tenantId) => {
  // 1️⃣ Check if conversation exists
  let conversation = await prisma.conversation.findUnique({
    where: { contactId },
  });

  // 2️⃣ If exists → return it
  if (conversation) {
    return conversation;
  }

    // ✅ New conversation created
  // conversation = await prisma.conversation.create({
  //   data: {
  //     contactId,
  //     tenantId,
  //     status: 'OPEN',
  //     unreadCount: 0,   // ← Starts at 0
  //   },
  // });

  // 3️⃣ If not → create new conversation
  conversation = await prisma.conversation.create({
    data: {
      contactId,
      tenantId,
      status: "OPEN",
    },
  });

  return conversation;
};

//GET conversation by contactId
export const getConversationByContact = async (contactId, tenantId) => {
  // 1️⃣ Find conversation
  const conversation = await prisma.conversation.findFirst({
    where: {
      contactId,
      tenantId,
    },
    include: {
      contact: true,
      messages: {
        orderBy: {
          createdAt: "asc", // oldest → newest (chat order)
        },
      },
    },
  });

  if (!conversation) {
    return null;
  }

  return conversation;
};

// Get assigned conversations for a user
export const getAssignedConversations = async ({
  userId,
  tenantId,
  page,
  limit,
  status,
  assignmentType,
}) => {
  try {
    console.log("🔥 SERVICE called with:", {
      userId,
      tenantId,
      status,
      assignmentType,
    });

    const skip = (page - 1) * limit;
    const whereClause = {
      tenantId: tenantId,
    };
    whereClause.isArchived = false;

    console.log("🔥 whereClause:", JSON.stringify(whereClause));

    if (status === "CLOSED") {
      whereClause.status = { in: ["CLOSED", "RESOLVED"] };
    } else if (status === "OPEN") {
      whereClause.status = "OPEN";
    }

    const assignType = assignmentType || (userId ? "my" : "all");
    if (assignType === "my" && userId) {
      whereClause.contact = { assignedTo: userId };
    } else if (assignType === "assigned") {
      whereClause.contact = { assignedTo: { not: null } };
    } else if (assignType === "unassigned") {
      whereClause.contact = { assignedTo: null };
    }

    console.log("🔥 Final whereClause:", JSON.stringify(whereClause));
    console.log("🔥 About to query conversations...");

    // ── MAIN QUERY ──
    const conversations = await prisma.conversation.findMany({
      where: whereClause,
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            assignedTo: true,
            email: true,
            company: true,
            isBlocked: true,
            contactTags: {
              include: {
                tag: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            text: true,
            createdAt: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    });

    // ✅ ADD THIS - Get counts for tabs
const allCount = await prisma.conversation.count({
  where: {
    tenantId,
    isArchived: false,
  },
});

const unreadCount = await prisma.conversation.count({
  where: {
    tenantId,
    isArchived: false,
    unreadCount: { gt: 0 },   // ← Has unread messages
  },
});

const openCount = await prisma.conversation.count({
  where: {
    tenantId,
    isArchived: false,
    status: 'OPEN',
  },
});

const closedCount = await prisma.conversation.count({
  where: {
    tenantId,
    isArchived: false,
    status: { in: ['CLOSED', 'RESOLVED'] },
  },
});

    console.log("🔥 Conversations found:", conversations.length);

    const total = await prisma.conversation.count({
      where: whereClause,
    });

    return {
      conversations,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
       counts: {              // ✅ ADD - for tab badges
    all:    allCount,
    unread: unreadCount,
    open:   openCount,
    closed: closedCount,
  },
    };
  } catch (error) {
    console.error("❌ SERVICE ERROR message:", error.message);
    console.error("❌ SERVICE ERROR stack:", error.stack);
    throw error;
  }
};

//Get messages for a conversation (pagination + infinite scroll)
export const getMessages = async (params) => {
  const { conversationId, limit = 30, before } = params;

  // Step 1: Check if conversation exists
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  const tenantId = conversation.tenantId; // ✅ NEW - needed for signing

  // Step 2: Build filter
  const where = {
    conversationId,
  };

  if (before) {
    const beforeMessage = await prisma.message.findUnique({
      where: { id: before },
    });

    if (beforeMessage) {
      where.createdAt = {
        lt: beforeMessage.createdAt,
      };
    }
  }

  // Step 3: Fetch messages
  const messages = await prisma.message.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
    take: limit + 1,
  });

  // Step 4: Check pagination
  const hasMore = messages.length > limit;
  const actualMessages = hasMore ? messages.slice(0, limit) : messages;

  // Step 5: Convert to chat order (old → new)
  const orderedMessages = actualMessages.reverse();

  // Step 6: Format output
  const formattedMessages = orderedMessages.map((msg) => {
    // ✅ NEW: Generate signed URL if media exists
    let signedMediaUrl = null;

    // ✅ REPLACE WITH THIS:

    if (!msg.isDeleted && msg.mediaUrl) {
      let relativePath = msg.mediaUrl;

      // 1. Handle full URLs (old format)
      if (relativePath.startsWith("http")) {
        try {
          const url = new URL(relativePath);
          relativePath = url.pathname.substring(1);
        } catch (err) {
          console.error("❌ Invalid mediaUrl format:", relativePath);
          relativePath = null;
        }
      }

      // 2. Clean up "undefined/" prefix from corrupted records
      if (relativePath && relativePath.includes("undefined/")) {
        relativePath = relativePath.replace("undefined/", "");
      }

      // 3. Remove leading slash
      if (relativePath && relativePath.startsWith("/")) {
        relativePath = relativePath.substring(1);
      }

      // 4. Only sign valid paths starting with 'uploads/'
      if (relativePath && relativePath.startsWith("uploads/")) {
        signedMediaUrl = generateSignedUrl(relativePath, tenantId);
      } else {
        console.warn("⚠️ Skipping invalid mediaUrl:", msg.mediaUrl);
        signedMediaUrl = null;
      }
    }

    return {
      id: msg.id,
      senderId: msg.senderId,
      isFromCustomer: msg.senderType === "CONTACT",
      type: msg.type || "TEXT",
      direction: msg.direction || null,
      senderType: msg.senderType || null,
      isRead: msg.isRead,
      status: msg.status || "sent",
      createdAt: msg.createdAt,

      // ✅ Deleted messages → null
      text: msg.isDeleted ? null : msg.text,
      mediaUrl: msg.isDeleted ? null : signedMediaUrl, // ✅ signed URL
      mediaName: msg.isDeleted ? null : msg.mediaName || null,
      mediaSize: msg.isDeleted ? null : msg.mediaSize || null,
      mediaMimeType: msg.isDeleted ? null : msg.mediaMimeType || null,
      caption: msg.isDeleted ? null : msg.caption || null,

      // ⭐  Interactive Buttons
      buttons: msg.isDeleted ? null : msg.buttons || null,

      isDeleted: msg.isDeleted,
      deletedAt: msg.deletedAt,

    };
  });

  return {
    messages: formattedMessages,
    hasMore,
  };
};

// Update conversation status (resolve/close/reopen)
export const updateConversationStatus = async ({
  conversationId,
  tenantId,
  status,
  agentId,
  userType,
}) => {
  // 1. Validate status
  const validStatuses = ["OPEN", "RESOLVED", "CLOSED"];
  if (!validStatuses.includes(status)) {
    throw new Error("Invalid conversation status");
  }

  // 2. Fetch conversation and check tenant boundary
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, tenantId },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // 3. Setup status timestamps
  const updateData = { status };
  if (status === "RESOLVED") {
    updateData.resolvedAt = new Date();
  } else if (status === "CLOSED") {
    updateData.closedAt = new Date();
  } else if (status === "OPEN") {
    const notification = await createNotification({
      tenantId,
      userId: null, // notify all
      type: "conversation_reopened",
      title: "Conversation Reopened",
      message: `A conversation has been reopened`,
      metadata: {
        conversationId,
      },
    });

    emitToTenant(tenantId, "new_notification", { notification });

    updateData.resolvedAt = null;
    updateData.closedAt = null;
    updateData.reopenedAt = new Date();
  }

  // 4. Update record
  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: updateData,
  });

  // 5. Log system activity
  const action =
    status.toLowerCase() === "open"
      ? "opened"
      : status.toLowerCase() === "resolved"
        ? "resolved"
        : "closed";
  await logActivity({
    conversationId,
    action,
    performedBy: agentId || null,
    performedByType: userType === "TENANT" ? "tenant" : "agent",
  });

  return updated;
};

// ── Archive Conversation ──────────────────────────────────
export const archiveConversation = async ({
  conversationId,
  tenantId,
  requesterId,
  requesterRole,
}) => {
  // Find conversation
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      tenantId: tenantId,
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  if (conversation.isArchived) {
    throw new Error("Conversation already archived");
  }

  // Archive it
  const archived = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      isArchived: true,
      archivedAt: new Date(),
      archivedBy: requesterId,
      archivedByRole: requesterRole,
    },
  });

  // Log activity
  await logActivity({
    conversationId,
    action: "archived",
    performedBy: requesterId,
    performedByType: requesterRole === "TENANT" ? "tenant" : "agent",
  });

  return archived;
};

// ── Unarchive Conversation ────────────────────────────────
export const unarchiveConversation = async ({
  conversationId,
  tenantId,
  requesterId,
  requesterRole,
}) => {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      tenantId: tenantId,
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  if (!conversation.isArchived) {
    throw new Error("Conversation is not archived");
  }

  const unarchived = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      isArchived: false,
      archivedAt: null,
      archivedBy: null,
      archivedByRole: null,
    },
  });

  await logActivity({
    conversationId,
    action: "unarchived",
    performedBy: requesterId,
    performedByType: requesterRole === "TENANT" ? "tenant" : "agent",
  });

  return unarchived;
};

// ── Delete Conversation (TENANT only) ────────────────────
export const deleteConversation = async ({
  conversationId,
  tenantId,
  requesterId,
  requesterRole,
}) => {
  // Only TENANT can delete
  if (requesterRole !== "TENANT") {
    throw new Error("Unauthorized: Only tenant can delete conversations");
  }

  // Find conversation
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      tenantId: tenantId, // tenant boundary check
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // Hard delete — Prisma cascade will delete messages too
  // (onDelete: Cascade is set on Message model)
  await prisma.conversation.delete({
    where: { id: conversationId },
  });

  console.log("🗑️ Conversation hard deleted:", conversationId);

  return { deleted: true, conversationId };
};

// ── Get Archived Conversations ────────────────────────────
export const getArchivedConversations = async ({
  tenantId,
  userId,
  page,
  limit,
}) => {
  const skip = (page - 1) * limit;

  const whereClause = {
    tenantId: tenantId,
    isArchived: true, // ← only archived
  };

  // If USER → only their assigned contacts
  if (userId) {
    whereClause.contact = {
      assignedTo: userId,
    };
  }

  const conversations = await prisma.conversation.findMany({
    where: whereClause,
    include: {
      contact: {
        select: {
          id: true,
          name: true,
          phone: true,
          assignedTo: true,
          email: true,
          company: true,
          isBlocked: true,
          contactTags: {
            include: { tag: true },
          },
        },
      },
      messages: {
        where: {
          isDeleted: false,
        },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          text: true,
          createdAt: true,
          isDeleted: true,
        },
      },
    },
    orderBy: { archivedAt: "desc" },
    skip,
    take: limit,
  });

  const total = await prisma.conversation.count({
    where: whereClause,
  });

  return {
    conversations,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

// ──────────── Bulk Reassign Conversations ────────────────────────────
export const bulkReassignConversations = async ({
  tenantId,
  conversationIds,
  newUserId, // renamed: agent → user
  performedBy, // tenant.id
  performedByName, // tenant.tenantName
  performedByEmail, // tenant.email
}) => {
  // ──────────────────────────────────────────
  // STEP 1: Validate new user belongs to tenant
  // ──────────────────────────────────────────
  let targetUserName = null;

  if (newUserId) {
    const user = await prisma.user.findFirst({
      where: {
        id: newUserId,
        tenantId: tenantId, // must be same tenant
        isActive: true, // must be active
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!user) {
      throw new Error("User not found or does not belong to this organization");
    }

    targetUserName = user.name;
  }

  // ──────────────────────────────────────────
  // STEP 2: Fetch selected conversations
  // Verify tenant boundary (security check)
  // ──────────────────────────────────────────
  const conversations = await prisma.conversation.findMany({
    where: {
      id: { in: conversationIds },
      tenantId: tenantId, // ← never allow cross-tenant
      isArchived: false, // ← skip archived conversations
    },
    select: {
      id: true,
      contactId: true,
      assignedTo: true, // ← current user on conversation
      contact: {
        select: {
          id: true,
          assignedTo: true, // ← current user on contact
        },
      },
    },
  });

  // ──────────────────────────────────────────
  // STEP 3: Guard — nothing valid found
  // ──────────────────────────────────────────
  if (conversations.length === 0) {
    throw new Error("No valid conversations found for this organization");
  }

  // ──────────────────────────────────────────
  // STEP 4: Extract unique contact IDs
  // ──────────────────────────────────────────
  const contactIds = [...new Set(conversations.map((c) => c.contactId))];

  // ──────────────────────────────────────────
  // STEP 5: Track previous user per conversation
  // Needed for audit log & activity log
  // ──────────────────────────────────────────
  const previousUserMap = {};
  conversations.forEach((conv) => {
    previousUserMap[conv.id] = conv.assignedTo || null;
  });

  // ──────────────────────────────────────────
  // STEP 6: Update Conversation.assignedTo
  // (your conversation model has assignedTo)
  // ──────────────────────────────────────────
  await prisma.conversation.updateMany({
    where: {
      id: { in: conversationIds },
      tenantId: tenantId,
    },
    data: {
      assignedTo: newUserId || null,
    },
  });

  // ──────────────────────────────────────────
  // STEP 7: Update Contact.assignedTo
  // (contact model also has assignedTo + assignedAt)
  // ──────────────────────────────────────────
  await prisma.contact.updateMany({
    where: {
      id: { in: contactIds },
      tenantId: tenantId,
    },
    data: {
      assignedTo: newUserId || null,
      assignedAt: newUserId ? new Date() : null,
    },
  });

  // ──────────────────────────────────────────
  // STEP 8: Log activity per conversation
  // Never crash if one fails → Promise.allSettled
  // ──────────────────────────────────────────
  const activityPromises = conversations.map((conv) =>
    logActivity({
      conversationId: conv.id,
      action: newUserId ? "reassigned" : "unassigned",
      performedBy: performedBy,
      performedByType: "tenant",
      metadata: {
        fromUserId: previousUserMap[conv.id] || null,
        toUserId: newUserId || null,
        toUserName: targetUserName || null,
      },
    }).catch((err) => {
      console.error(
        `[BulkReassign] Activity log failed for conv ${conv.id}:`,
        err.message,
      );
    }),
  );

  await Promise.allSettled(activityPromises);

  // ──────────────────────────────────────────
  // STEP 9: Notify the new user
  // userId = newUserId → user sees it in their
  // notification list (not tenant-wide)
  // ──────────────────────────────────────────
  if (newUserId) {
    await createNotification({
      tenantId: tenantId,
      userId: newUserId, // ← user-specific
      type: "bulk_reassignment",
      title: "New Conversations Assigned",
      message: `${conversations.length} conversation(s) have been assigned to you`,
      metadata: {
        conversationIds: conversations.map((c) => c.id),
        assignedBy: performedBy,
        assignedByName: performedByName,
        count: conversations.length,
      },
    }).catch((err) => {
      console.error("[BulkReassign] Notification failed:", err.message);
    });
  }

  // ──────────────────────────────────────────
  // STEP 10: Audit log
  // action: BULK_REASSIGN (add to enum)
  // module: CONVERSATIONS (add to enum)
  // actorType: TENANT (SenderType enum)
  // ──────────────────────────────────────────
  await createAuditLog({
    actorId: performedBy,
    actorType: "TENANT", // SenderType enum
    actorName: performedByName || "Admin",
    actorEmail: performedByEmail || "",
    action: "BULK_REASSIGN", // ← add to AuditAction enum
    module: "CONVERSATIONS", // ← add to AuditModule enum
    description: newUserId
      ? `Admin bulk reassigned ${conversations.length} conversation(s) to user "${targetUserName}"`
      : `Admin bulk unassigned ${conversations.length} conversation(s)`,
    targetId: newUserId || null,
    targetType: newUserId ? "USER" : null,
    targetName: targetUserName || null,
    tenantId: tenantId,
    metadata: {
      conversationIds: conversations.map((c) => c.id),
      totalReassigned: conversations.length,
      skippedCount: conversationIds.length - conversations.length,
      newUserId: newUserId || null,
      newUserName: targetUserName || null,
      previousUserMap: previousUserMap,
    },
  });

  // ──────────────────────────────────────────
  // STEP 11: Real-time socket event
  // All clients in this tenant receive this
  // Frontend uses it to refresh inbox
  // ──────────────────────────────────────────
  emitToTenant(tenantId, "conversations_reassigned", {
    conversationIds: conversations.map((c) => c.id),
    newUserId: newUserId || null,
    newUserName: targetUserName || null,
    assignedBy: performedBy,
    assignedByName: performedByName,
    count: conversations.length,
  });

  // ──────────────────────────────────────────
  // STEP 12: Return summary
  // ──────────────────────────────────────────
  return {
    reassignedCount: conversations.length,
    skippedCount: conversationIds.length - conversations.length,
    conversationIds: conversations.map((c) => c.id),
    newUserId: newUserId || null,
    newUserName: targetUserName || null,
  };
};



export const markConversationAsRead = async ({
  conversationId,
  tenantId,
}) => {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, tenantId },
  });

  if (!conversation) throw new Error('Conversation not found');

  // ⭐ Only update if unread > 0 (skip unnecessary DB writes)
  if (conversation.unreadCount > 0) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        unreadCount: 0,
        updatedAt: conversation.updatedAt,  // ⭐ Keep original timestamp — prevents chat jump
      },
    });

    await prisma.message.updateMany({
      where: {
        conversationId,
        direction: 'INBOUND',
        isRead:    false,
      },
      data: { isRead: true },
    });
  }

  emitToTenant(tenantId, 'unread_count_update', {
    conversationId,
    unreadCount: 0,
    contactId:   conversation.contactId,
  });

  return { success: true };
};