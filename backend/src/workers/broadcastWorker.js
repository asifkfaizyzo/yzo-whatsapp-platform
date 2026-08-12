import { Worker } from 'bullmq';
import { QUEUE_NAME_BROADCAST } from '../queues/broadcastQueue.js';
import { redisConnection } from '../config/redis.js';
import prisma from '../config/prisma.js';
import { getOrCreateConversation } from '../modules/conversations/conversationService.js';
import { emitToTenant } from '../lib/socket.js';
import { decrypt } from '../lib/crypto.js';

// Send Meta Cloud API request
const sendMetaTemplateMessage = async (tenant, phone, templateName, languageCode, params) => {
  const cleanPhone = phone.replace('+', '');
  const url = `https://graph.facebook.com/v23.0/${tenant.whatsappPhoneId}/messages`;

  const bodyParameters = (params?.body || []).map(val => ({
    type: 'text',
    text: String(val)
  }));

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanPhone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode || 'en_US' },
      components: bodyParameters.length > 0 ? [{
        type: 'body',
        parameters: bodyParameters
      }] : []
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

  const hasMetaConfig = tenant.whatsappWabaId && tenant.whatsappAccessToken && tenant.whatsappPhoneId;

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
      const metaRes = await sendMetaTemplateMessage(tenant, contact.phone, template.name, template.language, { body: bodyParams });
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

    // Add to normal conversation log so agents see it in Inbox
    const conversation = await getOrCreateConversation(contact.id, tenant.id);
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: tenant.id,
        senderType: 'TENANT',
        text: parsedText,
        type: 'TEXT',
        isRead: true
      }
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() }
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


