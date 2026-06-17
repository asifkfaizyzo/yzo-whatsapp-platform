import bcrypt from 'bcrypt';
import pkg from '@prisma/client';
import prisma from '../../config/prisma.js';

import { getOrCreateConversation } from '../conversations/conversationService.js';
import { evaluateReopen } from '../auto-reopen/autoReopenService.js';
import { logActivity } from '../activity/activityService.js';



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
}) => {
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
      senderType:"CONTACT",
      text,
      type,
      isRead: false,
    },
  })

  const updatedConversation = await prisma.conversation.findUnique({
    where: { id: conversation.id },
  })

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
      isRead: false,
    },
  });

  return message;
};