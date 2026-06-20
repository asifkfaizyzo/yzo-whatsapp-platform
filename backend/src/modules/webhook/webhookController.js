// backend/src/modules/webhook/webhookController.js
import prisma from '../../config/prisma.js';
import { handleIncomingMessage } from '../messages/messageService.js';
import { emitToTenant } from '../../lib/socket.js';

// 1. GET: Handshake Verification for Meta
export const verifyMetaWebhook = async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // Fallback verify token (matches default in schema or .env)
  const verifyToken = process.env.META_VERIFY_TOKEN || 'yzo_default_verification_token';

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ Webhook verified successfully by Meta!');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
};

// 2. POST: Event Notification receiver for WhatsApp messages
export const receiveMetaWebhookEvent = async (req, res) => {
  try {
    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const message = value?.messages?.[0];

      if (message) {
        const phoneId = value.metadata?.phone_number_id; 
        const customerPhone = message.from; 
        const text = message.text?.body; 

        // 1. Query Tenant matching the incoming phone number ID
        const tenant = await prisma.tenant.findFirst({
          where: { whatsappPhoneId: phoneId }
        });

        if (tenant && text) {
          // 2. Query or create the Contact record under this Tenant
          let contact = await prisma.contact.findFirst({
            where: { phone: `+${customerPhone}`, tenantId: tenant.id }
          });

          if (!contact) {
            contact = await prisma.contact.create({
              data: {
                name: value.contacts?.[0]?.profile?.name || customerPhone,
                phone: `+${customerPhone}`,
                tenantId: tenant.id,
                whatsappId: customerPhone.slice(-10)
              }
            });
          }

          // 3. Forward message payload into your existing chat pipeline
          const result = await handleIncomingMessage({
            contactId: contact.id,
            tenantId: tenant.id,
            text: text,
            type: 'TEXT'
          });

          // ─── ADDED: Emit Socket Event ───
          emitToTenant(tenant.id, 'new_message', {
            conversationId: result.conversation.id,
            message: {
              id: result.message.id,
              text: result.message.text,
              senderId: result.message.senderId,
              isFromCustomer: true,
              createdAt: result.message.createdAt
            }
          });
          
        }
      }
      return res.status(200).send('EVENT_RECEIVED');
    }
    return res.sendStatus(404);
  } catch (err) {
    console.error('Webhook processing error:', err);
    return res.sendStatus(500);
  }
};