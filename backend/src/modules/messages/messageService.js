import prisma from '../../config/prisma.js';
import { decrypt } from '../../lib/crypto.js';
import { getOrCreateConversation } from '../conversations/conversationService.js';
import { evaluateReopen } from '../auto-reopen/autoReopenService.js';
import { logActivity } from '../activity/activityService.js';
import { validateMedia, detectMediaType } from '../../lib/utils/mediaValidator.js';
import { createNotification } from '../notifications/notificationService.js';
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
  locLatitude = null,
  locLongitude = null,
  locName = null,
  locAddress = null,
  wamid = null,
}) => {
  // ── 1. Load contact & tenant boundary check ──────────────────
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
  });

  if (!contact) throw new Error('Contact not found');
  if (contact.tenantId !== tenantId) {
    throw new Error('Unauthorized: Contact does not belong to this tenant');
  }
  if (contact.isBlocked) {
    throw new Error('Cannot receive message from a blocked contact');
  }

  // ── 2. Get or create conversation ────────────────────────────
  let conversation = await getOrCreateConversation(contactId, tenantId);

  let action = 'message_saved';
  let reason = null;

  // ── 3 & 4. Atomic Transaction: Update Conversation + Create Message ──
  const { updatedConversation, message } = await prisma.$transaction(async (tx) => {
    let updatedConv;

    if (CLOSED_STATUSES.includes(conversation.status)) {
      const decision = await evaluateReopen(conversation, text);

      if (decision.shouldReopen) {
        updatedConv = await tx.conversation.update({
          where: { id: conversation.id },
          data: {
            status: 'OPEN',
            reopenCount: { increment: 1 },
            reopenedAt: new Date(),
            resolvedAt: null,
            closedAt: null,
            lastMessageAt: new Date(),
            assignedTo: decision.assignToAgentId,
            incomingAt: new Date(),
            unreadCount: { increment: 1 },
          },
        });

        await tx.contact.update({
          where: { id: contact.id },
          data: {
            assignedTo: decision.assignToAgentId,
            assignedAt: decision.assignToAgentId ? new Date() : null,
          },
        });

        await tx.conversationActivity.create({
          data: {
            conversationId: conversation.id,
            action: 'auto_reopened',
            performedByType: 'system',
            reason: decision.reason,
          },
        });

        action = 'auto_reopened';
        reason = decision.reason;
      } else {
        updatedConv = await tx.conversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: new Date(),
            unreadCount: { increment: 1 },
          },
        });

        action = 'saved_without_reopen';
        reason = decision.reason;
      }
    } else {
      updatedConv = await tx.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          incomingAt: new Date(),
          unreadCount: { increment: 1 },
        },
      });

      action = 'saved_to_active_conversation';
    }

    const createdMsg = await tx.message.create({
      data: {
        conversationId: conversation.id,
        senderId: null,
        senderType: 'CONTACT',
        direction: 'INBOUND',
        type,
        text: text || caption || null,
        isRead: false,
        mediaUrl: mediaUrl || null,
        mediaName: mediaName || null,
        mediaSize: mediaSize ? Number(mediaSize) : null,
        mediaMimeType: mediaMimeType || null,
        caption: caption || null,
        locLatitude: locLatitude ? Number(locLatitude) : null,
        locLongitude: locLongitude ? Number(locLongitude) : null,
        locName: locName || null,
        locAddress: locAddress || null,
        status: 'sent',
        wamid,
      },
    });

    return {
      updatedConversation: updatedConv,
      message: createdMsg,
    };
  });

  // ── 5. Create notification ────────────────────────────────────
  await createNotification({
    tenantId,
    userId: null,
    type: 'new_message',
    title: 'New Message',
    message: `New message from ${contact.name || contact.phone}`,
    metadata: {
      conversationId: updatedConversation.id,
      contactId,
      contactName: contact.name || contact.phone,
    },
  });

  // ── Emit unread count to tenant room (for admin) ──────────────
  emitToTenant(tenantId, 'unread_count_update', {
    conversationId: updatedConversation.id,
    unreadCount: updatedConversation.unreadCount,
    contactId: contact.id,
    contactName: contact.name || contact.phone,
  });

  // ── Emit to assigned user (for agent) ─────────────────────────
  const assignedUserId = contact.assignedTo || updatedConversation.assignedTo;

  if (assignedUserId) {
    emitToUser(assignedUserId, 'unread_count_update', {
      conversationId: updatedConversation.id,
      unreadCount: updatedConversation.unreadCount,
      contactId: contact.id,
      contactName: contact.name || contact.phone,
    });

    emitToUser(assignedUserId, 'new_message', {
      conversationId: updatedConversation.id,
      message: {
        id: message.id,
        type: message.type,
        text: message.text,
        senderType: 'CONTACT',
        direction: 'INBOUND',
        isFromCustomer: true,
        mediaUrl: message.mediaUrl,
        mediaName: message.mediaName,
        mediaSize: message.mediaSize,
        mediaMimeType: message.mediaMimeType,
        caption: message.caption,
        locLatitude: message.locLatitude,
        locLongitude: message.locLongitude,
        locName: message.locName,
        locAddress: message.locAddress,
        createdAt: message.createdAt,
      },
    });
  }

  // ── Notify tenant about unassigned contact ───────────────────
  if (!assignedUserId) {
    const unassignedCount = await prisma.contact.count({
      where: {
        tenantId,
        assignedTo: null,
        isActive: true,
      },
    });

    emitToTenant(tenantId, 'unassigned_contact_update', {
      unassignedCount,
      isNew: isNewContact,
      contact: {
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
      },
      conversationId: updatedConversation.id,
    });

    if (isNewContact) {
      emitToTenant(tenantId, 'new_notification', {
        notification: {
          id: `unassigned_${contact.id}_${Date.now()}`,
          type: 'contact_waiting_assignment',
          title: '👤 New contact needs assignment',
          message: `${contact.name} is waiting to be assigned to an agent`,
          isRead: false,
          createdAt: new Date(),
          metadata: {
            contactId: contact.id,
            conversationId: updatedConversation.id,
            unassignedCount,
          },
        },
      });
    }
  }

  // ── Trigger flow engine (text or location) ───────────────────
  if ((text || type === 'LOCATION') && type !== 'ORDER') {
    flowEngine
      .processIncomingMessage(
        updatedConversation,
        contact,
        text || 'LOCATION_RECEIVED',
        isNewContact,
        {
          locLatitude,
          locLongitude,
          locName,
          locAddress,
          messageType: type,
        }
      )
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
  // ── 1. Check contact & tenant boundary ────────────────────────
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
  });

  if (!contact) throw new Error('Contact not found');
  if (contact.tenantId !== tenantId) {
    throw new Error('Unauthorized: Contact does not belong to this tenant');
  }
  if (contact.isBlocked) {
    throw new Error('Cannot send message to a blocked contact');
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  let waMessageId = null;
  let msgStatus = 'sent';
  let failureCode = null;
  let failureReason = null;

  // ── 2. Send via WhatsApp API or Mock ──────────────────────────
  if (process.env.MOCK_WHATSAPP === 'true') {
    waMessageId = `mock_wamid_${Date.now()}`;
    msgStatus = 'sent';
  } else if (tenant?.whatsappPhoneId && tenant?.whatsappAccessToken) {
    try {
      const cleanPhone = contact.phone.replace('+', '');
      const url = `https://graph.facebook.com/v18.0/${tenant.whatsappPhoneId}/messages`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${decrypt(tenant.whatsappAccessToken)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'text',
          text: { body: text },
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('⚠️ WhatsApp API Error:', responseData);
        msgStatus = 'failed';
        failureCode = responseData?.error?.code || null;
        failureReason = responseData?.error?.message || 'Meta API Error';
      } else {
        waMessageId = responseData?.messages?.[0]?.id || null;

        if (!waMessageId) {
          msgStatus = 'failed';
          failureReason = 'Meta accepted the request but returned no WAMID';
          console.error('WhatsApp API response did not include a WAMID:', responseData);
        } else {
          console.log('✅ WhatsApp message sent, wamid:', waMessageId);
        }
      }
    } catch (waError) {
      console.error('⚠️ WhatsApp send failed:', waError.message);
      msgStatus = 'failed';
      failureReason = waError.message;
    }
  } else {
    msgStatus = 'failed';
    failureReason = 'WhatsApp credentials not configured for tenant';
  }

  // ── 3. Get or create conversation ─────────────────────────────
  const conversation = await getOrCreateConversation(contactId, tenantId);

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
      data: { lastMessageAt: new Date() },
    });
  }

  // ── 4. Create message in DB ────────────────────────────────────
  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId,
      senderType,
      direction: 'OUTBOUND',
      type: 'TEXT',
      text,
      status: msgStatus,
      isRead: false,
      wamid: waMessageId,
      failureCode,
      failureReason,
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
  tenantId,
  senderId,
  senderType,
  file,
  caption,
}) => {
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

  // ── Verify Contact & Tenant Security ──────────────────────────
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
  });

  if (!contact) {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    throw new Error('Contact not found');
  }

  if (contact.tenantId !== tenantId) {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    throw new Error('Unauthorized: Contact does not belong to this tenant');
  }

  if (contact.isBlocked) {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    throw new Error('Cannot send to blocked contact');
  }

  // ── Verify Conversation & Tenant Security ─────────────────────
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (
    !conversation ||
    conversation.tenantId !== tenantId ||
    conversation.contactId !== contactId
  ) {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    throw new Error('Conversation not found or unauthorized');
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  let waMessageId = null;
  let msgStatus = 'sent';
  let failureReason = null;

  if (process.env.MOCK_WHATSAPP === 'true') {
    waMessageId = `mock_wamid_${Date.now()}`;
    msgStatus = 'sent';
  } else if (tenant?.whatsappPhoneId && tenant?.whatsappAccessToken) {
    try {
      const result = await sendWhatsAppMedia({
        tenant,
        contactPhone: contact.phone,
        file,
        caption,
        mediaType,
      });

      waMessageId = result?.messages?.[0]?.id || null;

      if (!waMessageId) {
        msgStatus = 'failed';
        failureReason = 'Meta accepted the request but returned no WAMID';
        console.error('WhatsApp API response did not include a WAMID:', result);
      }
    } catch (waError) {
      console.error('⚠️ WhatsApp API media send failed:', waError.message);
      msgStatus = 'failed';
      failureReason = waError.message;
    }
  } else {
    msgStatus = 'failed';
    failureReason = 'WhatsApp credentials not configured for tenant';
  }

  const mediaUrl = file.path.replace(/\\/g, '/');

  if (!mediaUrl.startsWith('uploads/') || mediaUrl.includes('undefined')) {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    throw new Error('Invalid file path generated');
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId,
      senderType,
      direction: 'OUTBOUND',
      type: mediaType,
      text: caption || null,
      caption: caption || null,
      mediaUrl,
      mediaName: file.originalname,
      mediaSize: file.size,
      mediaMimeType: file.mimetype,
      status: msgStatus,
      isRead: false,
      wamid: waMessageId,
      failureReason,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });

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
  const accessToken = decrypt(tenant.whatsappAccessToken);
  const phoneId = tenant.whatsappPhoneId;
  const cleanPhone = contactPhone.replace('+', '');

  const fileBuffer = fs.readFileSync(file.path);

  let uploadMimeType = file.mimetype || 'application/octet-stream';

  const metaAllowedTypes = [
    'audio/aac',
    'audio/mp4',
    'audio/mpeg',
    'audio/amr',
    'audio/ogg',
    'audio/opus',
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/3gpp',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ];

  if (!metaAllowedTypes.includes(uploadMimeType)) {
    throw new Error(`Unsupported WhatsApp media MIME type: ${uploadMimeType}`);
  }

  const blob = new Blob([fileBuffer], { type: uploadMimeType });
  const formData = new globalThis.FormData();

  formData.append('file', blob, file.originalname);
  formData.append('messaging_product', 'whatsapp');

  const uploadRes = await fetch(
    `https://graph.facebook.com/v18.0/${phoneId}/media`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    }
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.json();
    throw new Error(`Media upload failed: ${err.error?.message || JSON.stringify(err)}`);
  }

  const { id: mediaId } = await uploadRes.json();

  const typeMap = {
    IMAGE: 'image',
    VIDEO: 'video',
    AUDIO: 'audio',
    FILE: 'document',
  };

  let waType = typeMap[mediaType] || 'document';

  const supportedAudioMimeTypes = [
    'audio/aac',
    'audio/mp4',
    'audio/mpeg',
    'audio/amr',
    'audio/ogg',
  ];

  if (
    waType === 'audio' &&
    file.mimetype &&
    !supportedAudioMimeTypes.some((mime) => file.mimetype.includes(mime))
  ) {
    waType = 'document';
  }

  const mediaPayload = { id: mediaId };

  if (waType === 'document' && file.originalname) {
    mediaPayload.filename = file.originalname;
  }

  if (['image', 'video', 'document'].includes(waType) && caption) {
    mediaPayload.caption = caption;
  }

  const sendRes = await fetch(
    `https://graph.facebook.com/v18.0/${phoneId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: waType,
        [waType]: mediaPayload,
      }),
    }
  );

  if (!sendRes.ok) {
    const err = await sendRes.json();
    throw new Error(`WhatsApp send failed: ${err.error?.message}`);
  }

  return sendRes.json();
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
    where: { id: messageId },
    include: { conversation: true },
  });

  if (!message) throw new Error('Message not found');
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
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: requesterId,
      deletedByRole: requesterRole,
    },
  });

  return {
    deletedMessage,
    conversationId: message.conversationId,
    tenantId: messageTenantId,
  };
};

// ─────────────────────────────────────────────────────────────
// MARK CONVERSATION AS READ  (clears unread + sends read receipt to Meta)
// ─────────────────────────────────────────────────────────────
export const markConversationAsReadService = async ({
  conversationId,
  tenantId,
}) => {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      tenantId,
    },
    select: { id: true },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { unreadCount: 0 },
  });

  const unreadMessages = await prisma.message.findMany({
    where: {
      conversationId,
      direction: 'INBOUND',
      isRead: false,
      wamid: { not: null },
    },
  });

  if (unreadMessages.length === 0) {
    return { success: true, markedCount: 0 };
  }

  await prisma.message.updateMany({
    where: {
      id: { in: unreadMessages.map((msg) => msg.id) },
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (
    process.env.MOCK_WHATSAPP !== 'true' &&
    tenant?.whatsappPhoneId &&
    tenant?.whatsappAccessToken
  ) {
    const accessToken = decrypt(tenant.whatsappAccessToken);

    await Promise.allSettled(
      unreadMessages.map(async (msg) => {
        try {
          const response = await fetch(
            `https://graph.facebook.com/v18.0/${tenant.whatsappPhoneId}/messages`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                status: 'read',
                message_id: msg.wamid,
              }),
            }
          );

          if (!response.ok) {
            const errorData = await response.json();
            console.warn(
              `⚠️ Meta rejected read receipt for WAMID ${msg.wamid}:`,
              errorData
            );
          }
        } catch (error) {
          console.error(
            `⚠️ Meta read receipt failed for WAMID ${msg.wamid}:`,
            error.message
          );
        }
      })
    );
  }

  emitToTenant(tenantId, 'unread_count_update', {
    conversationId,
    unreadCount: 0,
  });

  return {
    success: true,
    markedCount: unreadMessages.length,
  };
};