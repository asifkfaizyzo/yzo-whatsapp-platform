// src/modules/messages/messageService.js

import prisma from '../../config/prisma.js';
import { decrypt } from '../../lib/crypto.js';
import { getOrCreateConversation } from '../conversations/conversationService.js';
import { evaluateReopen } from '../auto-reopen/autoReopenService.js';
import { logActivity } from '../activity/activityService.js';
import { validateMedia, detectMediaType } from "../../lib/utils/mediaValidator.js";
import { createNotification } from "../notifications/notificationService.js";
import flowEngine from '../automation/flowEngineService.js';
import { emitToTenant, emitToUser } from '../../lib/socket.js';
import fs from 'fs';


const CLOSED_STATUSES = ['RESOLVED', 'CLOSED'];


// ─────────────────────────────────────────────────────────────
// HANDLE INCOMING MESSAGE  (Contact → Platform)
// ─────────────────────────────────────────────────────────────
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
  isNewContact = false,
}) => {

  // ── 1. Load contact ──────────────────────────────────────────
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
  });

  if (!contact) throw new Error('Contact not found');

  if (contact.isBlocked) {
    throw new Error('Cannot receive message from a blocked contact');
  }

  // ── 2. Get or create conversation ────────────────────────────
  let conversation = await getOrCreateConversation(contactId, tenantId);

  let action = 'message_saved';
  let reason = null;

  // ── 3. Handle closed conversation ────────────────────────────
  if (CLOSED_STATUSES.includes(conversation.status)) {
    const decision = await evaluateReopen(conversation, text);

    if (decision.shouldReopen) {
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          status:        'OPEN',
          reopenCount:   { increment: 1 },
          reopenedAt:    new Date(),
          resolvedAt:    null,
          closedAt:      null,
          lastMessageAt: new Date(),
          assignedTo:    decision.assignToAgentId,
          unreadCount:   { increment: 1 }, 
        },
      });

      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          assignedTo: decision.assignToAgentId,
          assignedAt: decision.assignToAgentId ? new Date() : null,
        },
      });

      await logActivity({
        conversationId:  conversation.id,
        action:          'auto_reopened',
        performedByType: 'system',
        reason:          decision.reason,
      });

      action = 'auto_reopened';
      reason = decision.reason;

    } else {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data:  { lastMessageAt: new Date(),
           unreadCount:   { increment: 1 },
         },
      });

      action = 'saved_without_reopen';
      reason = decision.reason;
    }

    } else {
    const updated = await prisma.conversation.update({
      where: { id: conversation.id },
      data:  { lastMessageAt: new Date(),
         unreadCount:   { increment: 1 },
       },
    });
      console.log(`🔴 UNREAD INCREMENTED: contact=${contact.name}, convId=${updated.id}, unreadCount=${updated.unreadCount}`);
    action = 'saved_to_active_conversation';
  }

  // ── 4. Create message ─────────────────────────────────────────
  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId:       null,
      senderType:     'CONTACT',
      direction:      'INBOUND',
      type,
      text:           text || caption || null,   // ✅ Fixed duplicate
      isRead:         false,
      mediaUrl:       mediaUrl       || null,
      mediaName:      mediaName      || null,
      mediaSize:      mediaSize      ? Number(mediaSize) : null,
      mediaMimeType:  mediaMimeType  || null,
      caption:        caption        || null,
      status:         'sent',
    },
  });

  // ── 5. Create notification ────────────────────────────────────
  await createNotification({
    tenantId,
    userId:  null,
    type:    'new_message',
    title:   'New Message',
    message: `New message from ${contact.name || contact.phone}`,
    metadata: {
      conversationId: conversation.id,
      contactId,
      contactName: contact.name || contact.phone,
    },
  });

  // ── 6. Fetch updated conversation ─────────────────────────────
  const updatedConversation = await prisma.conversation.findUnique({
    where: { id: conversation.id },
  });
  console.log(`🔴 EMITTING UNREAD: contact=${contact.name}, unreadCount=${updatedConversation.unreadCount}`);

// ── Emit to tenant room (for admin) ──
emitToTenant(tenantId, 'unread_count_update', {
  conversationId: updatedConversation.id,
  unreadCount:    updatedConversation.unreadCount,
  contactId:      contact.id,
  contactName:    contact.name || contact.phone,
});

// ── Also emit to assigned user (for agent) ──
// Check BOTH contact.assignedTo AND conversation.assignedTo
const assignedUserId = contact.assignedTo || updatedConversation.assignedTo;

if (assignedUserId) {
  console.log(`📤 Emitting unread_count_update to user: ${assignedUserId}`);
  
  emitToUser(assignedUserId, 'unread_count_update', {
    conversationId: updatedConversation.id,
    unreadCount:    updatedConversation.unreadCount,
    contactId:      contact.id,
    contactName:    contact.name || contact.phone,
  });

  // Also emit the new message so it appears in inbox
  emitToUser(assignedUserId, 'new_message', {
    conversationId: updatedConversation.id,
    message: {
      id:             message.id,
      type:           message.type,
      text:           message.text,
      senderType:     'CONTACT',
      direction:      'INBOUND',
      isFromCustomer: true,
      mediaUrl:       message.mediaUrl,
      mediaName:      message.mediaName,
      mediaSize:      message.mediaSize,
      mediaMimeType:  message.mediaMimeType,
      caption:        message.caption,
      createdAt:      message.createdAt,
    }
  });
}


 // ── 6c. ✅ NEW: Notify tenant about unassigned contact ──
if (!contact.assignedTo) {
  const unassignedCount = await prisma.contact.count({
    where: {
      tenantId,
      assignedTo: null,
      isActive:   true,
    }
  });

  emitToTenant(tenantId, 'unassigned_contact_update', {
    unassignedCount,
    isNew:       isNewContact,
    contact: {
      id:    contact.id,
      name:  contact.name,
      phone: contact.phone,
    },
    conversationId: conversation.id,
  });

  // Only bell notification for NEW contacts (avoid spam)
  if (isNewContact) {
    emitToTenant(tenantId, 'new_notification', {
      notification: {
        id:        `unassigned_${contact.id}_${Date.now()}`,
        type:      'contact_waiting_assignment',
        title:     '👤 New contact needs assignment',
        message:   `${contact.name} is waiting to be assigned to an agent`,
        isRead:    false,
        createdAt: new Date(),
        metadata: {
          contactId:      contact.id,
          conversationId: conversation.id,
          unassignedCount,
        }
      }
    });
  }

  console.log(`📤 Tenant notified: ${unassignedCount} unassigned contact(s)`);
}

  // ── 7. Trigger flow engine (text only) ────────────────────────
  if (text) {
    flowEngine
      .processIncomingMessage(updatedConversation, contact, text, isNewContact)
      .catch((err) => {
        console.error('❌ Flow Engine error:', err);
      });
  }

  return {
    conversation: updatedConversation,
    message,
    action,
    reason,
  };
};


// ─────────────────────────────────────────────────────────────
// SEND TEXT MESSAGE  (Tenant / Agent → Contact)
// ─────────────────────────────────────────────────────────────
export const sendMessageService = async ({
  contactId,
  tenantId,
  senderId,
  senderType,
  text,
}) => {

  // ── 1. Check contact ──────────────────────────────────────────
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
  });

  if (!contact)          throw new Error('Contact not found');
  if (contact.isBlocked) throw new Error('Cannot send message to a blocked contact');

  // ── 2. Send via WhatsApp API ──────────────────────────────────
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

 // AFTER (with try/catch):
if (tenant?.whatsappPhoneId && tenant?.whatsappAccessToken) {
  try {                                                        // ← ADD
    const cleanPhone = contact.phone.replace('+', '');
    const url = `https://graph.facebook.com/v23.0/${tenant.whatsappPhoneId}/messages`;

    const response = await fetch(url, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${decrypt(tenant.whatsappAccessToken)}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type:    'individual',
        to:                cleanPhone,
        type:              'text',
        text:              { body: text },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('⚠️ WhatsApp API Error:', errorData);
      // ← REMOVED throw, just log
    } else {
      console.log('✅ WhatsApp message sent successfully');
    }

  } catch (waError) {                                          // ← ADD
    console.error('⚠️ WhatsApp send failed:', waError.message);
    // continues to save in DB
  }                                                            // ← ADD
}

  // ── 3. Get or create conversation ─────────────────────────────
  const conversation = await getOrCreateConversation(contactId, tenantId);

  const isClosed = CLOSED_STATUSES.includes(conversation.status);

  if (isClosed) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status:        'OPEN',
        reopenCount:   { increment: 1 },
        reopenedAt:    new Date(),
        resolvedAt:    null,
        closedAt:      null,
        lastMessageAt: new Date(),
      },
    });

    await logActivity({
      conversationId:  conversation.id,
      action:          'opened',
      performedBy:     senderId || null,
      performedByType: senderType === 'TENANT' ? 'tenant' : 'agent',
    });

  } else {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data:  { lastMessageAt: new Date() },
    });
  }

  // ── 4. Create message ─────────────────────────────────────────
  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId,
      senderType,
      direction:      'OUTBOUND',
      type:           'TEXT',
      text,
      status:         'sent',
      isRead:         false,
    },
  });

  return { ...message, conversationId: conversation.id };
};


// ─────────────────────────────────────────────────────────────
// SEND MEDIA MESSAGE  (Tenant / Agent → Contact)
// ─────────────────────────────────────────────────────────────
export const sendMediaMessageService = async ({
  contactId,
  conversationId,
  tenantId,       // ✅ NOW received
  senderId,
  senderType,
  file,
  caption,
}) => {

  // ── 1. Detect & validate media ────────────────────────────────
  const mediaType = detectMediaType(file.mimetype);

  if (!mediaType) {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    throw new Error('Unsupported file type');
  }

  const validation = validateMedia(
    file.originalname,
    file.mimetype,
    file.size,
    mediaType
  );

  if (!validation.valid) {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    throw new Error(validation.error);
  }

  // ── 2. Check contact not blocked ──────────────────────────────
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
  });

  if (!contact) {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    throw new Error('Contact not found');
  }

  if (contact.isBlocked) {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    throw new Error('Cannot send to blocked contact');
  }

  // ── 3. Verify conversation ────────────────────────────────────
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    throw new Error('Conversation not found');
  }

  // ── 4. Send via WhatsApp API ──────────────────────────────────
  // Note: For WhatsApp media, you need to first upload to Meta
  // then send the media ID. This requires a 2-step process.
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (tenant?.whatsappPhoneId && tenant?.whatsappAccessToken) {
    try {
      await sendWhatsAppMedia({
        tenant,
        contactPhone: contact.phone,
        file,
        caption,
        mediaType,
      });
    } catch (waError) {
      console.error('⚠️ WhatsApp API media send failed:', waError.message);
      // Don't throw - still save to DB so agent can see it
      // In production you may want to handle this differently
    }
  }

  // ── 5. Build permanent media URL ──────────────────────────────
  // file.path = "uploads/tenants/{tid}/contacts/{cid}/outbound/filename.jpg"
  const mediaUrl = file.path.replace(/\\/g, '/');

// ✅ Validate path before saving to DB
if (!mediaUrl.startsWith('uploads/')) {
  if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
  throw new Error('Invalid file path generated');
}

if (mediaUrl.includes('undefined')) {
  if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
  throw new Error('Invalid file path - contains undefined');
}

  // ── 6. Save message to DB ─────────────────────────────────────
  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId,
      senderType,
      direction:      'OUTBOUND',
      type:           mediaType,
      text:           caption || null,
      caption:        caption || null,
      mediaUrl,                          // ✅ permanent absolute URL
      mediaName:      file.originalname,
      mediaSize:      file.size,
      mediaMimeType:  file.mimetype,
      status:         'sent',
      isRead:         false,
    },
  });

  // ── 7. Update conversation lastMessageAt ──────────────────────
  await prisma.conversation.update({
    where: { id: conversationId },
    data:  { lastMessageAt: new Date() },
  });

  // ✅ Return with conversationId for socket emit
  return { ...message, conversationId };
};


// ── WhatsApp Media Send Helper ────────────────────────────────
const sendWhatsAppMedia = async ({
  tenant,
  contactPhone,
  file,
  caption,
  mediaType,
}) => {
  const accessToken  = decrypt(tenant.whatsappAccessToken);
  const phoneId      = tenant.whatsappPhoneId;
  const cleanPhone   = contactPhone.replace('+', '');

  // Step 1: Upload media to Meta
  const FormData = (await import('form-data')).default;
  const formData = new FormData();
  formData.append('file', fs.createReadStream(file.path), {
    filename:    file.originalname,
    contentType: file.mimetype,
  });
  formData.append('messaging_product', 'whatsapp');

  const uploadRes = await fetch(
    `https://graph.facebook.com/v23.0/${phoneId}/media`,
    {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        ...formData.getHeaders(),
      },
      body: formData,
    }
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.json();
    throw new Error(`Media upload failed: ${err.error?.message}`);
  }

  const { id: mediaId } = await uploadRes.json();

  // Step 2: Send message with media ID
  const typeMap = {
    IMAGE:    'image',
    VIDEO:    'video',
    AUDIO:    'audio',
    FILE:     'document',
  };

  const waType = typeMap[mediaType] || 'document';

  const sendRes = await fetch(
    `https://graph.facebook.com/v23.0/${phoneId}/messages`,
    {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type:    'individual',
        to:                cleanPhone,
        type:              waType,
        [waType]: {
          id:      mediaId,
          caption: caption || undefined,
        },
      }),
    }
  );

  if (!sendRes.ok) {
    const err = await sendRes.json();
    throw new Error(`WhatsApp send failed: ${err.error?.message}`);
  }

  return await sendRes.json();
};


// ─────────────────────────────────────────────────────────────
// DELETE MESSAGE  (Soft delete)
// ─────────────────────────────────────────────────────────────
export const deleteMessageService = async ({
  messageId,
  requesterId,
  requesterRole,
  tenantId,
}) => {

  const message = await prisma.message.findUnique({
    where:   { id: messageId },
    include: { conversation: true },
  });

  if (!message)          throw new Error('Message not found');
  if (message.isDeleted) throw new Error('Message already deleted');

  const messageTenantId = message.conversation.tenantId;

  if (requesterRole === 'TENANT') {
    if (messageTenantId !== tenantId) {
      throw new Error('Unauthorized: This message does not belong to your tenant');
    }

  } else if (requesterRole === 'USER') {
    if (messageTenantId !== tenantId) {
      throw new Error('Unauthorized: This message does not belong to your tenant');
    }

    if (message.senderType === 'CONTACT') {
      throw new Error("Unauthorized: You cannot delete a contact's message");
    }

    if (message.senderId !== requesterId) {
      throw new Error('Unauthorized: You can only delete your own messages');
    }

  } else {
    throw new Error('Unauthorized: Unknown role');
  }

  const deletedMessage = await prisma.message.update({
    where: { id: messageId },
    data: {
      isDeleted:     true,
      deletedAt:     new Date(),
      deletedBy:     requesterId,
      deletedByRole: requesterRole,
    },
  });

  return {
    deletedMessage,
    conversationId: message.conversationId,
    tenantId:       messageTenantId,
  };
};