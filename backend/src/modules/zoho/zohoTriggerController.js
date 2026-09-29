// src/modules/zoho/zohoTriggerController.js

import prisma from '../../config/prisma.js';
import { sendMessageService } from '../messages/messageService.js';
import { emitToTenant } from '../../lib/socket.js';

/**
 * POST /api/zoho/trigger/message
 * Allows Zoho CRM Workflows / Deluge scripts to trigger an outbound WhatsApp message.
 *
 * Payload:
 * {
 *   "tenantId": "cmuchrebc0000w3l4okcd8uqg",
 *   "phone": "+919876543210",
 *   "message": "Hi John, your order has been confirmed!",
 *   "secretKey": "optional_webhook_secret"
 * }
 */
export const triggerOutboundMessage = async (req, res) => {
  try {
    const { tenantId, phone, message, contactId } = req.body;

    if (!tenantId || (!phone && !contactId) || !message) {
      return res.status(400).json({
        success: false,
        message: 'tenantId, message, and either phone or contactId are required',
      });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId, zohoConnectionStatus: 'CONNECTED' },
      select: { id: true, tenantName: true },
    });

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Active Zoho-connected tenant not found' });
    }

    let targetContact;
    if (contactId) {
      targetContact = await prisma.contact.findFirst({ where: { id: contactId, tenantId } });
    } else {
      const cleanPhone = `+${phone.replace(/\D/g, '')}`;
      targetContact = await prisma.contact.findFirst({
        where: { phone: cleanPhone, tenantId },
      });

      if (!targetContact) {
        targetContact = await prisma.contact.create({
          data: {
            name: cleanPhone,
            phone: cleanPhone,
            tenantId,
            whatsappId: cleanPhone.slice(-10),
          },
        });
      }
    }

    const sentMessage = await sendMessageService({
      contactId: targetContact.id,
      tenantId: tenant.id,
      senderId: tenant.id,
      senderType: 'SYSTEM',
      text: message,
    });

    emitToTenant(tenant.id, 'new_message', {
      conversationId: sentMessage.conversationId,
      message: {
        id: sentMessage.id,
        type: 'TEXT',
        text: sentMessage.text,
        senderType: 'SYSTEM',
        direction: 'OUTBOUND',
        isFromCustomer: false,
        createdAt: sentMessage.createdAt,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'WhatsApp message triggered successfully from Zoho CRM',
      data: { messageId: sentMessage.id, conversationId: sentMessage.conversationId },
    });
  } catch (error) {
    console.error('❌ [ZohoTrigger] Error sending message:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};