import bcrypt from 'bcrypt';
import pkg from '@prisma/client';
import prisma from '../../config/prisma.js';
import { logActivity } from '../activity/activityService.js';
import { emitToTenant } from "../../lib/socket.js";
import { createNotification } from "../notifications/notificationService.js";


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
    console.log("🔥 SERVICE called with:", { userId, tenantId, status, assignmentType });

    const skip = (page - 1) * limit;
    const whereClause = {
      tenantId: tenantId,
    };
    whereClause.isArchived = false;

    console.log("🔥 whereClause:", JSON.stringify(whereClause));

    if (status === 'CLOSED') {
      whereClause.status = { in: ['CLOSED', 'RESOLVED'] };
    } else if (status === 'OPEN') {
      whereClause.status = 'OPEN';
    }

    const assignType = assignmentType || (userId ? 'my' : 'all');
    if (assignType === 'my' && userId) {
      whereClause.contact = { assignedTo: userId };
    } else if (assignType === 'assigned') {
      whereClause.contact = { assignedTo: { not: null } };
    } else if (assignType === 'unassigned') {
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
            id:        true,
            name:      true,
            phone:     true,
            assignedTo: true,
            email:     true,
            company:   true,
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
            id:        true,
            text:      true,
            createdAt: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
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

  // Step 2: Build filter
  const where = {
    conversationId,
    // ✅ NO isDeleted filter here
    // Fetch ALL messages including deleted ones
    // Frontend will show placeholder for deleted ones
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
  const formattedMessages = orderedMessages.map((msg) => ({
    id:             msg.id,
    senderId:       msg.senderId,
    isFromCustomer: msg.senderType === "CONTACT",
    type:           msg.type || "TEXT",
    direction:      msg.direction || null,
    senderType:     msg.senderType || null,
    isRead:         msg.isRead,
    status:         msg.status || "sent",
    createdAt:      msg.createdAt,

    // ✅ If deleted → send null for all content
    // Frontend will show "🚫 This message was deleted"
    text:          msg.isDeleted ? null : msg.text,
    mediaUrl:      msg.isDeleted ? null : (msg.mediaUrl || null),
    mediaName:     msg.isDeleted ? null : (msg.mediaName || null),
    mediaSize:     msg.isDeleted ? null : (msg.mediaSize || null),
    mediaMimeType: msg.isDeleted ? null : (msg.mediaMimeType || null),
    caption:       msg.isDeleted ? null : (msg.caption || null),

    // ✅ Always send these — frontend needs them
    isDeleted:     msg.isDeleted,
    deletedAt:     msg.deletedAt,
  }));

  return {
    messages: formattedMessages,
    hasMore,
  };
};



// Update conversation status (resolve/close/reopen)
export const updateConversationStatus = async ({ conversationId, tenantId, status, agentId, userType }) => {
  // 1. Validate status
  const validStatuses = ['OPEN', 'RESOLVED', 'CLOSED'];
  if (!validStatuses.includes(status)) {
    throw new Error('Invalid conversation status');
  }

  // 2. Fetch conversation and check tenant boundary
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, tenantId },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  // 3. Setup status timestamps
  const updateData = { status };
  if (status === 'RESOLVED') {
    updateData.resolvedAt = new Date();
  } else if (status === 'CLOSED') {
    updateData.closedAt = new Date();
  } else if (status === 'OPEN') {
    const notification = await createNotification({
    tenantId,
    userId:  null,  // notify all
    type:    "conversation_reopened",
    title:   "Conversation Reopened",
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
  const action = status.toLowerCase() === 'open' ? 'opened' : status.toLowerCase() === 'resolved' ? 'resolved' : 'closed';
  await logActivity({
    conversationId,
    action,
    performedBy: agentId || null,
    performedByType: userType === 'TENANT' ? 'tenant' : 'agent',
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
      id:       conversationId,
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
      isArchived:    true,
      archivedAt:    new Date(),
      archivedBy:    requesterId,
      archivedByRole: requesterRole,
    },
  });

  // Log activity
  await logActivity({
    conversationId,
    action:          "archived",
    performedBy:     requesterId,
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
      id:       conversationId,
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
      isArchived:    false,
      archivedAt:    null,
      archivedBy:    null,
      archivedByRole: null,
    },
  });

  await logActivity({
    conversationId,
    action:          "unarchived",
    performedBy:     requesterId,
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
      id:       conversationId,
      tenantId: tenantId,   // tenant boundary check
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
    tenantId:   tenantId,
    isArchived: true,       // ← only archived
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
          id:        true,
          name:      true,
          phone:     true,
          assignedTo: true,
          email:     true,
          company:   true,
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
          id:        true,
          text:      true,
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