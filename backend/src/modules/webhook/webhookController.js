// backend/src/modules/webhook/webhookController.js
import crypto from 'crypto';
import prisma from '../../config/prisma.js';
import { handleIncomingMessage } from '../messages/messageService.js';
import { emitToTenant } from '../../lib/socket.js';
import flowEngine from '../automation/flowEngineService.js'

export const verifyMetaSignature = (req, res, next) => {
  const appSecret = process.env.META_APP_SECRET;
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

export const verifyMetaWebhook = async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const verifyToken = process.env.META_VERIFY_TOKEN || 'yzo_default_verification_token';
  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ Webhook verified successfully by Meta!');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
};

export const receiveMetaWebhookEvent = async (req, res) => {
  try {
    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const message = value?.messages?.[0];
      const statusUpdate = value?.statuses?.[0];

      // ───────────────── A. Handle Delivery Status ─────────────────
      if (statusUpdate) {
        const wamid = statusUpdate.id;
        const status = statusUpdate.status;

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
        }
      }

      // ───────────────── B. Handle Incoming Messages ─────────────────
      if (message) {
        const phoneId = value.metadata?.phone_number_id;
        const customerPhone = message.from;
        const text = message.text?.body;

        // ⭐ DEBUG
        console.log('\n─────────────────────────────────')
        console.log('📨 INCOMING MESSAGE')
        console.log('   phoneId      :', phoneId)
        console.log('   customerPhone:', customerPhone)
        console.log('   text         :', text)
        console.log('─────────────────────────────────')

        // Find Tenant
        const tenant = await prisma.tenant.findFirst({
          where: { whatsappPhoneId: phoneId }
        });

        // ⭐ DEBUG
        console.log('🏢 Tenant found:', tenant ? tenant.id : 'NOT FOUND ❌')
        console.log('   whatsappPhoneId in DB:', tenant?.whatsappPhoneId)

        if (tenant && text) {

          // Find or Create Contact
          let contact = await prisma.contact.findFirst({
            where: {
              phone: `+${customerPhone}`,
              tenantId: tenant.id
            }
          });

          // ⭐ DEBUG
          console.log('👤 Contact search: +' + customerPhone)
          console.log('👤 Contact found:', contact ? contact.id : 'NOT FOUND - creating new')

          if (!contact) {
            contact = await prisma.contact.create({
              data: {
                name: value.contacts?.[0]?.profile?.name || customerPhone,
                phone: `+${customerPhone}`,
                tenantId: tenant.id,
                whatsappId: customerPhone.slice(-10)
              }
            });
            console.log('✅ New contact created:', contact.id)
          }

          // ⭐ DEBUG
          console.log('👤 Final Contact ID   :', contact.id)
          console.log('👤 Final Contact Phone:', contact.phone)

          // Save message to DB
          const result = await handleIncomingMessage({
            contactId: contact.id,
            tenantId: tenant.id,
            text: text,
            type: 'TEXT'
          });

          // ⭐ DEBUG
          console.log('💬 Conversation ID    :', result.conversation.id)
          console.log('💬 Conversation Status:', result.conversation.status)
          console.log('💬 Conversation Mode  :', result.conversation.mode)
          console.log('💬 CurrentNodeId      :', result.conversation.currentNodeId)

          // Emit to agent dashboard
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

          // Get fresh conversation for flow engine
          const conversation = await prisma.conversation.findUnique({
            where: { id: result.conversation.id }
          });

          // ⭐ DEBUG
          console.log('🤖 Fresh conversation for engine:')
          console.log('   ID           :', conversation?.id)
          console.log('   Mode         :', conversation?.mode)
          console.log('   CurrentNodeId:', conversation?.currentNodeId)
          console.log('   CurrentFlowId:', conversation?.currentFlowId)
          console.log('   BotPaused    :', conversation?.botPaused)

          // Run Flow Engine
          if (conversation) {
            await flowEngine.processIncomingMessage(
              conversation,
              contact,
              text
            );
          }
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