import bcrypt from 'bcrypt';
import pkg from '@prisma/client';



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
}) => {
  try {
    const skip = (page - 1) * limit;
    const allContacts = await prisma.contact.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        assignedTo: true,
      },
    })
    const matchedContacts = allContacts.filter(
      (c) => c.assignedTo === userId
    );
    // 🔥 STEP 4: MAIN QUERY (INBOX)
    const conversations = await prisma.conversation.findMany({
      where: {
        tenantId: tenantId,
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            assignedTo: true,
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
      where: {
        tenantId,
        contact: {
          assignedTo: userId,
        },
      },
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



