import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import { Worker } from 'bullmq';
import { QUEUE_NAME_BROADCAST } from '../queues/broadcastQueue.js';
import { redisConnection } from '../config/redis.js';
import prisma from '../config/prisma.js';
import { getOrCreateConversation } from '../modules/conversations/conversationService.js';
import { emitToTenant } from '../lib/socket.js';
import { decrypt } from '../lib/crypto.js';
import { generateSignedUrl } from '../lib/utils/signedUrl.js';

const MEDIA_HEADER_TYPES = ['IMAGE', 'VIDEO', 'DOCUMENT'];


const sendMetaTemplateMessage = async (tenant, phone, templateName, languageCode, params, template) => {
  const cleanPhone = phone.replace('+', '');
  const url = `https://graph.facebook.com/v23.0/${tenant.whatsappPhoneId}/messages`;

  const templateComponents = [];

  // ── HEADER component ─────────────────────────────────────────────────────
  const headerType = template?.headerType || 'NONE';

  if (headerType === 'TEXT' && template.headerText) {
    templateComponents.push({
      type: 'header',
      parameters: [{ type: 'text', text: template.headerText }]
    });

  } else if (headerType === 'IMAGE' && template.headerMediaHandle) {
    templateComponents.push({
      type: 'header',
      parameters: [{ type: 'image', image: { id: template.headerMediaHandle } }]
    });

  } else if (headerType === 'VIDEO' && template.headerMediaHandle) {
    templateComponents.push({
      type: 'header',
      parameters: [{ type: 'video', video: { id: template.headerMediaHandle } }]
    });

  } else if (headerType === 'DOCUMENT' && template.headerMediaHandle) {
    templateComponents.push({
      type: 'header',
      parameters: [{ type: 'document', document: { id: template.headerMediaHandle } }]
    });

  } else if (headerType === 'LOCATION') {
    // Location data can be overridden per-broadcast via params.location
    const loc = params?.location || {};
    templateComponents.push({
      type: 'header',
      parameters: [{
        type: 'location',
        location: {
          latitude:  String(loc.lat  ?? template.headerLocationLat  ?? 0),
          longitude: String(loc.lng  ?? template.headerLocationLng  ?? 0),
          name:      loc.name    ?? template.headerLocationName    ?? '',
          address:   loc.address ?? template.headerLocationAddress ?? '',
        }
      }]
    });

  } else if (MEDIA_HEADER_TYPES.includes(headerType) && !template.headerMediaHandle) {
    // Guard: media template with no handle — log and skip sending to avoid Meta error
    throw new Error(`Template "${templateName}" has ${headerType} header but no media handle stored. Cannot send.`);
  }

  // ── BODY component ───────────────────────────────────────────────────────
  const bodyParameters = (params?.body || []).map(val => ({
    type: 'text',
    text: String(val)
  }));

  if (bodyParameters.length > 0) {
    templateComponents.push({
      type: 'body',
      parameters: bodyParameters
    });
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanPhone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode || 'en_US' },
      components: templateComponents
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${decrypt(tenant.whatsappAccessToken)}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const resJson = await response.json();
  if (!response.ok) {
    throw new Error(resJson.error?.message || 'Meta template send failed');
  }

  return resJson;
};

const formatMessageText = (templateText, paramsArray) => {
  if (!templateText) return '';
  let formatted = templateText;
  (paramsArray || []).forEach((val, idx) => {
    formatted = formatted.replace(new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g'), val);
  });
  return formatted;
};

// Simulate delivery status flow for Sandbox Demo
const simulateRecipientReceipt = (tenantId, broadcastId, recipientId, wamid) => {
  setTimeout(async () => {
    try {
      await prisma.broadcastRecipient.update({
        where: { id: recipientId, status: 'SENT' },
        data: { status: 'DELIVERED', deliveredAt: new Date() }
      });

      const updatedBroadcast = await prisma.broadcast.update({
        where: { id: broadcastId },
        data: { delivered: { increment: 1 } }
      });

      emitToTenant(tenantId, 'broadcast_update', {
        broadcastId,
        sent: updatedBroadcast.sent,
        delivered: updatedBroadcast.delivered,
        read: updatedBroadcast.read,
        failed: updatedBroadcast.failed
      });

      setTimeout(async () => {
        try {
          await prisma.broadcastRecipient.update({
            where: { id: recipientId, status: 'DELIVERED' },
            data: { status: 'READ', readAt: new Date() }
          });

          const updatedBroadcast2 = await prisma.broadcast.update({
            where: { id: broadcastId },
            data: { read: { increment: 1 } }
          });

          emitToTenant(tenantId, 'broadcast_update', {
            broadcastId,
            sent: updatedBroadcast2.sent,
            delivered: updatedBroadcast2.delivered,
            read: updatedBroadcast2.read,
            failed: updatedBroadcast2.failed
          });
        } catch (e) {}
      }, 4000);

    } catch (e) {}
  }, 2000);
};

export const processBroadcastRecipientJob = async (job) => {
  const { broadcastId, tenant, contact, template, defaultParams } = job.data;

  // Check if campaign was cancelled before sending
  const currentCampaign = await prisma.broadcast.findUnique({
    where: { id: broadcastId },
    select: { status: true }
  });

  if (!currentCampaign || currentCampaign.status === 'CANCELLED') {
    console.log(`🚫 Broadcast job [${job.id}] skipped because campaign ${broadcastId} is CANCELLED.`);
    return;
  }

  // Transition campaign status from SCHEDULED -> PROCESSING when worker execution begins
  await prisma.broadcast.updateMany({
    where: { id: broadcastId, status: 'SCHEDULED' },
    data: { status: 'PROCESSING', startedAt: new Date() }
  });

  const hasMetaConfig = process.env.MOCK_WHATSAPP === 'true'
    ? false
    : (tenant.whatsappWabaId && tenant.whatsappAccessToken && tenant.whatsappPhoneId);

  const bodyComp = (template.components || []).find(c => c.type === 'BODY');
  const templateText = bodyComp ? bodyComp.text : '';

  const wamid = hasMetaConfig
    ? null
    : `wamid.mock_${broadcastId}_${contact.id}_${Date.now()}`;

  const bodyParams = (defaultParams?.body || []).map(val => {
    if (val === '{{contact_name}}') return contact.name;
    if (val === '{{contact_phone}}') return contact.phone;
    if (val === '{{contact_company}}') return contact.company || '';
    return val;
  });

  const parsedText = formatMessageText(templateText, bodyParams);

  try {
    let finalWamid = wamid;

    if (hasMetaConfig) {
      const metaRes = await sendMetaTemplateMessage(
        tenant,
        contact.phone,
        template.name,
        template.language,
        { body: bodyParams },
        template  // ← pass full template object for header component construction
      );
      finalWamid = metaRes.messages?.[0]?.id;

      await prisma.broadcastRecipient.update({
        where: { broadcastId_contactId: { broadcastId, contactId: contact.id } },
        data: {
          status: 'SENT',
          wamid: finalWamid,
          sentAt: new Date()
        }
      });
    } else {
      const recipientRecord = await prisma.broadcastRecipient.update({
        where: { broadcastId_contactId: { broadcastId, contactId: contact.id } },
        data: {
          status: 'SENT',
          wamid: wamid,
          sentAt: new Date()
        }
      });

      simulateRecipientReceipt(tenant.id, broadcastId, recipientRecord.id, wamid);
    }

    // Determine Message Type & Media / Location fields from template.headerType
    const headerType = template?.headerType || 'NONE';
    let messageType = 'TEXT';
    let mediaUrl = null;
    let mediaName = null;
    let mediaSize = null;
    let mediaMimeType = null;
    let locLatitude = null;
    let locLongitude = null;
    let locName = null;
    let locAddress = null;

    if (headerType === 'IMAGE') {
      messageType = 'IMAGE';
      mediaUrl = template.headerMediaUrl || null;
      if (mediaUrl) {
        mediaName = path.basename(mediaUrl);
        mediaMimeType = mime.lookup(mediaUrl) || 'image/jpeg';
        try {
          if (fs.existsSync(mediaUrl)) {
            mediaSize = fs.statSync(mediaUrl).size;
          }
        } catch (e) {}
      }
    } else if (headerType === 'VIDEO') {
      messageType = 'VIDEO';
      mediaUrl = template.headerMediaUrl || null;
      if (mediaUrl) {
        mediaName = path.basename(mediaUrl);
        mediaMimeType = mime.lookup(mediaUrl) || 'video/mp4';
        try {
          if (fs.existsSync(mediaUrl)) {
            mediaSize = fs.statSync(mediaUrl).size;
          }
        } catch (e) {}
      }
    } else if (headerType === 'DOCUMENT') {
      messageType = 'FILE';
      mediaUrl = template.headerMediaUrl || null;
      if (mediaUrl) {
        mediaName = path.basename(mediaUrl);
        mediaMimeType = mime.lookup(mediaUrl) || 'application/pdf';
        try {
          if (fs.existsSync(mediaUrl)) {
            mediaSize = fs.statSync(mediaUrl).size;
          }
        } catch (e) {}
      }
    } else if (headerType === 'LOCATION') {
      messageType = 'LOCATION';
      locLatitude = defaultParams?.location?.lat != null ? parseFloat(defaultParams.location.lat) : (template.headerLocationLat != null ? template.headerLocationLat : null);
      locLongitude = defaultParams?.location?.lng != null ? parseFloat(defaultParams.location.lng) : (template.headerLocationLng != null ? template.headerLocationLng : null);
      locName = defaultParams?.location?.name || template.headerLocationName || null;
      locAddress = defaultParams?.location?.address || template.headerLocationAddress || null;
    }

    // Format display text (include header text if TEXT header type)
    let messageText = parsedText;
    if (headerType === 'TEXT' && template.headerText) {
      messageText = `*${template.headerText}*\n\n${parsedText}`;
    }

    // Add to normal conversation log so agents see it in Inbox
    const conversation = await getOrCreateConversation(contact.id, tenant.id);
    const createdMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: tenant.id,
        senderType: 'TENANT',
        direction: 'OUTBOUND',
        type: messageType,
        text: messageText || null,
        caption: (messageType !== 'TEXT') ? (parsedText || null) : null,
        mediaUrl,
        mediaName,
        mediaSize,
        mediaMimeType,
        locLatitude,
        locLongitude,
        locName,
        locAddress,
        buttons: template.buttons || (Array.isArray(template.components) ? template.components.find(c => c.type === 'BUTTONS')?.buttons : null) || null,
        status: 'sent',
        wamid: finalWamid || wamid || null,
        isRead: true
      }
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() }
    });

    // Real-time socket emission for live Inbox updates
    let socketMediaUrl = null;
    if (createdMessage.mediaUrl) {
      socketMediaUrl = generateSignedUrl(createdMessage.mediaUrl, tenant.id);
    }

    emitToTenant(tenant.id, 'new_message', {
      conversationId: conversation.id,
      message: {
        id:             createdMessage.id,
        type:           createdMessage.type,
        text:           createdMessage.text,
        caption:        createdMessage.caption,
        senderId:       createdMessage.senderId,
        senderType:     createdMessage.senderType,
        direction:      'OUTBOUND',
        isFromCustomer: false,
        mediaUrl:       socketMediaUrl || createdMessage.mediaUrl,
        mediaName:      createdMessage.mediaName,
        mediaSize:      createdMessage.mediaSize,
        mediaMimeType:  createdMessage.mediaMimeType,
        locLatitude:    createdMessage.locLatitude,
        locLongitude:   createdMessage.locLongitude,
        locName:        createdMessage.locName,
        locAddress:     createdMessage.locAddress,
        buttons:        createdMessage.buttons,
        createdAt:      createdMessage.createdAt,
      },
    });

    const updatedCampaign = await prisma.broadcast.update({
      where: { id: broadcastId },
      data: { sent: { increment: 1 } }
    });


    emitToTenant(tenant.id, 'broadcast_update', {
      broadcastId,
      sent: updatedCampaign.sent,
      delivered: updatedCampaign.delivered,
      read: updatedCampaign.read,
      failed: updatedCampaign.failed
    });

  } catch (error) {
    console.error(`Failed to send broadcast to contact ${contact.phone}:`, error.message);

    await prisma.broadcastRecipient.update({
      where: { broadcastId_contactId: { broadcastId, contactId: contact.id } },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        errorMessage: error.message
      }
    });

    const updatedCampaign = await prisma.broadcast.update({
      where: { id: broadcastId },
      data: { failed: { increment: 1 } }
    });

    emitToTenant(tenant.id, 'broadcast_update', {
      broadcastId,
      sent: updatedCampaign.sent,
      delivered: updatedCampaign.delivered,
      read: updatedCampaign.read,
      failed: updatedCampaign.failed
    });

    throw error; // Rethrow so BullMQ records job failure and retries if configured
  }
};

export const startBroadcastWorker = () => {
  const worker = new Worker(
    QUEUE_NAME_BROADCAST,
    processBroadcastRecipientJob,
    {
      connection: redisConnection,
      concurrency: 20,
      limiter: {
        max: 50,
        duration: 1000
      }
    }
  );

  worker.on('active', (job) => {
    console.log(`📩 Processing broadcast job [${job.id}] for recipient: ${job.data?.contact?.phone}`);
  });

  worker.on('completed', (job) => {
    console.log(`✅ Broadcast Job [${job.id}] completed successfully`);
    const { broadcastId } = job.data;
    checkCampaignCompletion(broadcastId);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ Broadcast Job [${job?.id}] failed:`, err.message);
    if (job?.data?.broadcastId) {
      checkCampaignCompletion(job.data.broadcastId);
    }
  });

  return worker;
};

// Helper function to check if all recipient records for campaign are finished
const checkCampaignCompletion = async (broadcastId) => {
  try {
    const pendingCount = await prisma.broadcastRecipient.count({
      where: { broadcastId, status: 'PENDING' }
    });

    if (pendingCount === 0) {
      // Atomically update status only if it hasn't already been marked COMPLETED
      const result = await prisma.broadcast.updateMany({
        where: { id: broadcastId, status: 'PROCESSING' },
        data: {
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });

      if (result.count > 0) {
        console.log(`🎉 Broadcast campaign ${broadcastId} fully COMPLETED!`);
      }
    }
  } catch (e) {
    console.error('Error checking campaign completion status:', e.message);
  }
};


