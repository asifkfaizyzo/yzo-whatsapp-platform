import crypto from 'crypto';
import prisma from '../../config/prisma.js';
import { decrypt } from '../../lib/crypto.js';

export const handleShopifyWebhook = async (req, res) => {
  try {
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    const shopDomain = req.headers['x-shopify-shop-domain'];
    const topic = req.headers['x-shopify-topic'];

    if (!hmacHeader || !shopDomain) {
      return res.status(401).send('Missing Shopify webhook headers');
    }

    if (!req.rawBody) {
      console.warn('⚠️ [ShopifyWebhook] rawBody missing on request');
    }

    // Lookup active connection for this shop
    const connection = await prisma.shopifyConnection.findFirst({
      where: { shopName: shopDomain, status: 'active' },
    });

    if (!connection || !connection.webhookSecret) {
      console.warn(`⚠️ [ShopifyWebhook] No active connection or webhook secret for shop: ${shopDomain}`);
      return res.status(404).send('Tenant integration not found');
    }

    // Verify HMAC signature (same pattern as Razorpay)
    const secret = decrypt(connection.webhookSecret);
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body))
      .digest('base64');

    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const sigBuf = Buffer.from(hmacHeader, 'utf8');

    if (expectedBuf.length !== sigBuf.length || !crypto.timingSafeEqual(expectedBuf, sigBuf)) {
      console.warn(`⚠️ [ShopifyWebhook] Invalid HMAC signature for shop: ${shopDomain}`);
      return res.status(401).send('Invalid signature');
    }

    console.log(`🔔 [ShopifyWebhook] Verified event: ${topic} from shop: ${shopDomain}`);

    // Phase 1: Acknowledge only — no order/product sync yet
    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('❌ [ShopifyWebhook] Error:', error);
    return res.status(500).send('Internal server error');
  }
};