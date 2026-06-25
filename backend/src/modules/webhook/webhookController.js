// backend/src/modules/webhook/webhookController.js
import prisma from '../../config/prisma.js';
import { handleIncomingMessage } from '../messages/messageService.js';
import { emitToTenant } from '../../lib/socket.js';

// Insert the 'verifyMetaSignature' middleware right below the imports:
export const verifyMetaSignature = (req, res, next) => {
  const appSecret = process.env.META_APP_SECRET;
  // Fallback: If App Secret is not configured in .env, log a warning but allow requests
  // (Prevents breaking local dev setup)
  if (!appSecret) {
    console.warn('⚠️ META_APP_SECRET is not configured in .env. Skipping signature verification.');
    return next();
  }
  const signatureHeader = req.headers['x-hub-signature-256'];
  if (!signatureHeader) {
    console.warn('⚠️ Incoming webhook request missing x-hub-signature-256 header.');
    return res.status(401).send('Signature missing');
  }
  const signature = signatureHeader.split('sha256=')[1];
  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(req.rawBody || '')
    .digest('hex');
  if (signature !== expectedSignature) {
    console.warn('⚠️ Webhook signature validation failed! Request unauthorized.');
    return res.status(401).send('Invalid signature');
  }
  next();
};

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


// POST: Event Notification receiver for WhatsApp messages AND delivery status receipts
export const receiveMetaWebhookEvent = async (req, res) => {
  try {
    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const message = value?.messages?.[0];
      const statusUpdate = value?.statuses?.[0]; // WhatsApp Message Status Receipts

      // ───────────────── A. Handle Delivery status receipts ─────────────────
      if (statusUpdate) {
        const wamid = statusUpdate.id; // Meta Message ID
        const status = statusUpdate.status; // sent, delivered, read, failed

        // Find recipient record matching this WhatsApp message ID
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

          // Update individual status record
          await prisma.broadcastRecipient.update({
            where: { wamid },
            data: {
              status: updatedStatus,
              ...updateData
            }
          });

          // Recalculate and update Campaign counter fields
          const broadcastId = recipient.broadcastId;
          const broadcast = await prisma.broadcast.update({
            where: { id: broadcastId },
            data: {
              delivered: status === 'delivered' ? { increment: 1 } : undefined,
              read: status === 'read' ? { increment: 1 } : undefined,
              failed: status === 'failed' ? { increment: 1 } : undefined
            }
          });

          // Emit progress details over Socket to reload the frontend counters
          emitToTenant(recipient.broadcast.tenantId, 'broadcast_update', {
            broadcastId,
            sent: broadcast.sent,
            delivered: broadcast.delivered,
            read: broadcast.read,
            failed: broadcast.failed
          });
        }
      }

      // ───────────────── B. Handle Incoming Messages ─────────────────
      if (message) {
        const phoneId = value.metadata?.phone_number_id; 
        const customerPhone = message.from; 
        const text = message.text?.body; 

        // Query Tenant matching the incoming phone number ID
        const tenant = await prisma.tenant.findFirst({
          where: { whatsappPhoneId: phoneId }
        });

        if (tenant && text) {
          // Query or create the Contact record under this Tenant
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

          // Forward message payload into existing chat pipeline
          const result = await handleIncomingMessage({
            contactId: contact.id,
            tenantId: tenant.id,
            text: text,
            type: 'TEXT'
          });

          // Emit Socket Event to update inbox chat box
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