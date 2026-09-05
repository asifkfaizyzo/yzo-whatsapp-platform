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
  channel = null,
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
  const contactChannel = channel || contact.channel || 'WHATSAPP';
  let conversation = await getOrCreateConversation(contactId, tenantId, contactChannel);

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

import { GRAPH_BASE_URL } from '../../config/meta.js';

// ─────────────────────────────────────────────────────────────
// SHARED META SENDER (Messenger & Instagram)
// ─────────────────────────────────────────────────────────────
export const sendMetaMessage = async ({
  tenant,
  channelId,
  messagePayload,
  conversationId,
  channel,
}) => {
  if (!tenant?.facebookPageAccessToken) {
    throw new Error('Facebook/Instagram Page Access Token not configured for tenant');
  }

  const token = decrypt(tenant.facebookPageAccessToken);

  // Enforce Instagram 1000-byte limit
  if (channel === 'INSTAGRAM' && typeof messagePayload === 'string') {
    if (Buffer.byteLength(messagePayload, 'utf8') > 1000) {
      throw new Error('Instagram messages are limited to 1,000 bytes. Please shorten your message.');
    }
  }

  // Check 24-hour messaging window
  let isOutside24h = false;
  if (conversationId) {
    const lastInbound = await prisma.message.findFirst({
      where: { conversationId, direction: 'INBOUND' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });
    isOutside24h = lastInbound ? (Date.now() - new Date(lastInbound.createdAt).getTime() > 24 * 60 * 60 * 1000) : false;
  }

  const payload = {
    recipient: { id: channelId },
    message: typeof messagePayload === 'string' ? { text: messagePayload } : messagePayload,
    messaging_type: 'RESPONSE',
    ...(isOutside24h ? { tag: 'HUMAN_AGENT' } : {})
  };

  const response = await fetch(`${GRAPH_BASE_URL}/me/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    const errorCode = data.error?.code;

    // 1. Token Expired / Session Invalid (Code 190 or HTTP 401)
    if (errorCode === 190 || response.status === 401) {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { facebookPageAccessToken: null }
      });
      emitToTenant(tenant.id, 'channel_error', {
        channel,
        error: 'Page Access Token has expired. Please reconnect in Settings.'
      });
      throw new Error('Page Access Token expired (code 190). Please reconnect in Settings.');
    }

    // 2. HUMAN_AGENT tag rejected if permission not yet approved by Meta App Review
    if (errorCode === 10) {
      throw new Error('24-hour messaging window expired. The HUMAN_AGENT tag requires Meta App Review approval.');
    }

    // 3. Messaging window closed (no tag available or expired beyond 7 days)
    if (errorCode === 1545041) {
      throw new Error('Messaging window closed. Cannot send message outside window.');
    }

    // 4. Recipient unavailable (blocked or deactivated)
    if (errorCode === 551) {
      throw new Error('Recipient is unavailable (account blocked or deactivated).');
    }

    throw new Error(data.error?.message || 'Failed to send Meta message');
  }

  return { messageId: data.message_id || data.recipient_id };
};

// ─────────────────────────────────────────────────────────────
// SEND META MEDIA MESSAGE (Direct Binary Upload via FormData)
// ─────────────────────────────────────────────────────────────
export const sendMetaMediaMessage = async ({
  tenant,
  channelId,
  file,
  mediaType,
  conversationId,
  channel,
}) => {
  if (!tenant?.facebookPageAccessToken) {
    throw new Error('Facebook/Instagram Page Access Token not configured for tenant');
  }

  const token = decrypt(tenant.facebookPageAccessToken);

  // Check 24-hour messaging window
  let isOutside24h = false;
  if (conversationId) {
    const lastInbound = await prisma.message.findFirst({
      where: { conversationId, direction: 'INBOUND' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });
    isOutside24h = lastInbound ? (Date.now() - new Date(lastInbound.createdAt).getTime() > 24 * 60 * 60 * 1000) : false;
  }

  const metaAttachmentType =
    mediaType === 'IMAGE' ? 'image' :
    mediaType === 'VIDEO' ? 'video' :
    mediaType === 'AUDIO' ? 'audio' : 'file';

  const formData = new FormData();
  formData.append('recipient', JSON.stringify({ id: channelId }));
  formData.append('message', JSON.stringify({
    attachment: {
      type: metaAttachmentType,
      payload: { is_reusable: true }
    }
  }));

  if (isOutside24h) {
    formData.append('messaging_type', 'MESSAGE_TAG');
    formData.append('tag', 'HUMAN_AGENT');
  } else {
    formData.append('messaging_type', 'RESPONSE');
  }

  const fileBuffer = await fs.promises.readFile(file.path);
  const blob = new Blob([fileBuffer], { type: file.mimetype });
  formData.append('filedata', blob, file.originalname || 'attachment');

  const response = await fetch(`${GRAPH_BASE_URL}/me/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });

  const data = await response.json();

  if (!response.ok) {
    const errorCode = data.error?.code;

    // 1. Token Expired / Session Invalid (Code 190 or HTTP 401)
    if (errorCode === 190 || response.status === 401) {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { facebookPageAccessToken: null }
      });
      emitToTenant(tenant.id, 'channel_error', {
        channel,
        error: 'Page Access Token has expired. Please reconnect in Settings.'
      });
      throw new Error('Page Access Token expired (code 190). Please reconnect in Settings.');
    }

    // 2. HUMAN_AGENT tag rejected if permission not yet approved by Meta App Review
    if (errorCode === 10) {
      throw new Error('24-hour messaging window expired. The HUMAN_AGENT tag requires Meta App Review approval.');
    }

    // 3. Messaging window closed (no tag available or expired beyond 7 days)
    if (errorCode === 1545041) {
      throw new Error('Messaging window closed. Cannot send message outside window.');
    }

    // 4. Recipient unavailable (blocked or deactivated)
    if (errorCode === 551) {
      throw new Error('Recipient is unavailable (account blocked or deactivated).');
    }

    throw new Error(data.error?.message || 'Failed to send Meta media message');
  }

  return { messageId: data.message_id || data.attachment_id || data.recipient_id };
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

  // ── 2. Get or create conversation early for channel context ──
  const conversation = await getOrCreateConversation(contactId, tenantId, contact.channel || 'WHATSAPP');

  let waMessageId = null;
  let msgStatus = 'sent';
  let failureCode = null;
  let failureReason = null;

  // ── 3. Branch by Channel: MESSENGER / INSTAGRAM vs WHATSAPP ──
  if (conversation.channel === 'MESSENGER' || conversation.channel === 'INSTAGRAM') {
    try {
      const metaRes = await sendMetaMessage({
        tenant,
        channelId: contact.channelId || contact.phone,
        messagePayload: text,
        conversationId: conversation.id,
        channel: conversation.channel,
      });
      waMessageId = metaRes.messageId;
      msgStatus = 'sent';
    } catch (metaErr) {
      console.error(`⚠️ Meta ${conversation.channel} send failed:`, metaErr.message);
      msgStatus = 'failed';
      failureReason = metaErr.message;
    }
  } else if (process.env.MOCK_WHATSAPP === 'true') {
    waMessageId = `mock_wamid_${Date.now()}`;
    msgStatus = 'sent';
  } else if (tenant?.whatsappPhoneId && tenant?.whatsappAccessToken) {
    try {
      const cleanPhone = (contact.phone || '').replace('+', '');
      const url = `${GRAPH_BASE_URL}/${tenant.whatsappPhoneId}/messages`;

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

  // ── Branch by Channel: MESSENGER / INSTAGRAM vs WHATSAPP ────
  if (conversation.channel === 'MESSENGER' || conversation.channel === 'INSTAGRAM') {
    try {
      const metaRes = await sendMetaMediaMessage({
        tenant,
        channelId: contact.channelId || contact.phone,
        file,
        mediaType,
        conversationId: conversation.id,
        channel: conversation.channel,
      });

      waMessageId = metaRes.messageId;
      msgStatus = 'sent';

      // Meta Graph API does not support text and attachment in the same message.
      // If a caption is provided, send it as an immediate follow-up text message.
      if (caption && caption.trim()) {
        try {
          await sendMetaMessage({
            tenant,
            channelId: contact.channelId || contact.phone,
            messagePayload: caption.trim(),
            conversationId: conversation.id,
            channel: conversation.channel,
          });
        } catch (captionErr) {
          console.error(`⚠️ Failed to send caption follow-up for Meta ${conversation.channel}:`, captionErr.message);
        }
      }
    } catch (metaErr) {
      console.error(`⚠️ Meta ${conversation.channel} media send failed:`, metaErr.message);
      msgStatus = 'failed';
      failureReason = metaErr.message;
    }
  } else if (process.env.MOCK_WHATSAPP === 'true') {
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