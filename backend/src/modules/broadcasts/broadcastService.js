import prisma from '../../config/prisma.js';
import { getOrCreateConversation } from '../conversations/conversationService.js';
import { emitToTenant } from '../../lib/socket.js';
import { decrypt } from '../../lib/crypto.js';
import { broadcastQueue } from '../../queues/broadcastQueue.js';

// Send individual Template request to Meta Cloud API
const sendMetaTemplateMessage = async (tenant, phone, templateName, languageCode, params) => {
  const cleanPhone = phone.replace('+', ''); // Meta expects phone without + prefix
  const url = `https://graph.facebook.com/v23.0/${tenant.whatsappPhoneId}/messages`;

  // Map parameters into Meta's structure: [ { type: "text", text: "..." } ]
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

  return resJson; // returns e.g. { messages: [ { id: "wamid.xxx" } ] }
};

// Formats body text to replace {{1}}, {{2}} with parameter arrays
const formatMessageText = (templateText, paramsArray) => {
  if (!templateText) return '';
  let formatted = templateText;
  (paramsArray || []).forEach((val, idx) => {
    formatted = formatted.replace(new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g'), val);
  });
  return formatted;
};

// Simulate delivery status flow for Sandbox Demo (Sent → Delivered → Read)
const simulateRecipientReceipt = (tenantId, broadcastId, recipientId, wamid) => {
  // 1. Deliver after 2 seconds
  setTimeout(async () => {
    try {
      const recipient = await prisma.broadcastRecipient.update({
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

      // 2. Read after 4 seconds
      setTimeout(async () => {
        try {
          const recipientRead = await prisma.broadcastRecipient.update({
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

export const processBroadcastCampaign = async (broadcastId, tenant, contacts, template, defaultParams, delayMs = 0) => {
  if (!contacts || contacts.length === 0) {
    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: { status: 'COMPLETED', completedAt: new Date() }
    });
    return;
  }

  // Map contacts to BullMQ job payload format
  const jobs = contacts.map((contact) => ({
    name: `broadcast-${broadcastId}-${contact.id}`,
    data: {
      broadcastId,
      tenant,
      contact,
      template,
      defaultParams
    },
    opts: {
      delay: delayMs > 0 ? delayMs : undefined,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 3000
      }
    }
  }));

  // Add bulk jobs to BullMQ queue
  await broadcastQueue.addBulk(jobs);

  if (delayMs > 0) {
    console.log(`⏰ Scheduled ${jobs.length} broadcast recipient jobs for campaign ${broadcastId} (executing in ${Math.round(delayMs / 1000)} seconds)`);
  } else {
    console.log(`🚀 Queued ${jobs.length} broadcast recipient jobs for campaign ${broadcastId}`);
  }
};
