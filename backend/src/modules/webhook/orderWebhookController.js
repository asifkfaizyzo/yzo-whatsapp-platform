// backend/src/modules/webhook/orderWebhookController.js
import crypto from 'crypto';
import prisma from '../../config/prisma.js';
import { decrypt } from '../../lib/crypto.js';
import { orderWebhookQueue } from '../../queues/orderWebhookQueue.js';
import { emitToTenant } from '../../lib/socket.js';
import { createNotification } from '../notifications/notificationService.js';
import flowEngine from '../automation/flowEngineService.js';
import { logLeadStatusToSheet } from '../google-sheets/googleSheetsService.js';

/**
 * Phase 1: Ingest Razorpay Webhook (< 200ms)
 * Validates tenant, checks secret, validates HMAC-SHA256, enqueues to BullMQ, and acknowledges.
 */
export const handleTenantOrderWebhook = async (req, res) => {
  const { tenantId } = req.params;

  try {
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant ID required' });
    }

    // 1. Check tenant existence
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        razorpayWebhookSecret: true,
        enableOnlinePayment: true,
        enableCod: true,
      }
    });

    if (!tenant) {
      console.warn(`⚠️ [OrderWebhook] Received webhook for non-existent tenant: ${tenantId}`);
      // Respond 200 so Razorpay stops retrying permanently for invalid tenant IDs
      return res.status(200).json({ status: 'ignored', reason: 'tenant_not_found' });
    }

    if (!tenant.razorpayWebhookSecret) {
      console.warn(`⚠️ [OrderWebhook] Tenant ${tenantId} does not have a webhook secret configured`);
      return res.status(200).json({ status: 'ignored', reason: 'webhook_secret_not_configured' });
    }

    // 2. Validate HMAC-SHA256 signature
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      console.warn(`⚠️ [OrderWebhook] Missing x-razorpay-signature header from tenant ${tenantId}`);
      return res.status(400).json({ success: false, error: 'Missing webhook signature' });
    }

    let webhookSecret;
    try {
      webhookSecret = decrypt(tenant.razorpayWebhookSecret);
    } catch (decryptErr) {
      console.error(`❌ [OrderWebhook] Failed to decrypt webhook secret for tenant ${tenantId}:`, decryptErr.message);
      return res.status(500).json({ success: false, error: 'Internal security error' });
    }

    // Verify HMAC over req.rawBody (or stringified req.body if raw body buffer is missing)
    const rawPayload = req.rawBody || Buffer.from(JSON.stringify(req.body));
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawPayload)
      .digest('hex');

    const sigBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      console.warn(`❌ [OrderWebhook] Signature mismatch for tenant ${tenantId}`);
      return res.status(400).json({ success: false, error: 'Invalid signature' });
    }


    // 3. Extract event ID and metadata
    const event = req.body?.event;
    const payload = req.body?.payload;
    const eventEntity = payload?.payment_link?.entity ||
                        payload?.payment?.entity ||
                        payload?.refund?.entity;

    const eventId = eventEntity?.id ||
                    req.headers['x-razorpay-event-id'] ||
                    `${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // 4. Enqueue into BullMQ Order Webhook Queue
    await orderWebhookQueue.add(
      'order-webhook-events',
      {
        tenantId,
        eventId,
        event,
        payload,
        receivedAt: new Date().toISOString(),
      },
      {
        jobId: `rzp_${event}_${eventId}`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 10000 }
      }
    );

    console.log(`📥 [OrderWebhook] Enqueued ${event} (ID: ${eventId}) for tenant ${tenantId}`);
    return res.status(200).json({ status: 'ok', received: true });

  } catch (error) {
    console.error('❌ [OrderWebhook] Ingestion error:', error);
    return res.status(500).json({ success: false, error: 'Webhook ingestion failed' });
  }
};

/**
 * Phase 1 Partner Webhook Handler: POST /api/webhook/razorpay/partner
 * Handles programmatic webhooks from sub-merchant accounts and partner lifecycle events.
 * Strict deterministic signature routing (zero fallback vulnerability).
 */
export const handlePartnerWebhook = async (req, res) => {
  try {
    const event = req.body?.event;
    const accountId = req.body?.account_id || req.headers['x-razorpay-account-id'];
    const signature = req.headers['x-razorpay-signature'];

    if (!event) {
      return res.status(400).json({ success: false, error: 'Missing event in payload' });
    }

    if (!signature) {
      return res.status(400).json({ success: false, error: 'Missing x-razorpay-signature header' });
    }

    const isPartnerLifecycleEvent = ['account.activated', 'account.rejected', 'account.under_review'].includes(event);

    let verificationSecret;
    let tenant = null;

    if (isPartnerLifecycleEvent) {
      // 1. Partner lifecycle events: verified using master RAZORPAY_PARTNER_WEBHOOK_SECRET
      verificationSecret = process.env.RAZORPAY_PARTNER_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET;
      if (!verificationSecret) {
        console.warn('⚠️ [PartnerWebhook] RAZORPAY_PARTNER_WEBHOOK_SECRET not configured on server');
        return res.status(500).json({ success: false, error: 'Partner webhook secret not configured' });
      }
    } else {
      // 2. Merchant commerce events: MUST have sub-merchant accountId and use tenant's decrypted secret
      if (!accountId) {
        console.warn('⚠️ [PartnerWebhook] Commerce webhook missing account_id in payload');
        return res.status(400).json({ success: false, error: 'Missing account_id for sub-merchant event' });
      }

      tenant = await prisma.tenant.findFirst({
        where: { razorpayAccountId: accountId },
        select: {
          id: true,
          razorpayAccountId: true,
          razorpayWebhookSecret: true,
          enableOnlinePayment: true,
          enableCod: true,
        },
      });

      if (!tenant) {
        console.warn(`⚠️ [PartnerWebhook] Received commerce webhook for unknown sub-merchant: ${accountId}`);
        return res.status(200).json({ status: 'ignored', reason: 'tenant_not_found' });
      }

      if (!tenant.razorpayWebhookSecret) {
        console.warn(`⚠️ [PartnerWebhook] Tenant ${tenant.id} does not have razorpayWebhookSecret configured`);
        return res.status(200).json({ status: 'ignored', reason: 'webhook_secret_not_configured' });
      }

      try {
        verificationSecret = decrypt(tenant.razorpayWebhookSecret);
      } catch (decryptErr) {
        console.error(`❌ [PartnerWebhook] Decryption failed for tenant ${tenant.id}:`, decryptErr.message);
        return res.status(500).json({ success: false, error: 'Internal security error' });
      }
    }

    // 3. Timing-Safe HMAC-SHA256 Verification
    const rawPayload = req.rawBody || Buffer.from(JSON.stringify(req.body));
    const expectedSignature = crypto
      .createHmac('sha256', verificationSecret)
      .update(rawPayload)
      .digest('hex');

    const sigBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      console.warn(`❌ [PartnerWebhook] Invalid signature for event ${event}`);
      return res.status(400).json({ success: false, error: 'Invalid signature' });
    }

    // 4. Handle Partner Lifecycle Events
    if (isPartnerLifecycleEvent) {
      console.log(`📋 [PartnerWebhook] Partner Lifecycle Event: ${event} for account: ${accountId}`);

      if (accountId) {
        const targetTenant = await prisma.tenant.findFirst({
          where: { razorpayAccountId: accountId },
          select: { id: true },
        });

        if (targetTenant) {
          if (event === 'account.activated') {
            await prisma.tenant.update({
              where: { id: targetTenant.id },
              data: {
                razorpayAccountStatus: 'VERIFIED',
                razorpayKycStatus: 'VERIFIED',
                enableOnlinePayment: true,
              },
            });

            emitToTenant(targetTenant.id, 'payment_gateway_activated', {
              status: 'VERIFIED',
              enableOnlinePayment: true,
            });

            await createNotification({
              tenantId: targetTenant.id,
              title: '🎉 Razorpay KYC Verified!',
              message: 'Your Razorpay account KYC has been verified. 1-Click online payments are now fully active on your WhatsApp store!',
              type: 'SYSTEM',
            }).catch(() => {});

            console.log(`✅ [PartnerWebhook] Activated tenant ${targetTenant.id} (KYC verified)`);
          } else if (event === 'account.rejected') {
            await prisma.tenant.update({
              where: { id: targetTenant.id },
              data: {
                razorpayAccountStatus: 'SUSPENDED',
                razorpayKycStatus: 'REJECTED',
                enableOnlinePayment: false,
              },
            });

            emitToTenant(targetTenant.id, 'payment_gateway_rejected', {
              status: 'SUSPENDED',
              enableOnlinePayment: false,
            });
          }
        }
      }

      return res.status(200).json({ status: 'ok', handled: 'partner_lifecycle' });
    }

    // 5. Commerce Events: Extract Event ID & Enqueue
    const payload = req.body?.payload;
    const eventEntity =
      payload?.payment_link?.entity ||
      payload?.payment?.entity ||
      payload?.refund?.entity;

    const eventId =
      eventEntity?.id ||
      req.headers['x-razorpay-event-id'] ||
      `${Date.now()}_${Math.random().toString(36).substring(7)}`;

    await orderWebhookQueue.add(
      'order-webhook-events',
      {
        tenantId: tenant.id,
        eventId,
        event,
        payload,
        receivedAt: new Date().toISOString(),
      },
      {
        jobId: `rzp_partner_${event}_${eventId}`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 10000 },
      }
    );

    console.log(`📥 [PartnerWebhook] Enqueued ${event} (ID: ${eventId}) for tenant ${tenant.id}`);
    return res.status(200).json({ status: 'ok', received: true });
  } catch (error) {
    console.error('❌ [PartnerWebhook] Ingestion error:', error);
    return res.status(500).json({ success: false, error: 'Partner webhook ingestion failed' });
  }
};

/**
 * Phase 2: Async BullMQ Job Processor
 * Performs atomic idempotency check via DB WebhookEvent table and handles all 7 payment events.
 */
export const processOrderWebhookJob = async (job) => {
  const { tenantId, eventId, event, payload } = job.data;
  const uniqueKey = `${event}_${eventId}`;

  console.log(`\n💳 [OrderWebhookWorker] Processing event "${event}" (${uniqueKey}) for tenant ${tenantId}`);

  // 1. Atomic Idempotency Check using Prisma create-first
  try {
    await prisma.webhookEvent.create({
      data: {
        provider: 'RAZORPAY',
        eventId: uniqueKey,
        tenantId,
        eventType: event,
      }
    });
  } catch (err) {
    if (err.code === 'P2002') {
      console.log(`ℹ️ [OrderWebhook] Duplicate webhook event skipped: ${uniqueKey}`);
      return { duplicate: true };
    }
    throw err;
  }


  // 2. Resolve Target Order
  const paymentLinkEntity = payload?.payment_link?.entity;
  const paymentEntity = payload?.payment?.entity;
  const refundEntity = payload?.refund?.entity;

  const orderId = paymentLinkEntity?.notes?.orderId ||
                  paymentEntity?.notes?.orderId ||
                  refundEntity?.notes?.orderId ||
                  paymentLinkEntity?.reference_id;

  let order = null;
  if (orderId) {
    order = await prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: { conversation: true, contact: true, tenant: true }
    });
  }

  if (!order) {
    // Secondary lookup by razorpayPaymentLinkId or razorpayPaymentId
    const searchId = paymentLinkEntity?.id || paymentEntity?.id || paymentEntity?.order_id;
    if (searchId) {
      order = await prisma.order.findFirst({
        where: {
          tenantId,
          OR: [
            { razorpayPaymentLinkId: searchId },
            { razorpayPaymentId: searchId }
          ]
        },
        include: { conversation: true, contact: true, tenant: true }
      });
    }
  }

  if (!order) {
    console.warn(`⚠️ [OrderWebhook] No matching order found for event ${event} (entity ID: ${eventId})`);
    return { status: 'ignored_no_order' };
  }

  console.log(`📦 [OrderWebhook] Matched Order #${order.orderNumber} (ID: ${order.id})`);

  // 3. Dispatch Event to Specific Handlers
  try {
    switch (event) {

      // ── 1. PAYMENT LINK PAID ─────────────────────────────────
      case 'payment_link.paid': {
        if (order.paymentStatus === 'PAID') {
          console.log(`ℹ️ [OrderWebhook] Order #${order.orderNumber} is already marked as PAID. Skipping duplicate webhook.`);
          break;
        }

        const paymentId = paymentLinkEntity?.payment_id || paymentEntity?.id || null;
        const paidPaise = paymentLinkEntity?.amount_paid || paymentEntity?.amount || 0;
        const expectedPaise = Math.round(Number(order.totalAmount) * 100);

        // Security check: Integer paise verification against order amount
        if (paidPaise !== expectedPaise) {
          console.error(`🚨 [OrderWebhook] Amount mismatch on Order #${order.orderNumber}! Expected ${expectedPaise} paise, got ${paidPaise} paise.`);
          
          await prisma.order.update({
            where: { id: order.id },
            data: {
              paymentStatus: 'AMOUNT_MISMATCH',
              status: 'REVIEW_REQUIRED',
              razorpayPaymentId: paymentId,
              adminNotes: `AMOUNT MISMATCH: Expected ${expectedPaise} paise (${order.currency} ${order.totalAmount}), but received ${paidPaise} paise.`,
            }
          });

          emitToTenant(tenantId, 'order_status_update', {
            orderId: order.id,
            paymentStatus: 'AMOUNT_MISMATCH',
            status: 'REVIEW_REQUIRED',
            orderNumber: order.orderNumber,
          });

          await createNotification({
            tenantId,
            title: `🚨 Payment Mismatch: Order #${order.orderNumber}`,
            message: `Customer paid ${paidPaise / 100} ${order.currency}, but order total is ${order.totalAmount} ${order.currency}. Action required.`,
            type: 'ORDER',
          });

          break;
        }

        // Amount matches: Mark Order PAID & CONFIRMED
        const updatedOrder = await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'PAID',
            status: 'CONFIRMED',
            razorpayPaymentId: paymentId,
            paidAt: new Date(),
          },
          include: { conversation: true, contact: true, tenant: true }
        });

        console.log(`✅ [OrderWebhook] Order #${order.orderNumber} marked as PAID & CONFIRMED`);

        emitToTenant(tenantId, 'order_status_update', {
          orderId: order.id,
          paymentStatus: 'PAID',
          status: 'CONFIRMED',
          orderNumber: order.orderNumber,
          paidAt: updatedOrder.paidAt,
        });

        // Resume WhatsApp Automation Flow
        await flowEngine.resumeFlowAfterPayment(updatedOrder, 'PAID');
        break;
      }

      // ── 2. PAYMENT CAPTURED ──────────────────────────────────
      case 'payment.captured': {
        const paymentId = paymentEntity?.id;
        const paidPaise = paymentEntity?.amount || 0;
        const expectedPaise = Math.round(Number(order.totalAmount) * 100);

        // Idempotent safety: only update if not already PAID
        if (order.paymentStatus !== 'PAID') {
          if (paidPaise !== expectedPaise) {
            console.error(`🚨 [OrderWebhook] Amount mismatch on payment.captured for Order #${order.orderNumber}!`);
            await prisma.order.update({
              where: { id: order.id },
              data: {
                paymentStatus: 'AMOUNT_MISMATCH',
                status: 'REVIEW_REQUIRED',
                razorpayPaymentId: paymentId,
                adminNotes: `Captured payment mismatch: received ${paidPaise} paise, expected ${expectedPaise} paise.`,
              }
            });
            break;
          }

          const updatedOrder = await prisma.order.update({
            where: { id: order.id },
            data: {
              paymentStatus: 'PAID',
              status: 'CONFIRMED',
              razorpayPaymentId: paymentId,
              paidAt: new Date(),
            },
            include: { conversation: true, contact: true, tenant: true }
          });

          console.log(`✅ [OrderWebhook] payment.captured: Order #${order.orderNumber} confirmed`);

          emitToTenant(tenantId, 'order_status_update', {
            orderId: order.id,
            paymentStatus: 'PAID',
            status: 'CONFIRMED',
            orderNumber: order.orderNumber,
          });

          await flowEngine.resumeFlowAfterPayment(updatedOrder, 'PAID');
        }
        break;
      }

      // ── 3. PAYMENT FAILED ────────────────────────────────────
      case 'payment.failed': {
        const failureReason = paymentEntity?.error_description || paymentEntity?.error_reason || 'Payment failed';
        console.warn(`❌ [OrderWebhook] Payment failed for Order #${order.orderNumber}: ${failureReason}`);

        const updatedOrder = await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'FAILED',
            adminNotes: `Payment failed: ${failureReason}`,
          },
          include: { conversation: true, contact: true, tenant: true }
        });

        emitToTenant(tenantId, 'order_status_update', {
          orderId: order.id,
          paymentStatus: 'FAILED',
          status: order.status,
          orderNumber: order.orderNumber,
          failureReason,
        });

        // Notify customer on WhatsApp with retry options
        await flowEngine.handlePaymentFailed(updatedOrder, failureReason);
        break;
      }

      // ── 4. PAYMENT LINK EXPIRED ──────────────────────────────
      case 'payment_link.expired': {
        console.warn(`⏰ [OrderWebhook] Payment link expired for Order #${order.orderNumber}`);

        const updatedOrder = await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'EXPIRED',
          },
          include: { conversation: true, contact: true, tenant: true }
        });

        emitToTenant(tenantId, 'order_status_update', {
          orderId: order.id,
          paymentStatus: 'EXPIRED',
          status: order.status,
          orderNumber: order.orderNumber,
        });

        // Offer customer a new payment link or COD fallback
        await flowEngine.handlePaymentExpired(updatedOrder);
        break;
      }

      // ── 5. PAYMENT LINK CANCELLED ────────────────────────────
      case 'payment_link.cancelled': {
        console.log(`🚫 [OrderWebhook] Payment link cancelled for Order #${order.orderNumber}`);

        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'CANCELLED',
            status: 'CANCELLED',
            adminNotes: 'Payment link cancelled on gateway',
          }
        });

        emitToTenant(tenantId, 'order_status_update', {
          orderId: order.id,
          paymentStatus: 'CANCELLED',
          status: 'CANCELLED',
          orderNumber: order.orderNumber,
        });

        // Sync to Google Sheets
        try {
          const fullOrder = await prisma.order.findUnique({ where: { id: order.id }, include: { items: true, contact: true } });
          const productSummary = (fullOrder?.items || []).map(i => `${i.productName || 'Item'} (x${i.quantity || 1})`).join(', ');
          logLeadStatusToSheet(tenantId, {
            "Timestamp": new Date().toLocaleString(),
            "Contact Name": fullOrder?.contact?.name || fullOrder?.contact?.pushName || "WhatsApp Customer",
            "Phone": fullOrder?.contact?.phone || fullOrder?.contact?.wa_id || "",
            "Order ID": order.orderNumber || order.id,
            "Order Status": "CANCELLED",
            "Payment Status": "CANCELLED",
            "Payment Method": fullOrder?.paymentMethod === 'RAZORPAY' ? 'Razorpay' : (fullOrder?.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Pending'),
            "Amount": String(fullOrder?.totalAmount || ""),
            "Products": productSummary,
            "Delivery Location": fullOrder?.deliveryAddress || "",
            "Notes": "Payment link cancelled on gateway"
          }).catch(e => console.warn('[GoogleSheets Sync] Cancel webhook log warning:', e.message));
        } catch (e) {
          console.warn('[GoogleSheets Sync] Error on cancel webhook:', e.message);
        }
        break;
      }

      // ── 6. REFUND PROCESSED ──────────────────────────────────
      case 'refund.processed': {
        const refundAmountPaise = refundEntity?.amount || 0;
        const totalPaise = Math.round(Number(order.totalAmount) * 100);
        const isFullRefund = refundAmountPaise >= totalPaise;

        console.log(`💰 [OrderWebhook] Refund processed for Order #${order.orderNumber}. Full: ${isFullRefund}`);

        const updatedOrder = await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
            status: isFullRefund ? 'CANCELLED' : order.status,
            refundId: refundEntity?.id,
            refundedAt: new Date(),
            adminNotes: `Refund completed: ${refundEntity?.id} (${order.currency} ${(refundAmountPaise / 100).toFixed(2)})`,
          },
          include: { conversation: true, contact: true }
        });

        emitToTenant(tenantId, 'order_status_update', {
          orderId: order.id,
          paymentStatus: updatedOrder.paymentStatus,
          status: updatedOrder.status,
          refundId: refundEntity?.id,
          orderNumber: order.orderNumber,
        });

        // Notify customer on WhatsApp
        const refundMsg = `💰 *Refund Processed*\n\nA refund of ${order.currency} ${(refundAmountPaise / 100).toFixed(2)} for Order #${order.orderNumber} has been processed successfully. It should reflect in your account within 5-7 business days.`;
        if (order.conversation && order.contact) {
          await flowEngine.sendBotTextMessage(order.conversation, order.contact, refundMsg);
          await flowEngine.saveBotMessage(order.conversation.id, refundMsg);
        }
        break;
      }

      // ── 7. REFUND FAILED ─────────────────────────────────────
      case 'refund.failed': {
        console.error(`❌ [OrderWebhook] Refund failed for Order #${order.orderNumber}`);

        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'REFUND_FAILED',
            adminNotes: `Refund attempt failed (${refundEntity?.id || 'unknown'}): ${refundEntity?.error_description || 'Gateway error'}`,
          }
        });

        emitToTenant(tenantId, 'order_status_update', {
          orderId: order.id,
          paymentStatus: 'REFUND_FAILED',
          status: order.status,
          orderNumber: order.orderNumber,
        });

        await createNotification({
          tenantId,
          title: `❌ Refund Failed: Order #${order.orderNumber}`,
          message: `The refund of ${order.currency} ${order.totalAmount} failed. Gateway message: ${refundEntity?.error_description || 'Unknown error'}.`,
          type: 'ORDER',
        });
        break;
      }

      default:
        console.log(`ℹ️ [OrderWebhook] Unhandled event type: ${event}`);
    }

    return { success: true, event, orderId: order.id };

  } catch (processErr) {
    console.error(`❌ [OrderWebhook] Error executing event ${event}:`, processErr);
    throw processErr;
  }
};
