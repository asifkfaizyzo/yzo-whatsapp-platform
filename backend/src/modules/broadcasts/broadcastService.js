import prisma from '../../config/prisma.js';
import { getOrCreateConversation } from '../conversations/conversationService.js';
import { emitToTenant } from '../../lib/socket.js';

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
      'Authorization': `Bearer ${tenant.whatsappAccessToken}`,
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

export const processBroadcastCampaign = async (broadcastId, tenant, contacts, template, defaultParams) => {
  const hasMetaConfig = tenant.whatsappWabaId && tenant.whatsappAccessToken && tenant.whatsappPhoneId;
  
  // Extract body component text from local template model
  const bodyComp = (template.components || []).find(c => c.type === 'BODY');
  const templateText = bodyComp ? bodyComp.text : '';

  let sentCount = 0;
  let failedCount = 0;

  for (const contact of contacts) {
    const wamid = hasMetaConfig
      ? null
      : `wamid.mock_${broadcastId}_${contact.id}_${Date.now()}`;

    // Resolve parameters values (e.g. replace special tags like '{{contact_name}}' with contact.name)
    const bodyParams = (defaultParams?.body || []).map(val => {
      if (val === '{{contact_name}}') return contact.name;
      if (val === '{{contact_phone}}') return contact.phone;
      if (val === '{{contact_company}}') return contact.company || '';
      return val;
    });

    const parsedText = formatMessageText(templateText, bodyParams);

    try {
      if (hasMetaConfig) {
        // Send via Real Meta API
        const metaRes = await sendMetaTemplateMessage(tenant, contact.phone, template.name, template.language, { body: bodyParams });
        const finalWamid = metaRes.messages?.[0]?.id;

        await prisma.broadcastRecipient.update({
          where: { broadcastId_contactId: { broadcastId, contactId: contact.id } },
          data: {
            status: 'SENT',
            wamid: finalWamid,
            sentAt: new Date()
          }
        });
      } else {
        // Run Sandbox Simulation
        const recipientRecord = await prisma.broadcastRecipient.update({
          where: { broadcastId_contactId: { broadcastId, contactId: contact.id } },
          data: {
            status: 'SENT',
            wamid: wamid,
            sentAt: new Date()
          }
        });

        // Trigger asynchronous delayed progress
        simulateRecipientReceipt(tenant.id, broadcastId, recipientRecord.id, wamid);
      }

      // Add to normal conversation log so agents see it in Inbox
      const conversation = await getOrCreateConversation(contact.id, tenant.id);
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: tenant.id, // Associated with the Tenant Admin
          senderType: 'TENANT',
          text: parsedText,
          type: 'TEXT',
          isRead: true
        }
      });

      // Update conversation timestamp
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() }
      });

      sentCount++;
    } catch (error) {
      console.error(`Failed to send broadcast to recipient contact ${contact.phone}:`, error.message);
      
      await prisma.broadcastRecipient.update({
        where: { broadcastId_contactId: { broadcastId, contactId: contact.id } },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          errorMessage: error.message
        }
      });
      failedCount++;
    }

    // Update denormalized campaign metrics in database and emit websocket progress
    const updatedCampaign = await prisma.broadcast.update({
      where: { id: broadcastId },
      data: {
        sent: { increment: hasMetaConfig ? 1 : 1 }, // both modes increment sent
        failed: { increment: failedCount > 0 ? 1 : 0 }
      }
    });

    emitToTenant(tenant.id, 'broadcast_update', {
      broadcastId,
      sent: updatedCampaign.sent,
      delivered: updatedCampaign.delivered,
      read: updatedCampaign.read,
      failed: updatedCampaign.failed
    });

    // Reset loop variables
    failedCount = 0;
  }

  // Update Campaign state to COMPLETED
  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date()
    }
  });
};