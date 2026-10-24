import crypto from 'node:crypto';
import prisma from '../../config/prisma.js';
import { decrypt } from '../../lib/crypto.js';
import { orderWebhookQueue } from '../../queues/orderWebhookQueue.js';

/**
 * Safely resolves target customer phone.
 * - In DEVELOPMENT: Uses test phone (+15556289708) if SHOPIFY_OVERRIDE_PHONE_IN_DEV=true in .env
 * - In PRODUCTION: Always uses real customer phone number from Shopify
 */
function resolveCustomerPhone(order) {
  let rawPhone = 
    order.customer?.phone || 
    order.billing_address?.phone || 
    order.shipping_address?.phone || 
    order.phone;

  let cleanPhone = rawPhone ? rawPhone.replace(/[^\d+]/g, '') : null;
  if (cleanPhone && !cleanPhone.startsWith('+')) {
    cleanPhone = `+${cleanPhone}`;
  }

  const isDevOverride = process.env.SHOPIFY_OVERRIDE_PHONE_IN_DEV === 'true';
  const isProduction = process.env.NODE_ENV === 'production';

  if (isDevOverride && !isProduction) {
    return process.env.META_TEST_PHONE || '+15556289708';
  }

  return cleanPhone;
}

/**
 * Main Shopify Webhook Handler
 */
export const handleIncomingWebhook = async (req, res) => {
  const topic = String(req.headers['x-shopify-topic'] || '').trim();
  const shopDomain = req.headers['x-shopify-shop-domain'];
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  const payload = req.body;

  let cleanDomain = String(shopDomain || '').trim().toLowerCase();
  if (cleanDomain && !cleanDomain.includes('.')) cleanDomain = `${cleanDomain}.myshopify.com`;

  // 1. ALWAYS log incoming webhook hit immediately
  console.log(`📥 [Shopify Webhook Received] Topic: '${topic}' | Shop: '${cleanDomain}'`);

  try {
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid or empty webhook payload' });
    }
    if (!topic) {
      return res.status(400).json({ success: false, message: 'Missing Shopify webhook topic header' });
    }
    if (!cleanDomain) {
      return res.status(400).json({ success: false, message: 'Missing Shopify shop domain header' });
    }

    // 2. Resolve tenant connection from DB
    const connection = await prisma.shopifyConnection.findFirst({
      where: { shopName: cleanDomain },
      select: {
        tenantId: true,
        webhookSecret: true,
      },
    });

    let tenantId = connection?.tenantId;

    if (!tenantId) {
      console.warn(`⚠️ [Shopify Webhook] No active integration found for shop: ${cleanDomain}`);
      return res.status(200).json({ success: true, message: 'Shopify integration not found, ignored' });
    }

    // 3. Verify Shopify's signature before accepting the event.
    if (!hmacHeader) {
      return res.status(401).json({ success: false, message: 'Missing Shopify webhook signature' });
    }

    const encryptedSecret = connection.webhookSecret;
    const rawSecret = encryptedSecret
      ? decrypt(encryptedSecret)
      : process.env.SHOPIFY_API_SECRET;
    if (!rawSecret) {
      console.error(`❌ [Shopify Webhook] No signing secret configured for ${cleanDomain}`);
      return res.status(503).json({ success: false, message: 'Shopify webhook signing secret is not configured' });
    }

    const rawPayload = req.rawBody || Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    const expectedSignature = crypto
      .createHmac('sha256', rawSecret)
      .update(rawPayload)
      .digest('base64');
    const receivedSignatureBuffer = Buffer.from(hmacHeader, 'base64');
    const expectedSignatureBuffer = Buffer.from(expectedSignature, 'base64');

    if (
      receivedSignatureBuffer.length !== expectedSignatureBuffer.length ||
      !crypto.timingSafeEqual(receivedSignatureBuffer, expectedSignatureBuffer)
    ) {
      console.warn(
        `⚠️ [Shopify Webhook] HMAC signature mismatch for ${cleanDomain} | ` +
        `rawBodyCaptured=${Buffer.isBuffer(req.rawBody)} | ` +
        `rawBodyBytes=${Buffer.isBuffer(req.rawBody) ? req.rawBody.length : 0} | ` +
        `signedBodyBytes=${rawPayload.length}`
      );
      return res.status(401).json({ success: false, message: 'Invalid Shopify webhook signature' });
    }
    console.log(`🔒 [Shopify Webhook] HMAC Signature Verified Successfully for ${cleanDomain}`);

    // 4. Format & override target phone for local dev testing safely
    const targetPhone = resolveCustomerPhone(payload);
    if (targetPhone) {
      if (!payload.customer) payload.customer = {};
      payload.customer.phone = targetPhone;
      if (payload.billing_address) payload.billing_address.phone = targetPhone;
      if (payload.shipping_address) payload.shipping_address.phone = targetPhone;
      payload.phone = targetPhone;
    }

    // 5. Generate unique job ID for idempotency & enqueue into BullMQ
    const deliveryId = req.headers['x-shopify-webhook-id'] || 
      crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const eventId = payload.id ? String(payload.id) : String(deliveryId);
    const safeEventVersion = String(deliveryId).replace(/[^a-zA-Z0-9_-]/g, '');
    const topicFormatted = topic ? topic.replace('/', '_') : 'event';
    const jobId = `shopify_${tenantId}_${eventId}_${topicFormatted}_${safeEventVersion}`;

    await orderWebhookQueue.add(
      'shopify-order',
      {
        provider: 'SHOPIFY',
        type: 'SHOPIFY',
        tenantId,
        topic,
        event: topic,
        eventType: topic,
        eventId: eventId,
        shopDomain: cleanDomain,
        payload
      },
      {
        jobId,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 10000
        }
      }
    );

    console.log(`⚡ [ShopifyWebhook] Queued '${topic}' job for Order #${payload.name || payload.id} in BullMQ`);
    return res.status(200).json({ success: true, message: 'Event accepted and queued' });

  } catch (error) {
    console.error('💥 [ShopifyWebhook] Failed to accept event:', error);
    return res.status(500).json({ success: false, error: 'Database/Queue Dispatch Failure' });
  }
};


// Exports for backward compatibility
export const handleShopifyWebhook = handleIncomingWebhook;
export const handleWebhook = handleIncomingWebhook;
export default handleIncomingWebhook;