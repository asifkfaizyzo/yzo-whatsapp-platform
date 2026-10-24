import prisma from '../../config/prisma.js';
import { orderWebhookQueue } from '../../queues/orderWebhookQueue.js';
import { isWooStoreUrl, normalizeWooStoreHost, verifyWooAuthEventSignature } from './woocommerceAuthWebhookSecurity.js';
import { normalizeWooPhone } from '../woocommerce/woocommerceAuthMessageService.js';

export const handleWooCommerceCartEvent = async (req, res) => {
  try {
    const tenantId = String(req.query.tenantId || '');
    const timestamp = String(req.headers['x-sudoreply-timestamp'] || '');
    const signature = req.headers['x-sudoreply-signature'];
    const rawBody = req.rawBody;
    if (!tenantId || !Buffer.isBuffer(rawBody)) {
      return res.status(400).json({ success: false, message: 'Invalid signed cart-event request' });
    }

    const connection = await prisma.wooCommerceConnection.findUnique({
      where: { tenantId },
      select: { storeUrl: true, webhookSecret: true, status: true, cartRecoveryEnabled: true },
    });
    if (!connection?.webhookSecret
      || !['CONNECTED', 'ACTIVE'].includes(String(connection.status).toUpperCase())) {
      return res.status(401).json({ success: false, message: 'WooCommerce connection is not configured for cart recovery' });
    }
    if (!verifyWooAuthEventSignature({
      secret: connection.webhookSecret,
      timestamp,
      signature,
      rawBody,
    })) {
      return res.status(401).json({ success: false, message: 'Invalid cart-event signature' });
    }
    if (connection.cartRecoveryEnabled === false) {
      return res.status(200).json({ success: true, accepted: false, reason: 'cart_recovery_disabled' });
    }

    const event = req.body;
    if (!['cart.updated', 'cart.converted'].includes(event?.topic)
      || !event?.cartId
      || !event?.storeUrl
      || normalizeWooStoreHost(event.storeUrl) !== normalizeWooStoreHost(connection.storeUrl)
      || !normalizeWooPhone(event.customer?.phone)) {
      return res.status(400).json({ success: false, message: 'Invalid cart event or store identity mismatch' });
    }
    if (event.topic === 'cart.updated'
      && (!isWooStoreUrl({
        candidate: event.cart?.checkoutUrl,
        storeUrl: connection.storeUrl,
        allowHttp: process.env.NODE_ENV !== 'production',
      })
        || !Array.isArray(event.cart?.lineItems)
        || event.cart.lineItems.length < 1
        || event.cart.lineItems.length > 100)) {
      return res.status(400).json({ success: false, message: 'Invalid cart contents or recovery URL' });
    }

    const occurredAt = new Date(event.occurredAt);
    if (Number.isNaN(occurredAt.getTime())
      || Math.abs(Date.now() - occurredAt.getTime()) > 5 * 60 * 1000) {
      return res.status(400).json({ success: false, message: 'A recent valid cart-event timestamp is required' });
    }
    if (String(event.cartId).length > 100
      || !/^[A-Za-z0-9_-]+$/.test(String(event.cartId))) {
      return res.status(400).json({ success: false, message: 'Invalid cart identifier' });
    }

    const cart = {
      topic: event.topic,
      eventId: String(event.eventId || ''),
      occurredAt: occurredAt.toISOString(),
      storeUrl: new URL(event.storeUrl).toString(),
      cartId: String(event.cartId),
      customer: {
        name: String(event.customer?.name || 'Customer').slice(0, 100),
        phone: normalizeWooPhone(event.customer.phone),
        email: String(event.customer?.email || '').slice(0, 254),
      },
      ...(event.topic === 'cart.updated' && { cart: {
        total: Number.isFinite(Number(event.cart.total)) ? Number(event.cart.total) : 0,
        currency: String(event.cart.currency || 'USD').slice(0, 8),
        checkoutUrl: new URL(event.cart.checkoutUrl).toString(),
        lineItems: event.cart.lineItems.map((item) => ({
          name: String(item.name || 'Product').slice(0, 250),
          quantity: Math.min(9999, Math.max(1, Math.floor(Number(item.quantity) || 1))),
          price: String(item.price ?? '0').slice(0, 32),
          productId: Number(item.productId) || null,
          variationId: Number(item.variationId) || null,
          imageUrl: isWooStoreUrl({
            candidate: item.imageUrl,
            storeUrl: connection.storeUrl,
            allowHttp: process.env.NODE_ENV !== 'production',
          })
            ? new URL(item.imageUrl).toString()
            : null,
        })),
      } }),
    };
    const eventVersion = String(event.eventId || occurredAt.getTime()).replace(/[^A-Za-z0-9_-]/g, '');
    await orderWebhookQueue.add(
      'woocommerce-cart-event',
      { type: 'WOOCOMMERCE_CART', tenantId, event: cart },
      {
        jobId: `woo_cart_event_${tenantId}_${event.cartId}_${eventVersion}`.slice(0, 240),
        attempts: 5,
        backoff: { type: 'exponential', delay: 10_000 },
      },
    );
    return res.status(200).json({ success: true, accepted: true });
  } catch (error) {
    console.error('[WooCommerce Cart Recovery] Event handling failed:', error.message);
    return res.status(500).json({ success: false, message: 'WooCommerce cart event could not be queued' });
  }
};
