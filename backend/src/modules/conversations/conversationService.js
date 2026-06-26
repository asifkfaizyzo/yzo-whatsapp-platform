import bcrypt from 'bcrypt';
import pkg from '@prisma/client';
import prisma from '../../config/prisma.js';
import { logActivity } from '../activity/activityService.js';


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
    const skip = (page - 1) * limit;
    const whereClause = {
      tenantId: tenantId,
    };

// Filter by status
if (status === 'CLOSED') {
  whereClause.status = { in: ['CLOSED', 'RESOLVED'] };
} else if (status === 'OPEN') {
  whereClause.status = 'OPEN';
}

// ── if status is 'ALL' or undefined → no status filter → return ALL statuses ──
// Filter by assignment
    const assignType = assignmentType || (userId ? 'my' : 'all');
    if (assignType === 'my' && userId) {
      whereClause.contact = {
        assignedTo: userId,
      };
    } else if (assignType === 'assigned') {
      whereClause.contact = {
        assignedTo: { not: null },
      };
    } else if (assignType === 'unassigned') {
      whereClause.contact = {
        assignedTo: null,
      };
    }

    // 🔥 STEP 4: MAIN QUERY (INBOX)
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
                tag: true
              }
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
      orderBy: {
        updatedAt: "desc",
      },
      skip,
      take: limit,
    });

    // 🔥 STEP 5: COUNT QUERY
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
    console.error("❌ SERVICE ERROR:", error);
    throw error;
  }
};




//Get messages for a conversation (pagination + infinite scroll)
export const getMessages = async (params) => {
  const { conversationId, limit = 30, before } = params;

  // 🔍 Step 1: Check if conversation exists
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // 🔍 Step 2: Build filter
  const where = {
    conversationId,
  };

  // If user scrolls up (pagination)
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
  // 🔍 Step 3: Fetch messages
  const messages = await prisma.message.findMany({
    where,
    orderBy: {
      createdAt: "desc", // newest first
    },
    take: limit + 1, // extra for "hasMore"
  });

  // 🔍 Step 4: Check pagination
  const hasMore = messages.length > limit;
  const actualMessages = hasMore ? messages.slice(0, limit) : messages;

  // 🔍 Step 5: Convert to chat order (old → new)
  const orderedMessages = actualMessages.reverse();

  // 🔍 Step 6: Format output (frontend friendly)
  const formattedMessages = orderedMessages.map((msg) => ({
    id: msg.id,
    text: msg.text,
    senderId: msg.senderId,
    isFromCustomer: msg.senderId ? false : true,
    mediaUrl: msg.mediaUrl || null,
    createdAt: msg.createdAt,
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

