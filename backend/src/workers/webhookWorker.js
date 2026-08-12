// src/workers/webhookWorker.js

import { Worker } from 'bullmq';
import { QUEUE_NAME_WEBHOOK } from '../queues/webhookQueue.js';
import { redisConnection } from '../config/redis.js';
import prisma from '../config/prisma.js';
import { handleIncomingMessage } from '../modules/messages/messageService.js';
import { emitToTenant, emitToUser } from '../lib/socket.js';
import { isNewWebhookEvent } from '../lib/idempotency.js';
import { dlqQueue } from '../queues/dlqQueue.js';
import { generateSignedUrl } from '../lib/utils/signedUrl.js';
import { decrypt } from '../lib/crypto.js';
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
      let updatedStatus = 'SENT';
      const updateData = {};

      if (status === 'delivered') {
        updatedStatus = 'DELIVERED';
        updateData.deliveredAt = new Date();
      } else if (status === 'read') {
        updatedStatus = 'READ';
        updateData.readAt = new Date();
      } else if (status === 'failed') {
        updatedStatus = 'FAILED';
        updateData.failedAt = new Date();
        updateData.errorMessage = statusUpdate.errors?.[0]?.title || 'Meta Send Failure';
      }

      await prisma.broadcastRecipient.update({
        where: { wamid },
        data: { status: updatedStatus, ...updateData }
      });

      const broadcastId = recipient.broadcastId;
      const broadcast = await prisma.broadcast.update({
        where: { id: broadcastId },
        data: {
          delivered: status === 'delivered' ? { increment: 1 } : undefined,
          read: status === 'read' ? { increment: 1 } : undefined,
          failed: status === 'failed' ? { increment: 1 } : undefined
        }
      });

      emitToTenant(recipient.broadcast.tenantId, 'broadcast_update', {
        broadcastId,
        sent: broadcast.sent,
        delivered: broadcast.delivered,
        read: broadcast.read,
        failed: broadcast.failed
      });
    } else {
      // ── Handle 1-on-1 Message Status Receipt ──
      const messageToUpdate = await prisma.message.findUnique({
        where: { wamid },
      });
      if (messageToUpdate) {
        const msgUpdateData = { status };
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
      }
    }

    return; // ✅ status handled, stop here
  }


  // ═══════════════════════════════════════════════════════════
  // B. Handle Incoming Messages (TEXT + MEDIA)
  // ═══════════════════════════════════════════════════════════
  if (message) {
    const messageId = message.id;

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
    const notifMessage = text
      ? text.substring(0, 100)
      : `Sent a ${type.toLowerCase()}`;

    emitToTenant(tenant.id, 'new_notification', {
      notification: {
        id: `msg_tenant_${result.message.id}`,
        type: 'new_message',
        title: `New message from ${contact.name}`,
        message: notifMessage,
        isRead: false,
        createdAt: new Date(),
        metadata: {
          contactId: contact.id,
          conversationId: result.conversation.id,
        }
      }
    });

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

      emitToUser(contact.assignedTo, 'new_notification', {
        notification: {
          id: `msg_${result.message.id}`,
          type: 'new_message',
          title: `New message from ${contact.name}`,
          message: notifMessage,
          isRead: false,
          createdAt: new Date(),
          metadata: {
            contactId: contact.id,
            conversationId: result.conversation.id,
          }
        }
      });

      console.log(`📤 Notified assigned user: ${contact.assignedTo}`);
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

  const publicUrl = `${process.env.BASE_URL}/${relativePath}`;

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