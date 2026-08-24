// src/workers/webhookWorker.js

import { Worker } from 'bullmq';
import { QUEUE_NAME_WEBHOOK } from '../queues/webhookQueue.js';
import { redisConnection } from '../config/redis.js';
import prisma from '../config/prisma.js';
import { handleIncomingMessage } from '../modules/messages/messageService.js';
import { createNotification } from '../modules/notifications/notificationService.js';
import { emitToTenant, emitToUser } from '../lib/socket.js';
import { isNewWebhookEvent } from '../lib/idempotency.js';
import { dlqQueue } from '../queues/dlqQueue.js';
import { generateSignedUrl } from '../lib/utils/signedUrl.js';
import { decrypt } from '../lib/crypto.js';
import { sendTemplateStatusEmail } from '../modules/auth/emailService.js';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';



// ─────────────────────────────────────────────────────────────
// MAIN JOB PROCESSOR
// ─────────────────────────────────────────────────────────────
export const processWebhookJob = async (job) => {

  const body = job.data;
  if (!body || body.object !== 'whatsapp_business_account') return;

  const entry = body.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  const message = value?.messages?.[0];
  const statusUpdate = value?.statuses?.[0];

  // TEMP: test failure simulation
  if (message && message.text?.body === 'FAIL_TEST') {
    throw new Error('Simulated failure for DLQ test');
  }

  // ═══════════════════════════════════════════════════════════
  // A0. Handle Template Status Updates (Meta approval/rejection)
  // ═══════════════════════════════════════════════════════════
  const isTemplateStatusEvent = change?.field === 'message_template_status_update' || (value?.event && value?.message_template_name);

  if (isTemplateStatusEvent) {
    const wabaId = entry?.id;
    const event = value?.event; // 'APPROVED' | 'REJECTED' | 'PAUSED' | 'PENDING_DELETION' | 'DISABLED'
    const templateName = value?.message_template_name;
    const language = value?.message_template_language || 'en_US';
    const metaTemplateId = value?.message_template_id ? String(value.message_template_id) : null;
    const reason = value?.reason;

    const templateEventId = `template_status:${wabaId}:${templateName}:${language}:${event}`;
    const isNew = await isNewWebhookEvent(templateEventId);

    if (!isNew) {
      console.log(`⚠️ [Dedup] Skipping duplicate template status event: ${templateEventId}`);
      return;
    }

    console.log(`📋 [Webhook] Processing template status update: "${templateName}" (${language}) -> ${event} [WABA: ${wabaId}]`);

    // 1. Find Tenant by whatsappWabaId
    let tenant = null;
    if (wabaId) {
      tenant = await prisma.tenant.findFirst({
        where: { whatsappWabaId: String(wabaId) }
      });
    }

    // 2. Find Template in DB
    let template = null;
    if (tenant) {
      template = await prisma.template.findUnique({
        where: {
          name_language_tenantId: {
            name: templateName,
            language: language,
            tenantId: tenant.id,
          }
        }
      });
    }

    if (!template && metaTemplateId) {
      template = await prisma.template.findFirst({
        where: { metaTemplateId: String(metaTemplateId) }
      });
      if (template && !tenant) {
        tenant = await prisma.tenant.findUnique({ where: { id: template.tenantId } });
      }
    }

    if (template && tenant) {
      let newStatus = 'PENDING';
      if (event === 'APPROVED') newStatus = 'APPROVED';
      else if (event === 'REJECTED') newStatus = 'REJECTED';
      else if (event === 'PAUSED') newStatus = 'PAUSED';
      else if (event === 'PENDING_DELETION' || event === 'DELETED') newStatus = 'DELETED';
      else if (event === 'DISABLED') newStatus = 'DISABLED';

      await prisma.template.update({
        where: { id: template.id },
        data: {
          status: newStatus,
          ...(metaTemplateId ? { metaTemplateId } : {}),
        }
      });

      console.log(`✅ Template "${template.name}" status updated to ${newStatus} for tenant ${tenant.id}`);

      // Emit live socket event to tenant room
      emitToTenant(tenant.id, 'template_status_update', {
        templateId: template.id,
        name: template.name,
        language: template.language,
        status: newStatus,
        reason: reason || null,
        category: template.category,
        headerType: template.headerType,
      });

      // Send email notification on approval (or rejection)
      const recipientEmail = tenant.email;
      if (recipientEmail && (newStatus === 'APPROVED' || newStatus === 'REJECTED')) {
        await sendTemplateStatusEmail({
          toEmail: recipientEmail,
          tenantName: tenant.tenantName || tenant.firstName || 'Valued Partner',
          templateName: template.name,
          language: template.language,
          category: template.category,
          headerType: template.headerType,
          status: newStatus,
          reason: reason || null,
        });
      }
    } else {
      console.warn(`⚠️ Template "${templateName}" (${language}) not found in DB for WABA ${wabaId}`);
    }

    return; // template status handled, stop here
  }

  // ═══════════════════════════════════════════════════════════
  // A. Handle Delivery Status Receipts (unchanged - working ✅)
  // ═══════════════════════════════════════════════════════════
  if (statusUpdate) {
    const wamid = statusUpdate.id;
    const status = statusUpdate.status;

    const statusEventId = `status:${wamid}:${status}`;
    const isNew = await isNewWebhookEvent(statusEventId);

    if (!isNew) {
      console.log(`⚠️ [Dedup] Skipping duplicate status: ${statusEventId}`);
      return;
    }

    console.log(`✅ [Dedup] Processing NEW status: ${statusEventId}`);

    const recipient = await prisma.broadcastRecipient.findUnique({
      where: { wamid },
      include: { broadcast: true }
    });

    if (recipient) {
      const currentStatus = recipient.status;
      let updatedStatus = currentStatus;
      const updateData = {};
      const broadcastIncrements = {};

      if (status === 'delivered') {
        // State machine: Only advance to DELIVERED if not already READ or FAILED
        if (currentStatus !== 'READ' && currentStatus !== 'FAILED') {
          updatedStatus = 'DELIVERED';
        }
        if (!recipient.deliveredAt) {
          updateData.deliveredAt = new Date();
        }
        if (currentStatus === 'SENT' || currentStatus === 'PENDING') {
          broadcastIncrements.delivered = { increment: 1 };
        }
      } else if (status === 'read') {
        // State machine: Advance to READ (highest success state)
        if (currentStatus !== 'FAILED') {
          updatedStatus = 'READ';
        }
        if (!recipient.readAt) {
          updateData.readAt = new Date();
        }
        if (!recipient.deliveredAt) {
          updateData.deliveredAt = new Date();
        }
        if (currentStatus !== 'READ') {
          broadcastIncrements.read = { increment: 1 };
          // If it was direct from SENT to READ without delivered webhook, also track delivered
          if (currentStatus === 'SENT' || currentStatus === 'PENDING') {
            broadcastIncrements.delivered = { increment: 1 };
          }
        }
      } else if (status === 'failed') {
        updatedStatus = 'FAILED';
        updateData.failedAt = new Date();
        const errObj = statusUpdate.errors?.[0];
        updateData.errorCode = errObj?.code ? String(errObj.code) : null;
        updateData.errorMessage = errObj?.details || errObj?.message || errObj?.title || 'Meta Send Failure';
        console.error(`❌ Meta webhook reported delivery failure for wamid ${wamid} (code ${errObj?.code}): ${updateData.errorMessage}`);

        if (currentStatus !== 'FAILED') {
          broadcastIncrements.failed = { increment: 1 };
        }
      }

      await prisma.broadcastRecipient.update({
        where: { wamid },
        data: { status: updatedStatus, ...updateData }
      });

      // Also keep corresponding conversation Message status in sync if wamid matches
            try {
        await prisma.message.updateMany({
          where: { wamid },
          data: {
            status: status,
            isRead: status === 'read',
            ...(updateData.deliveredAt ? { deliveredAt: updateData.deliveredAt } : {}),
            ...(updateData.readAt ? { readAt: updateData.readAt } : {}),
            ...(updateData.failedAt ? { failedAt: updateData.failedAt } : {}),
            ...(updateData.errorCode ? { failureCode: parseInt(updateData.errorCode, 10) || null } : {}),
            ...(updateData.errorMessage ? { failureReason: updateData.errorMessage } : {})
          }
        });
      } catch (err) {
        console.warn(`[webhookWorker] Could not sync message status for wamid ${wamid}:`, err.message);
      }

      const broadcastId = recipient.broadcastId;
      let broadcast = recipient.broadcast;

      if (Object.keys(broadcastIncrements).length > 0) {
        broadcast = await prisma.broadcast.update({
          where: { id: broadcastId },
          data: broadcastIncrements
        });
      }

      emitToTenant(recipient.broadcast.tenantId, 'broadcast_update', {
        broadcastId,
        sent: broadcast.sent,
        delivered: broadcast.delivered,
        read: broadcast.read,
        failed: broadcast.failed,
        status: broadcast.status
      });
        } else {
      // ── Handle 1-on-1 Message Status Receipt ──
      const messageToUpdate = await prisma.message.findUnique({
        where: { wamid },
        include: { conversation: true },
      });
      if (messageToUpdate) {
        const msgUpdateData = {
          status,
          isRead: status === 'read',
        };
        if (status === 'delivered') msgUpdateData.deliveredAt = new Date();
        if (status === 'read') msgUpdateData.readAt = new Date();
        if (status === 'failed') {
          msgUpdateData.failedAt = new Date();
          msgUpdateData.failureCode = statusUpdate.errors?.[0]?.code || null;
          msgUpdateData.failureReason = statusUpdate.errors?.[0]?.title || 'Send Failure';
        }
        await prisma.message.update({
          where: { wamid },
          data: msgUpdateData,
        });

        // Emit real-time tick update to frontend
        const tenantId = messageToUpdate.conversation?.tenantId;
        if (tenantId) {
          emitToTenant(tenantId, 'message_status_update', {
            messageId: messageToUpdate.id,
            conversationId: messageToUpdate.conversationId,
            wamid,
            status,
            deliveredAt: msgUpdateData.deliveredAt || null,
            readAt: msgUpdateData.readAt || null,
            failureReason: msgUpdateData.failureReason || null,
          });
        }
      }
    }

    return; // ✅ status handled, stop here // ✅ status handled, stop here
  }


  // ═══════════════════════════════════════════════════════════
  // B. Handle Incoming Messages (TEXT + MEDIA)
  // ═══════════════════════════════════════════════════════════
       if (message) {
    const messageId = message.id;
    console.log('📥 [META WEBHOOK INBOUND WAMID]:', messageId); // ← ADD DEBUG LOG

    // ── Idempotency check ──────────────────────────────────
    const isNew = await isNewWebhookEvent(`msg:${messageId}`);
    if (!isNew) {
      console.log(`⚠️ [Dedup] Skipping duplicate message: ${messageId}`);
      return;
    }
    console.log(`✅ [Dedup] Processing NEW message: ${messageId}`);

    const phoneId = value.metadata?.phone_number_id;
    const customerPhone = message.from;
    const messageType = message.type; // "text"|"image"|"video"|"audio"|"document"|"sticker"

    // ── Find tenant ────────────────────────────────────────
    const tenant = await prisma.tenant.findFirst({
      where: { whatsappPhoneId: phoneId }
    });

    if (!tenant) {
      console.log(`⚠️ No tenant found for phoneId: ${phoneId}`);
      return;
    }

    // ── Check subscription ─────────────────────────────────
    const subStatus = tenant.subscriptionStatus;
    const isActive =
      subStatus === 'active' ||
      subStatus === 'trialing' ||
      subStatus === 'cancel_at_period_end';

    if (!isActive) {
      console.log(`🚫 Webhook ignored for tenant ${tenant.id} - inactive subscription: ${subStatus}`);
      return;
    }

    // ── Find or create contact ─────────────────────────────
    const normalizedPhone = `+${customerPhone.replace(/^\+/, '')}`;

    let contact = await prisma.contact.findFirst({
      where: { phone: normalizedPhone, tenantId: tenant.id }
    });

    let isNewContact = false;

    if (!contact) {
      isNewContact = true;
      contact = await prisma.contact.create({
        data: {
          name: value.contacts?.[0]?.profile?.name || normalizedPhone,
          phone: normalizedPhone,
          tenantId: tenant.id,
          whatsappId: normalizedPhone.replace(/^\+/, '').slice(-10)
        }
      });
      console.log(`🆕 New contact: ${contact.name} (${normalizedPhone})`);
    } else {
      console.log(`♻️ Existing contact: ${contact.name} (${normalizedPhone})`);
    }

    // ── Extract message content based on type ─────────────
    let text = null;
    let type = 'TEXT';
    let mediaUrl = null;
    let mediaName = null;
    let mediaSize = null;
    let mediaMimeType = null;
    let caption = null;

    let locLatitude   = null;
    let locLongitude  = null;
    let locName       = null;
    let locAddress    = null;

    // ── TEXT ───────────────────────────────────────────────
    if (messageType === 'text') {
      text = message.text?.body;
      type = 'TEXT';

      // ── IMAGE ──────────────────────────────────────────────
    } else if (messageType === 'image') {
      const media = message.image;
      caption = media.caption || null;
      mediaMimeType = media.mime_type;
      type = 'IMAGE';

      try {
        const downloaded = await downloadWhatsAppMedia({
          mediaId: media.id,
          mimeType: media.mime_type,
          fileName: null,           // images have no filename
          tenantId: tenant.id,
          contactId: contact.id,
          accessToken: decrypt(tenant.whatsappAccessToken),
        });

        mediaUrl = downloaded.publicUrl;
        mediaName = downloaded.fileName;
        mediaSize = downloaded.fileSize;

      } catch (err) {
        console.error(`❌ Image download failed:`, err.message);
        // Still save message but without media
        text = '[Image - download failed]';
        type = 'TEXT';
      }

      // ── VIDEO ──────────────────────────────────────────────
    } else if (messageType === 'video') {
      const media = message.video;
      caption = media.caption || null;
      mediaMimeType = media.mime_type;
      type = 'VIDEO';

      try {
        const downloaded = await downloadWhatsAppMedia({
          mediaId: media.id,
          mimeType: media.mime_type,
          fileName: null,
          tenantId: tenant.id,
          contactId: contact.id,
          accessToken: decrypt(tenant.whatsappAccessToken),
        });

        mediaUrl = downloaded.publicUrl;
        mediaName = downloaded.fileName;
        mediaSize = downloaded.fileSize;

      } catch (err) {
        console.error(`❌ Video download failed:`, err.message);
        text = '[Video - download failed]';
        type = 'TEXT';
      }

      // ── AUDIO ──────────────────────────────────────────────
    } else if (messageType === 'audio') {
      const media = message.audio;
      mediaMimeType = media.mime_type;
      type = 'AUDIO';

      try {
        const downloaded = await downloadWhatsAppMedia({
          mediaId: media.id,
          mimeType: media.mime_type,
          fileName: null,
          tenantId: tenant.id,
          contactId: contact.id,
          accessToken: decrypt(tenant.whatsappAccessToken),
        });

        mediaUrl = downloaded.publicUrl;
        mediaName = downloaded.fileName;
        mediaSize = downloaded.fileSize;

      } catch (err) {
        console.error(`❌ Audio download failed:`, err.message);
        text = '[Audio - download failed]';
        type = 'TEXT';
      }

      // ── DOCUMENT ───────────────────────────────────────────
    } else if (messageType === 'document') {
      const media = message.document;
      caption = media.caption || null;
      mediaMimeType = media.mime_type;
      type = 'FILE';

      try {
        const downloaded = await downloadWhatsAppMedia({
          mediaId: media.id,
          mimeType: media.mime_type,
          fileName: media.filename || null,  // documents have filename
          tenantId: tenant.id,
          contactId: contact.id,
          accessToken: decrypt(tenant.whatsappAccessToken),
        });

        mediaUrl = downloaded.publicUrl;
        mediaName = media.filename || downloaded.fileName;
        mediaSize = downloaded.fileSize;

      } catch (err) {
        console.error(`❌ Document download failed:`, err.message);
        text = `[Document: ${media.filename || 'file'} - download failed]`;
        type = 'TEXT';
      }

      // ── STICKER ────────────────────────────────────────────
    } else if (messageType === 'sticker') {
      const media = message.sticker;
      mediaMimeType = media.mime_type;
      type = 'IMAGE';

      try {
        const downloaded = await downloadWhatsAppMedia({
          mediaId: media.id,
          mimeType: media.mime_type,
          fileName: 'sticker',
          tenantId: tenant.id,
          contactId: contact.id,
          accessToken: decrypt(tenant.whatsappAccessToken),
        });

        mediaUrl = downloaded.publicUrl;
        mediaName = downloaded.fileName;
        mediaSize = downloaded.fileSize;

      } catch (err) {
        console.error(`❌ Sticker download failed:`, err.message);
        text = '[Sticker]';
        type = 'TEXT';
      }

      // ── LOCATION ───────────────────────────────────────────
    } else if (messageType === 'location') {
      const loc = message.location;
      type         = 'LOCATION';
      text         = null;  

      locLatitude  = loc.latitude  || null;
      locLongitude = loc.longitude || null;
      locName      = loc.name      || null;
      locAddress   = loc.address   || null;

      console.log(`📍 Location received: lat=${loc.latitude}, lng=${loc.longitude}`);

      // ── CONTACTS ───────────────────────────────────────────
    } else if (messageType === 'contacts') {
      const c = message.contacts?.[0];
      text = `👤 Contact shared: ${c?.name?.formatted_name || 'Unknown'}`;
      type = 'TEXT';

      } else if (messageType === 'interactive') {

  const interactiveType = message.interactive?.type

  if (interactiveType === 'button_reply') {
    text = message.interactive.button_reply.title
    type = 'TEXT'
    console.log(`🖱️ Button clicked: "${text}"`)

  } else if (interactiveType === 'list_reply') {
    text = message.interactive.list_reply.title
    type = 'TEXT'
    console.log(`📋 List selected: "${text}"`)

  } else {
    console.log(`ℹ️ Unknown interactive type: ${interactiveType}`)
    return
  }
        

    // ── UNSUPPORTED ────────────────────────────────────────
    } else {
      console.log(`ℹ️ Unsupported message type: ${messageType} - skipping`);
      return;
    }

    // ── Skip if nothing to save ────────────────────────────
    if (!text && !mediaUrl) {
      console.log(`⚠️ No content extracted from message type: ${messageType}`);
      return;
    }

    // ── Save message via service ───────────────────────────
        const result = await handleIncomingMessage({
      contactId: contact.id,
      tenantId: tenant.id,
      text,
      type,
      mediaUrl,
      mediaName,
      mediaSize,
      mediaMimeType,
      caption,
      isNewContact,
      locLatitude,
      locLongitude,
      locName,
      locAddress,
      wamid: messageId,
    });

    // ── Socket: emit to tenant room ────────────────────────
    emitToTenant(tenant.id, 'new_message', {
      conversationId: result.conversation.id,
      message: {
        id: result.message.id,
        type: result.message.type,        // ✅ correct type now
        text: result.message.text,
        senderId: result.message.senderId,
        senderType: 'CONTACT',
        direction: 'INBOUND',
        isFromCustomer: true,
        mediaUrl: result.message.mediaUrl, 
        mediaName:      result.message.mediaName,
        mediaSize:      result.message.mediaSize,
        mediaMimeType:  result.message.mediaMimeType,
        caption:        result.message.caption,
        locLatitude:    result.message.locLatitude,
        locLongitude:   result.message.locLongitude,
        locName:        result.message.locName,
        locAddress:     result.message.locAddress,
        createdAt:      result.message.createdAt,
      }
    });



    // ── Socket: emit notification to tenant ────────────────
  
    // ── Save + Emit notification ───────────────────────────
    const notifMessage = text
      ? text.substring(0, 100)
      : `Sent a ${type.toLowerCase()}`;

    const notifTitle   = `New message from ${contact.name}`;
    const notifMeta    = {
      contactId:      contact.id,
      conversationId: result.conversation.id,
      messageId:      result.message.id,
    };

    // ✅ Save tenant notification to DB then emit
    try {
      const tenantNotif = await createNotification({
        tenantId: tenant.id,
        userId:   null,           // tenant-wide
        type:     'new_message',
        title:    notifTitle,
        message:  notifMessage,
        metadata: notifMeta,
      });

      emitToTenant(tenant.id, 'new_notification', {
        notification: {
          id:        tenantNotif.id,
          type:      tenantNotif.type,
          title:     tenantNotif.title,
          message:   tenantNotif.message,
          isRead:    tenantNotif.isRead,
          createdAt: tenantNotif.createdAt,
          metadata:  tenantNotif.metadata,
        },
      });
      console.log(`📤 Tenant notif saved+emitted: ${tenantNotif.id}`);
    } catch (err) {
      console.error('❌ Tenant notification failed:', err.message);
    }

    // ── Socket: emit to assigned user ──────────────────────
    if (contact.assignedTo) {
      emitToUser(contact.assignedTo, 'new_message', {

        conversationId: result.conversation.id,
        message: {
          id: result.message.id,
          type: result.message.type,
          text: result.message.text,
          senderId: result.message.senderId,
          senderType: 'CONTACT',
          direction: 'INBOUND',
          isFromCustomer: true,
          mediaUrl:       result.message.mediaUrl,
          mediaName:      result.message.mediaName,
          mediaSize:      result.message.mediaSize,
          mediaMimeType:  result.message.mediaMimeType,
          caption:        result.message.caption,
          locLatitude:    result.message.locLatitude,
          locLongitude:   result.message.locLongitude,
          locName:        result.message.locName,
          locAddress:     result.message.locAddress,
          createdAt:      result.message.createdAt,
        }
      });

          // ✅ Save user notification to DB then emit
      try {
        const userNotif = await createNotification({
          tenantId: tenant.id,
          userId:   contact.assignedTo,   // user-specific
          type:     'new_message',
          title:    notifTitle,
          message:  notifMessage,
          metadata: notifMeta,
        });

        emitToUser(contact.assignedTo, 'new_notification', {
          notification: {
            id:        userNotif.id,
            type:      userNotif.type,
            title:     userNotif.title,
            message:   userNotif.message,
            isRead:    userNotif.isRead,
            createdAt: userNotif.createdAt,
            metadata:  userNotif.metadata,
          },
        });
        console.log(`📤 User notif saved+emitted to: ${contact.assignedTo}`);
      } catch (err) {
        console.error('❌ User notification failed:', err.message);
      }

    } else {
      console.log(`ℹ️ Contact unassigned - tenant room notified only`);
    }

    console.log(`✅ Message processed: type=${type}, contact=${contact.name}`);
  }
};


// ─────────────────────────────────────────────────────────────
// DOWNLOAD WHATSAPP MEDIA
// Step 1: Get download URL from media ID
// Step 2: Download file with auth header
// Step 3: Save to tenant-isolated folder
// Step 4: Return permanent public URL
// ─────────────────────────────────────────────────────────────
const downloadWhatsAppMedia = async ({
  mediaId,
  mimeType,
  fileName,
  tenantId,
  contactId,
  accessToken,
}) => {

  // ── Step 1: Get temporary download URL ──────────────────
  const metaRes = await fetch(
    `https://graph.facebook.com/v23.0/${mediaId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  if (!metaRes.ok) {
    const err = await metaRes.json();
    throw new Error(`Meta media URL fetch failed: ${err.error?.message}`);
  }

  const metaData = await metaRes.json();
  const downloadUrl = metaData.url;  // temporary, expires soon

  if (!downloadUrl) {
    throw new Error('No download URL returned from Meta API');
  }

  // ── Step 2: Build save path ──────────────────────────────
  const saveDir = path.join(
    process.cwd(),
    'uploads',
    'tenants',
    tenantId,
    'contacts',
    contactId,
    'inbound'
  );

  fs.mkdirSync(saveDir, { recursive: true });

  // ── Step 3: Build filename ───────────────────────────────
  const ext = getExtFromMime(mimeType);
  const baseName = fileName
    ? path.basename(fileName, path.extname(fileName))
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .substring(0, 50)
    : `media_${mediaId}`;

  const uniqueFileName = `${Date.now()}_${baseName}${ext}`;
  const localPath = path.join(saveDir, uniqueFileName);

  // ── Step 4: Download file ────────────────────────────────
  await new Promise((resolve, reject) => {
    const urlObj = new URL(downloadUrl);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,  // ✅ Required for WhatsApp CDN
      },
    };

    const fileStream = fs.createWriteStream(localPath);

    const request = protocol.request(options, (response) => {

      if (response.statusCode !== 200) {
        fileStream.close();
        if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
        return reject(
          new Error(`Download failed with status: ${response.statusCode}`)
        );
      }

      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });

      fileStream.on('error', (err) => {
        if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
        reject(err);
      });
    });

    request.on('error', (err) => {
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
      reject(err);
    });

    // 30 second timeout
    request.setTimeout(30000, () => {
      request.destroy();
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
      reject(new Error(`Media download timed out: ${mediaId}`));
    });

    request.end();
  });

  // ── Step 5: Get file size ────────────────────────────────
  const stats = fs.statSync(localPath);
  const fileSize = stats.size;

  // ── Step 6: Build permanent public URL ──────────────────
  const relativePath = path
    .join('uploads', 'tenants', tenantId, 'contacts', contactId, 'inbound', uniqueFileName)
    .replace(/\\/g, '/');

  const publicUrl = process.env.BASE_URL && process.env.BASE_URL.startsWith('http') && !process.env.BASE_URL.includes('localhost')
    ? `${process.env.BASE_URL.replace(/\/+$/, '')}/${relativePath}`
    : relativePath;

  console.log(`✅ Media saved: ${localPath} (${fileSize} bytes)`);

  return {
    publicUrl,
    fileName: uniqueFileName,
    localPath,
    fileSize,
  };
};


// ─────────────────────────────────────────────────────────────
// MIME TYPE → FILE EXTENSION
// ─────────────────────────────────────────────────────────────
const MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/3gpp': '.3gp',
  'audio/mpeg': '.mp3',
  'audio/ogg': '.ogg',
  'audio/ogg; codecs=opus': '.ogg',
  'audio/m4a': '.m4a',
  'audio/amr': '.amr',
  'audio/mp4': '.mp4',
  'audio/webm': '.webm',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'text/plain': '.txt',
  'image/webp; codecs=vp8': '.webp',  // sticker format
};

const getExtFromMime = (mimeType) => {
  if (!mimeType) return '.bin';
  // Handle mime types with params like "audio/ogg; codecs=opus"
  const baseMime = mimeType.split(';')[0].trim().toLowerCase();
  return MIME_TO_EXT[mimeType] || MIME_TO_EXT[baseMime] || '.bin';
};


// ─────────────────────────────────────────────────────────────
// WORKER STARTUP (unchanged)
// ─────────────────────────────────────────────────────────────
export const startWebhookWorker = () => {
  const worker = new Worker(
    QUEUE_NAME_WEBHOOK,
    processWebhookJob,
    {
      connection: redisConnection,
      concurrency: 10,
    }
  );

  worker.on('completed', (job) => {
    console.log(`✅ Webhook Job ${job.id} processed successfully`);
  });

  worker.on('failed', async (job, err) => {
    console.error(`❌ Webhook Job ${job?.id} failed:`, err.message);

    if (job && job.attemptsMade >= job.opts.attempts) {
      try {
        await dlqQueue.add(
          'failed-webhook',
          {
            originalJobId: job.id,
            originalJobName: job.name,
            originalData: job.data,
            failedAt: new Date().toISOString(),
            attempts: job.attemptsMade,
            errorMessage: err.message,
            errorStack: err.stack,
            errorName: err.name,
            originalQueue: QUEUE_NAME_WEBHOOK,
            processingTime: job.processedOn ? Date.now() - job.processedOn : null,
          },
          { jobId: `dlq_${job.id}_${Date.now()}` }
        );

        console.warn(`📮 [DLQ] Job ${job.id} moved to DLQ after ${job.attemptsMade} attempts`);

      } catch (dlqError) {
        console.error(`⚠️ [DLQ] Failed to push to DLQ:`, dlqError.message);
      }
    }
  });

  console.log('👷 Webhook worker started with DLQ support');
  return worker;
};