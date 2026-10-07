// backend/src/modules/webhook/orderWebhookController.js
import crypto from 'crypto';
import axios from 'axios'; // 👈 ADD THIS LINE
import prisma from '../../config/prisma.js';
import { decrypt } from '../../lib/crypto.js';
import { orderWebhookQueue } from '../../queues/orderWebhookQueue.js';
import { emitToTenant } from '../../lib/socket.js';
import { createNotification } from '../notifications/notificationService.js';
import flowEngine from '../automation/flowEngineService.js';
import { logLeadStatusToSheet } from '../google-sheets/googleSheetsService.js';
import {
  buildWooCustomerWelcomeTemplateParameters,
  buildWooShipmentTemplateParameters,
  buildWooCustomerWelcomeMessage,
  buildWooOrderLifecycleMessage,
  extractWooTrackingInfo,
  findWooCustomerWelcomeTemplate,
  findWooShipmentTemplate,
  getWooPaymentStatus,
} from '../woocommerce/woocommerceOrderLifecycle.js';

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
const processWooCustomerCreated = async ({ tenantId, payload }) => {
  const billing = payload.billing || {};
  const customerName = `${payload.first_name || billing.first_name || ''} ${payload.last_name || billing.last_name || ''}`.trim()
    || payload.username
    || 'Customer';
  const email = payload.email || billing.email || '';
  let phoneDigits = String(payload.phone || billing.phone || '').replace(/\D/g, '');
  if (phoneDigits.length === 10) phoneDigits = `91${phoneDigits}`;
  const phone = phoneDigits ? `+${phoneDigits}` : '';

  if (!phone) {
    console.warn(
      `[WooCommerce Welcome] Customer ${payload.id || 'unknown'} has no phone number; welcome message skipped`
    );
    return { ignored: true, reason: 'customer_phone_missing' };
  }

  let contact = await prisma.contact.findFirst({ where: { tenantId, phone } });
  if (!contact) {
    contact = await prisma.contact.create({
      data: { tenantId, phone, name: customerName, email },
    });
  } else if (!contact.name || contact.name === 'Customer') {
    contact = await prisma.contact.update({
      where: { id: contact.id },
      data: { name: customerName, email },
    });
  }

  let conversation = await prisma.conversation.findFirst({
    where: { tenantId, contactId: contact.id },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { tenantId, contactId: contact.id, status: 'OPEN' },
    });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      tenantName: true,
      whatsappPhoneId: true,
      whatsappAccessToken: true,
    },
  });
  const storeName = tenant?.tenantName || 'our store';
  const messageText = buildWooCustomerWelcomeMessage({ customerName, storeName });

  if (process.env.NODE_ENV === 'production') {
    const templates = await prisma.template.findMany({
      where: {
        tenantId,
        status: 'APPROVED',
        name: { contains: 'welcome' },
      },
      orderBy: { name: 'asc' },
      select: { name: true, language: true, components: true, status: true },
    });
    const template = findWooCustomerWelcomeTemplate(templates);
    if (!template) {
      console.warn(
        `[WooCommerce Welcome] No synced APPROVED welcome template found for tenant ${tenantId}`
      );
      return { ignored: true, reason: 'approved_welcome_template_missing' };
    }
    if (!tenant?.whatsappPhoneId || !tenant?.whatsappAccessToken) {
      console.warn(
        `[WooCommerce Welcome] WhatsApp is not connected for tenant ${tenantId}; welcome message skipped`
      );
      return { ignored: true, reason: 'whatsapp_not_connected' };
    }

    const templateParameters = buildWooCustomerWelcomeTemplateParameters({
      template,
      customerName,
      storeName,
    });
    const token = decrypt(tenant.whatsappAccessToken);
    const cleanRecipientPhone = phone.replace(/\D/g, '');
    await axios.post(
      `https://graph.facebook.com/v21.0/${tenant.whatsappPhoneId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanRecipientPhone,
        type: 'template',
        template: {
          name: template.name,
          language: { code: template.language || 'en_US' },
          components: templateParameters.length
            ? [{
                type: 'body',
                parameters: templateParameters.map((text) => ({ type: 'text', text })),
              }]
            : [],
        },
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
    );
  } else {
    console.log(
      `[WooCommerce Welcome] Development mode: welcome message recorded internally for ${phone}`
    );
  }

  const messageRecord = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: 'SYSTEM',
      senderType: 'SYSTEM',
      direction: 'OUTBOUND',
      text: messageText,
      type: 'TEXT',
      status: 'sent',
    },
  });
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date(), updatedAt: new Date() },
  });

  try {
    emitToTenant(tenantId, 'new_message', {
      message: messageRecord,
      conversationId: conversation.id,
      contact,
    });
  } catch (socketError) {
    console.error('[WooCommerce Welcome] Socket emit failed:', socketError.message);
  }

  console.log(
    `[WooCommerce Welcome] Customer ${payload.id || 'unknown'} welcome processed for tenant ${tenantId}`
  );
  return { success: true, type: 'WOOCOMMERCE_CUSTOMER_WELCOME', contactId: contact.id };
};

export const processOrderWebhookJob = async (job) => {


  const { name, data } = job;

  if (name === 'woocommerce-order' || data?.type === 'WOOCOMMERCE') {
    if (data?.topic === 'customer.created') {
      console.log(
        `[WooCommerce Account Event] Processing customer.created for customer ${data.payload?.id || 'unknown'}`
      );
      return processWooCustomerCreated(data);
    }
    if (['customer.login', 'customer.logout'].includes(data?.topic)) {
      console.log(
        `[WooCommerce Account Event] Processed "${data.topic}" for customer ${data.payload?.id || 'unknown'} (logging only)`
      );
      return { success: true, type: data.topic, loggingOnly: true };
    }

    console.log('2️⃣ Worker picked up job! Job name:', name, '| TenantId:', data?.tenantId);
    const { tenantId, topic, payload } = data;
    console.log(`\n📦 [OrderWebhookWorker] Processing WooCommerce Order #${payload?.id} for tenant ${tenantId}`);

    if (!topic || !topic.includes('order')) return { ignored: true };

    const externalOrderId = String(payload.id);
    const orderNumber = String(payload.number || payload.id);
    const status = payload.status || 'pending';
    const paymentMethod = payload.payment_method_title || payload.payment_method || 'COD';
    const paymentStatus = getWooPaymentStatus(payload);
    const paymentStatusLabel = paymentStatus.charAt(0) + paymentStatus.slice(1).toLowerCase();
    const total = parseFloat(payload.total || '0.0');
    const currency = payload.currency || 'INR';
    const billing = payload.billing || {};
    const shipping = payload.shipping || {};

    const customerName = `${billing.first_name || ''} ${billing.last_name || ''}`.trim() || 'Customer';
    const customerEmail = billing.email || '';

    let cleanDigits = (billing.phone || shipping.phone || '').replace(/\D/g, '');
    if (cleanDigits.length === 10) cleanDigits = `91${cleanDigits}`;
    const customerPhone = cleanDigits ? `+${cleanDigits}` : '';

    const lineItems = (payload.line_items || []).map(item => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      total: item.total
    }));
    const wooConnection = await prisma.wooCommerceConnection.findUnique({
      where: { tenantId },
      select: { trackingUrlTemplates: true }
    });
    const trackingInfo = extractWooTrackingInfo(payload, wooConnection?.trackingUrlTemplates || {});

    const orderKey = {
      tenantId_source_externalOrderId: {
        tenantId,
        source: 'WOOCOMMERCE',
        externalOrderId
      }
    };

    const previousOrder = await prisma.ecommerceOrder.findUnique({
      where: orderKey,
      select: { status: true, paymentStatus: true, trackingInfo: true, reviewRequestedAt: true, reviewRating: true }
    });
    const isNewOrder = !previousOrder;
    const previousStatus = previousOrder?.status?.toLowerCase();
    const hasStatusChanged = Boolean(previousStatus && previousStatus !== status.toLowerCase());
    const previousPaymentStatus = previousOrder?.paymentStatus?.toLowerCase();
    const hasPaymentStatusChanged = Boolean(
      previousPaymentStatus && previousPaymentStatus !== paymentStatus.toLowerCase()
    );
    const hasTrackingChanged = Boolean(
      trackingInfo && JSON.stringify(trackingInfo) !== JSON.stringify(previousOrder?.trackingInfo || [])
    );
    console.log(
      `[WooCommerce Lifecycle] #${orderNumber} (${topic}) order status: ${previousStatus || 'new'} -> ${status.toLowerCase()}, payment: ${previousPaymentStatus || 'new'} -> ${paymentStatus.toLowerCase()}, tracking: ${hasTrackingChanged ? 'changed' : 'unchanged'}`
    );
    const currentNormalizedStatus = status.toLowerCase().replace(/^wc-/, '');
    const previousNormalizedStatus = previousStatus?.replace(/^wc-/, '');
    const isDelivered = ['completed', 'delivered'].includes(currentNormalizedStatus);
    const wasDelivered = ['completed', 'delivered'].includes(previousNormalizedStatus);
    const reviewRequestedAt = isDelivered && (!previousOrder || !wasDelivered)
      ? new Date()
      : undefined;

    // 1. Upsert Order in DB
    const order = await prisma.ecommerceOrder.upsert({
      where: orderKey,
      update: {
        status, paymentMethod, paymentStatus, total, customerName,
        customerPhone, customerEmail, shippingAddress: shipping, lineItems,
        ...(trackingInfo ? { trackingInfo } : {}),
        ...(reviewRequestedAt ? { reviewRequestedAt } : {})
      },
      create: {
        tenantId, source: 'WOOCOMMERCE', externalOrderId, orderNumber,
        status, paymentMethod, paymentStatus, total, currency, customerName,
        customerPhone, customerEmail, shippingAddress: shipping, lineItems,
        trackingInfo: trackingInfo || undefined,
        reviewRequestedAt
      }
    });
     console.log('3️⃣ DB Upsert succeeded! Order ID in DB:', order.id);

    // 2. Upsert Contact & Conversation for Live Chat
    if (customerPhone) {
      let contact = await prisma.contact.findFirst({
        where: { tenantId, phone: customerPhone }
      });

      if (!contact) {
        contact = await prisma.contact.create({
          data: { tenantId, phone: customerPhone, name: customerName, email: customerEmail }
        });
      } else if (!contact.name || contact.name === 'Customer') {
        contact = await prisma.contact.update({
          where: { id: contact.id },
          data: { name: customerName, email: customerEmail }
        });
      }

      let conversation = await prisma.conversation.findFirst({
        where: { tenantId, contactId: contact.id }
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: { tenantId, contactId: contact.id, status: 'OPEN' }
        });
      }

      const itemsList = lineItems.map(i => `${i.name} (x${i.quantity})`).join(', ');
      const messageText = buildWooOrderLifecycleMessage({
        isNewOrder: isNewOrder && topic === 'order.created',
        previousStatus,
        status,
        previousPaymentStatus,
        paymentStatus,
        paymentMethod,
        customerName,
        orderNumber,
        currency,
        total,
        lineItems: itemsList,
        hasTrackingChanged,
        trackingInfo: trackingInfo || previousOrder?.trackingInfo || [],
      });

      let messageRecord = null;
      if (messageText) {
        messageRecord = await prisma.message.create({
          data: {
            conversationId: conversation.id,
            senderId: 'SYSTEM',
            senderType: 'SYSTEM',
            direction: 'OUTBOUND',
            text: messageText,
            type: 'TEXT',
            status: 'sent'
          }
        });

        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt: new Date(), updatedAt: new Date() }
        });
      }

      // Realtime Sockets
      try {
        const orderPayload = { order, contact };
        if (messageRecord) {
          const msgPayload = { message: messageRecord, conversationId: conversation.id, contact };
          emitToTenant(tenantId, 'new_message', msgPayload);
        }
        emitToTenant(tenantId, 'woocommerce_order_received', orderPayload);
      } catch (sockErr) {
        console.error('Socket error:', sockErr.message);
      }

      // 3. Log to Google Sheet
      const formattedStatus = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Processing';
      const deliveryLocation = [
        shipping.address_1 || billing.address_1 || '',
        shipping.city || billing.city || '',
        shipping.state || billing.state || '',
        shipping.postcode || billing.postcode || ''
      ].filter(Boolean).join(', ') || 'N/A';
      const trackingProvider = trackingInfo?.map((item) => item.provider).filter(Boolean).join(', ') || '';
      const trackingNumber = trackingInfo?.map((item) => item.number).filter(Boolean).join(', ') || '';
      const trackingLink = trackingInfo?.map((item) => item.url).filter(Boolean).join(', ') || '';

      await logLeadStatusToSheet(tenantId, {
        "Contact Name": customerName,
        "Phone Number": customerPhone,
        "Order Status": formattedStatus,
        "Lead Status": formattedStatus,
        "Order ID": `#${orderNumber}`,
        "Total Amount": `${currency} ${total}`,
        "Payment Status": paymentStatusLabel,
        "Payment Method": paymentMethod,
        "Tracking Provider": trackingProvider,
        "Tracking Number": trackingNumber,
        "Tracking Link": trackingLink,
        "Products": itemsList || '1 Item',
        "Delivery Location": deliveryLocation,
        "Notes": (payload.customer_note || '').trim() || `WooCommerce Order #${orderNumber}`,
        "Timestamp": new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
      });

      // 4. WhatsApp Template Notification
      if (messageText && process.env.NODE_ENV !== 'production') {
        console.log(`🧪 [Worker] Development mock: order notification recorded in platform for ${customerPhone}`);
      } else if (messageText && process.env.NODE_ENV === 'production' && isNewOrder) {
        const whatsappConnection = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { whatsappPhoneId: true, whatsappAccessToken: true }
        });
        const phoneNumberId = whatsappConnection?.whatsappPhoneId;
        const whatsappToken = whatsappConnection?.whatsappAccessToken
          ? decrypt(whatsappConnection.whatsappAccessToken)
          : null;

        if (phoneNumberId && whatsappToken) {
          try {
            const cleanRecipientPhone = customerPhone.replace(/\+/g, '');
            const tenantTemplate = await prisma.template?.findFirst({
              where: {
                tenantId,
                status: 'APPROVED',
                OR: [{ category: 'UTILITY' }, { name: { contains: 'order' } }]
              }
            }).catch(() => null);

            const templatePayload = tenantTemplate
              ? {
                  messaging_product: 'whatsapp',
                  recipient_type: 'individual',
                  to: cleanRecipientPhone,
                  type: 'template',
                  template: {
                    name: tenantTemplate.name,
                    language: { code: tenantTemplate.language || 'en_US' },
                    components: [{
                      type: 'body',
                      parameters: [
                        { type: 'text', text: customerName },
                        { type: 'text', text: orderNumber },
                        { type: 'text', text: currency },
                        { type: 'text', text: String(total) },
                        { type: 'text', text: paymentMethod }
                      ]
                    }]
                  }
                }
              : {
                  messaging_product: 'whatsapp',
                  recipient_type: 'individual',
                  to: cleanRecipientPhone,
                  type: 'template',
                  template: { name: 'hello_world', language: { code: 'en_US' } }
                };

            const waResponse = await axios.post(
              `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
              templatePayload,
              { headers: { 'Authorization': `Bearer ${whatsappToken}`, 'Content-Type': 'application/json' } }
            );
            console.log(`✅ [Worker] WhatsApp order template accepted for ${cleanRecipientPhone} (message ID: ${waResponse.data?.messages?.[0]?.id || 'unknown'})`);
          } catch (waErr) {
            console.error('⚠️ [Worker] WhatsApp template error:', waErr.response?.data || waErr.message);
          }
        } else {
          console.warn(`⚠️ [Worker] WhatsApp order notification skipped for tenant ${tenantId}: WhatsApp is not connected`);
        }
      } else if (
        messageText
        && process.env.NODE_ENV === 'production'
        && !isNewOrder
        && ['shipped', 'completed'].includes(currentNormalizedStatus)
        && (hasStatusChanged || hasTrackingChanged)
      ) {
        const shipmentTrackingInfo = trackingInfo || previousOrder?.trackingInfo || [];
        const templateParameters = buildWooShipmentTemplateParameters({
          customerName,
          orderNumber,
          trackingInfo: shipmentTrackingInfo,
        });

        if (!templateParameters) {
          console.warn(
            `[Worker] Shipment WhatsApp notification skipped for order #${orderNumber}: courier name and tracking URL are required`
          );
        } else {
          const whatsappConnection = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { whatsappPhoneId: true, whatsappAccessToken: true }
          });
          const phoneNumberId = whatsappConnection?.whatsappPhoneId;
          const whatsappToken = whatsappConnection?.whatsappAccessToken
            ? decrypt(whatsappConnection.whatsappAccessToken)
            : null;

          if (!phoneNumberId || !whatsappToken) {
            console.warn(
              `[Worker] Shipment WhatsApp notification skipped for tenant ${tenantId}: WhatsApp is not connected`
            );
          } else {
            const approvedTemplates = await prisma.template.findMany({
              where: { tenantId, status: 'APPROVED' },
              select: { name: true, language: true, status: true, components: true }
            });
            const shipmentTemplate = findWooShipmentTemplate(approvedTemplates);

            if (!shipmentTemplate) {
              console.warn(
                `[Worker] Shipment WhatsApp notification skipped for tenant ${tenantId}: sync an APPROVED shipment template with four body placeholders`
              );
            } else {
              try {
                const cleanRecipientPhone = customerPhone.replace(/\D/g, '');
                const waResponse = await axios.post(
                  `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
                  {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: cleanRecipientPhone,
                    type: 'template',
                    template: {
                      name: shipmentTemplate.name,
                      language: { code: shipmentTemplate.language || 'en_US' },
                      components: [{
                        type: 'body',
                        parameters: templateParameters.map((text) => ({ type: 'text', text }))
                      }]
                    }
                  },
                  { headers: { Authorization: `Bearer ${whatsappToken}`, 'Content-Type': 'application/json' } }
                );
                console.log(
                  `[Worker] Shipment WhatsApp template "${shipmentTemplate.name}" accepted for order #${orderNumber} (message ID: ${waResponse.data?.messages?.[0]?.id || 'unknown'})`
                );
              } catch (waErr) {
                console.error(
                  `[Worker] Shipment WhatsApp template error for order #${orderNumber}:`,
                  waErr.response?.data?.error?.message || waErr.message
                );
              }
            }
          }
        }
      }
    }

    return { success: true, type: 'WOOCOMMERCE', orderId: order.id };
  }
  // 👆👆👆 END OF WOOCOMMERCE BLOCK 👆👆👆


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

        // ── Phase 4: Update Zoho Deal stage ──
        try {
          const { updateZohoDealStage } = await import('../zoho/zohoDealService.js');
          updateZohoDealStage(tenantId, order.id, 'PAID').catch(() => {});
        } catch (_) {}

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

          // ── Phase 4: Update Zoho Deal stage ──
          try {
            const { updateZohoDealStage } = await import('../zoho/zohoDealService.js');
            updateZohoDealStage(tenantId, order.id, 'PAID').catch(() => {});
          } catch (_) {}

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