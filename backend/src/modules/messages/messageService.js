import bcrypt from 'bcrypt';
import prisma from '../../config/prisma.js';
import { decrypt } from '../../lib/crypto.js';

import { getOrCreateConversation } from '../conversations/conversationService.js';
import { evaluateReopen } from '../auto-reopen/autoReopenService.js';
import { logActivity } from '../activity/activityService.js';
import { validateMedia, detectMediaType } from "../../lib/utils/mediaValidator.js";
import { createNotification } from "../notifications/notificationService.js";
import flowEngine from '../automation/flowEngineService.js';



// //Send message- user → contact direction
// export const sendMessage = async ({
//   conversationId,
//   senderId,
//   senderType,
//   message, 
//   type = "TEXT",
// }) => {
//   console.log("senderId =", senderId);
//   console.log("senderType =", senderType);
//   console.log("SERVICE MESSAGE:", message);


//   // 1️⃣ Check conversation exists
//   const conversation = await prisma.conversation.findUnique({
//     where: { id: conversationId },
//   });

//   if (!conversation) {
//     throw new Error("Conversation not found");
//   }

//   // 2️⃣ Create message
//   const newMessage = await prisma.message.create({
//     data: {
//       conversationId,
//       senderId,
//       senderType,
//       text:message,
//       type,
//       isRead: false,
//     },
//   });

//   // 3️⃣ Update conversation (IMPORTANT for inbox sorting)
//   await prisma.conversation.update({
//     where: { id: conversationId },
//     data: {
//       updatedAt: new Date(),
//     },
//   });

//   return newMessage;
// };



//Handle Incoming Message- contact → user
const CLOSED_STATUSES = ['RESOLVED', 'CLOSED'];
export const handleIncomingMessage = async ({
  contactId,
  tenantId,
  text,
  type = 'TEXT',
   mediaUrl,
  mediaName,
  mediaSize,
  mediaMimeType,
  caption,
  isNewContact = false,  // ✅ Accept the flag (defaults false for agent-sent calls)
}) => {

  // Check if contact is blocked
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
  });

  if (!contact) {
    throw new Error('Contact not found');
  }

  if (contact.isBlocked) {
    throw new Error('Cannot receive message from a blocked contact');
  }

  let conversation = await getOrCreateConversation(contactId, tenantId)

  let action = 'message_saved'
  let reason = null

  if (CLOSED_STATUSES.includes(conversation.status)) {
    const decision = await evaluateReopen(conversation, text)

    if (decision.shouldReopen) {
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          status: 'OPEN',
          reopenCount: { increment: 1 },
          reopenedAt: new Date(),
          resolvedAt: null,
          closedAt: null,
          lastMessageAt: new Date(),
          assignedTo: decision.assignToAgentId,
        },
      })

      // Update Contact.assignedTo to match (critical for frontend inbox filters!)
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          assignedTo: decision.assignToAgentId,
          assignedAt: decision.assignToAgentId ? new Date() : null,
        },
      })

      await logActivity({
        conversationId: conversation.id,
        action: 'auto_reopened',
        performedByType: 'system',
        reason: decision.reason,
      })

      action = 'auto_reopened'
      reason = decision.reason
    } else {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      })

      action = 'saved_without_reopen'
      reason = decision.reason
    }
  } else {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    })

    action = 'saved_to_active_conversation'
  }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: null,
      senderType: "CONTACT",
      direction: "INBOUND",       
      text: text || null, 
      text,
      type,
      isRead: false,
      mediaUrl: mediaUrl || null,
      mediaName: mediaName || null,
      mediaSize: mediaSize || null,
      mediaMimeType: mediaMimeType || null,
      caption: caption || null,
    },
  })

  
// create notification
const notification = await createNotification({
  tenantId,
  userId:   null, // null = notify all tenant users
  type:     "new_message",
  title:    "New Message",
  message:  `New message from ${contact.name || contact.phone}`,
  metadata: {
    conversationId: conversation.id,
    contactId,
    contactName: contact.name || contact.phone,
  },
});

  const updatedConversation = await prisma.conversation.findUnique({
    where: { id: conversation.id },
  })

  // Trigger automation flow engine asynchronously
  if (text) {
    flowEngine.processIncomingMessage(updatedConversation, contact, text, isNewContact).catch((err) => {
      console.error('❌ Flow Engine failed to process incoming message:', err);
    });
  }

  return {
    conversation: updatedConversation,
    message,
    action,
    reason,
  }
}




//send Message by Tenant to user
export const sendMessageService = async ({
  contactId,
  tenantId,
  senderId,
  senderType,
  text,
}) => {

  // Check if contact is blocked
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
  });

  if (!contact) {
    throw new Error('Contact not found');
  }

  if (contact.isBlocked) {
    throw new Error('Cannot send message to a blocked contact');
  }

  // ─── ADDED: Meta WhatsApp API Send Logic ───
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });
  if (tenant && tenant.whatsappPhoneId && tenant.whatsappAccessToken) {
    const cleanPhone = contact.phone.replace('+', ''); // Meta expects the number without '+'
    const url = `https://graph.facebook.com/v23.0/${tenant.whatsappPhoneId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${decrypt(tenant.whatsappAccessToken)}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "text",
        text: { body: text }
      })
    });
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Meta API Error Payload:', errorData);
      throw new Error(`Meta API Error: ${errorData.error?.message || 'Unknown error'}`);
    }
  }

  // Create or get conversation
  const conversation =
    await getOrCreateConversation(
      contactId,
      tenantId
    );

  const isClosed = CLOSED_STATUSES.includes(conversation.status);

  if (isClosed) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status: 'OPEN',
        reopenCount: { increment: 1 },
        reopenedAt: new Date(),
        resolvedAt: null,
        closedAt: null,
        lastMessageAt: new Date(),
      },
    });

    await logActivity({
      conversationId: conversation.id,
      action: 'opened',
      performedBy: senderId || null,
      performedByType: senderType === 'TENANT' ? 'tenant' : 'agent',
    });
  } else {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
      },
    });
  }

  // Create message

  console.log({
    senderId,
    senderType,
  });
  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId,
      senderType,
      text,
      type: "TEXT",
      status: "sent",
      isRead: false,
    },
  });

  return message;
};




//send Media Message Service
export const sendMediaMessageService = async ({
  contactId,
  conversationId,
  senderId,
  senderType,
  file,
  caption,
}) => {

  // 1. Detect media type
  const mediaType = detectMediaType(file.mimetype);

  if (!mediaType) {
    throw new Error("Unsupported file type");
  }

  // 2. Validate file
  const validation = validateMedia(
    file.originalname,
    file.mimetype,
    file.size,
    mediaType
  );

  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 3. Build file URL
  const mediaUrl = `/${file.path.replace(/\\/g, "/")}`;

  // 4. Save message in DB
  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId,
      senderType,
      direction:     "OUTBOUND",
      type:          mediaType,        // IMAGE / FILE / VIDEO / AUDIO
      text:          null,
      caption:       caption || null,
      mediaUrl:      mediaUrl,
      mediaName:     file.originalname,
      mediaSize:     file.size,
      mediaMimeType: file.mimetype,
      status:"sent",
      isRead:        false,
    },
  });

  return message;
};



// Soft Delete Message Service
export const deleteMessageService = async ({
  messageId,
  requesterId,
  requesterRole,  // "SUPER_ADMIN" | "TENANT" | "AGENT"
  tenantId,       // tenant context (from token)
}) => {

  // ── Step 1: Find the message ──────────────────────────────
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      conversation: true, // need tenantId from conversation
    },
  });

  if (!message) {
    throw new Error("Message not found");
  }

  // ── Step 2: Check if already deleted ─────────────────────
  if (message.isDeleted) {
    throw new Error("Message already deleted");
  }

  // ── Step 3: Permission Check ──────────────────────────────
  /*
    TENANT      → can delete any message in THEIR tenant
    AGENT       → can only delete messages THEY sent
  */

  const messageTenantId = message.conversation.tenantId;

   if (requesterRole === "TENANT") {
    // ✅ Tenant can delete any message in their own tenant
    if (messageTenantId !== tenantId) {
      throw new Error("Unauthorized: This message does not belong to your tenant");
    }
    console.log("🔑 Tenant deleting message:", messageId);

  } else if (requesterRole === "AGENT") {
    // ✅ Agent can only delete their own sent messages
    if (messageTenantId !== tenantId) {
      throw new Error("Unauthorized: This message does not belong to your tenant");
    }

    // Agent cannot delete contact's inbound messages
    if (message.senderType === "CONTACT") {
      throw new Error("Unauthorized: You cannot delete a contact's message");
    }

    // Agent cannot delete another agent's or tenant's message
    if (message.senderId !== requesterId) {
      throw new Error("Unauthorized: You can only delete your own messages");
    }

    console.log("🔑 Agent deleting their own message:", messageId);

  } else {
    throw new Error("Unauthorized: Unknown role");
  }

  // ── Step 4: Soft Delete ───────────────────────────────────
  const deletedMessage = await prisma.message.update({
    where: { id: messageId },
    data: {
      isDeleted:     true,
      deletedAt:     new Date(),
      deletedBy:     requesterId,
      deletedByRole: requesterRole,
    },
  });

  console.log("🗑️ Message soft deleted:", messageId);

  return {
    deletedMessage,
    conversationId: message.conversationId,
    tenantId:       messageTenantId,
  };
};