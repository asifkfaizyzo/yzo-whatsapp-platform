
import { createHash } from 'node:crypto';
import prisma from '../../config/prisma.js';
import { orderWebhookQueue, QUEUE_NAME_ORDER_WEBHOOK } from '../../queues/orderWebhookQueue.js';

/**
 * Handle incoming WooCommerce Webhook events
 * Parses & validates payloads and hands off heavy tasks to BullMQ
 */
export const handleWooCommerceWebhook = async (req, res) => {
  const topic = req.headers['x-wc-webhook-topic'] || 'order.created';
  const source = req.headers['x-wc-webhook-source'] || '';
  const payload = req.body;

  console.log(`🔔 [WooCommerceWebhook] Received event "${topic}" from source: ${source}`);
  if (['customer.created', 'customer.login', 'customer.logout'].includes(topic)) {
    console.log(
      `[WooCommerce Account Event] Received "${topic}" for customer ${payload?.id || 'unknown'}`
    );
  }

  try {
    // 1. Handshake verification ping from WooCommerce
    if (topic === 'action.woocommerce_webhook_topic' || payload?.webhook_id) {
      console.log('✅ [WooCommerceWebhook] Handshake ping verified.');
      return res.status(200).json({ success: true, message: 'Webhook ping verified' });
    }

    if (!payload || !payload.id) {
      return res.status(200).json({ success: true, message: 'Empty payload ignored' });
    }

    // 2. Resolve Tenant ID
    // Priority A: Explicit URL query param (Crucial for TasteWP and local ngrok tunnels)
    let tenantId = req.query.tenantId;

    // Priority B: Domain lookup matching against storeUrl
    if (!tenantId && source) {
      const cleanDomain = source
        .replace(/https?:\/\//, '')
        .replace(/\/.*$/, '')
        .replace(/^www\./, '')
        .trim()
        .toLowerCase();

      const connection = await prisma.wooCommerceConnection.findFirst({
        where: {
          storeUrl: { contains: cleanDomain }
        }
      });
      if (connection) {
        tenantId = connection.tenantId;
        console.log(`🔗 [WooCommerceWebhook] Resolved tenant: ${tenantId} via domain: "${cleanDomain}"`);
      }
    }

    // Priority C: Auto-bind to single tenant connection in dev environment
    if (!tenantId) {
      const allConnections = await prisma.wooCommerceConnection.findMany({ take: 2 });
      if (allConnections.length === 1) {
        tenantId = allConnections[0].tenantId;
        console.log(`ℹ️ [WooCommerceWebhook] Auto-assigned sole tenant: ${tenantId}`);
      }
    }

     console.log('1️⃣ Webhook hit! Resolved tenantId:', tenantId);

    if (!tenantId) {
      console.warn('⚠️ [WooCommerceWebhook] Unresolvable Tenant ID. Drop execution.');
      return res.status(200).json({ success: true, message: 'Webhook accepted but ignored: Unresolved Tenant' });
    }

    // 3. Queue the event inside BullMQ (Instant Hand-off)
    const deliveryId = req.headers['x-wc-webhook-delivery-id'];
    const eventVersion = deliveryId || payload.date_modified_gmt || payload.date_modified ||
      createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const safeEventVersion = String(eventVersion).replace(/[^a-zA-Z0-9_-]/g, '');
    const jobId = `wc_${tenantId}_${payload.id}_${topic}_${safeEventVersion}`;
    await orderWebhookQueue.add(
      'woocommerce-order',
      {
        type: 'WOOCOMMERCE',
        tenantId,
        topic,
        source,
        payload
      },
      {
        jobId,
        // Prevent infinite retries of structural data issues
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 10000 // 10 seconds incremental scale
        }
      }
    );

    console.log(
      `⚡ [WooCommerceWebhook] Queued ${topic} job for customer/order #${payload.id} in BullMQ`
    );
    return res.status(200).json({ success: true, message: 'Event accepted and queued' });

  } catch (error) {
    console.error('💥 [WooCommerceWebhook] Controller Fatal Error:', error);
    // Returning 500 forces WooCommerce to attempt retry deliveries on failures
    return res.status(500).json({ success: false, error: 'Database/Queue Dispatch Failure' });
  }
};