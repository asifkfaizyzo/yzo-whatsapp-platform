import { Worker } from 'bullmq';
import { QUEUE_NAME_WEBHOOK } from '../queues/webhookQueue.js';
import { redisConnection } from '../config/redis.js';
import prisma from '../config/prisma.js';
import { handleIncomingMessage } from '../modules/messages/messageService.js';
import { emitToTenant } from '../lib/socket.js';

export const processWebhookJob = async (job) => {
  const body = job.data;
  if (!body || body.object !== 'whatsapp_business_account') return;

  const entry = body.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  const message = value?.messages?.[0];
  const statusUpdate = value?.statuses?.[0];

  // ───────────────── A. Handle Delivery status receipts ─────────────────
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
        data: {
          status: updatedStatus,
          ...updateData
        }
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

    const tenant = await prisma.tenant.findFirst({
      where: { whatsappPhoneId: phoneId }
    });

    if (tenant && text) {
      // Check active subscription status
      const subStatus = tenant.subscriptionStatus;
      const isActive = subStatus === 'active' || subStatus === 'trialing' || subStatus === 'cancel_at_period_end';
      if (!isActive) {
        console.log(`🚫 Webhook ignored for tenant ${tenant.id} due to inactive/expired subscription status: ${subStatus}`);
        return;
      }

      // ✅ Normalize phone: strip any leading '+' then re-add one → always "+918596857485"
      // WhatsApp sends message.from as "918596857485" (no +) but sometimes test payloads
      // or retries can have "+918596857485" already, causing "++918596857485" double-plus.
      const normalizedPhone = `+${customerPhone.replace(/^\+/, '')}`

      console.log(`📱 Normalized phone: ${normalizedPhone}`)

      let contact = await prisma.contact.findFirst({
        where: { phone: normalizedPhone, tenantId: tenant.id }
      });

      // ✅ Track whether this is a brand-new contact (first message ever)
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
        console.log(`🆕 New contact created: ${contact.name} (${normalizedPhone})`)
      } else {
        console.log(`♻️  Existing contact found: ${contact.name} (${normalizedPhone})`)
      }

      const result = await handleIncomingMessage({
        contactId: contact.id,
        tenantId: tenant.id,
        text: text,
        type: 'TEXT',
        isNewContact  // ✅ Pass the flag so the flow engine can use it
      });

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
};

export const startWebhookWorker = () => {
  const worker = new Worker(
    QUEUE_NAME_WEBHOOK,
    processWebhookJob,
    {
      connection: redisConnection,
      concurrency: 10 // Process up to 10 webhook payloads concurrently
    }
  );

  worker.on('completed', (job) => {
    console.log(`✅ Webhook Job ${job.id} processed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ Webhook Job ${job?.id} failed:`, err.message);
  });

  return worker;
};
