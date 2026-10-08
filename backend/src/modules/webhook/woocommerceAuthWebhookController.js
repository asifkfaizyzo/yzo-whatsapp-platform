import prisma from '../../config/prisma.js';
import { deliverWooAuthWhatsAppMessage, normalizeWooPhone } from '../woocommerce/woocommerceAuthMessageService.js';
import { isWooStoreUrl, normalizeWooStoreHost, verifyWooAuthEventSignature } from './woocommerceAuthWebhookSecurity.js';

export const handleWooCommerceAuthEvent = async (req, res) => {
  try {
    const tenantId = String(req.query.tenantId || '');
    const timestamp = String(req.headers['x-sudoreply-timestamp'] || '');
    const signature = req.headers['x-sudoreply-signature'];
    const rawBody = req.rawBody;

    if (!tenantId || !Buffer.isBuffer(rawBody)) {
      return res.status(400).json({ success: false, message: 'Invalid signed auth-event request' });
    }

    const connection = await prisma.wooCommerceConnection.findUnique({
      where: { tenantId },
      select: { storeUrl: true, webhookSecret: true, status: true },
    });
    if (!connection?.webhookSecret || connection.status.toUpperCase() !== 'CONNECTED') {
      return res.status(401).json({ success: false, message: 'WooCommerce connection is not configured for auth events' });
    }

    if (!verifyWooAuthEventSignature({
      secret: connection.webhookSecret,
      timestamp,
      signature,
      rawBody,
    })) {
      return res.status(401).json({ success: false, message: 'Invalid auth-event signature' });
    }

    const event = req.body;
    if (!['customer.login', 'customer.password_reset_requested'].includes(event?.topic)
      || !event?.customer?.id
      || !event?.storeUrl
      || !normalizeWooStoreHost(connection.storeUrl)
      || normalizeWooStoreHost(event.storeUrl) !== normalizeWooStoreHost(connection.storeUrl)) {
      return res.status(400).json({ success: false, message: 'Unsupported event or store identity mismatch' });
    }

    const customerName = String(event.customer.name || 'Customer').slice(0, 100);
    const occurredAt = new Date(event.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      return res.status(400).json({ success: false, message: 'A valid event timestamp is required' });
    }
    event.occurredAt = occurredAt.toISOString();
    const isReset = event.topic === 'customer.password_reset_requested';
    if (isReset) {
      const allowHttp = process.env.NODE_ENV !== 'production';
      if (!isWooStoreUrl({ candidate: event.resetUrl, storeUrl: connection.storeUrl, allowHttp })) {
        return res.status(400).json({ success: false, message: 'Reset URL must use the connected WooCommerce store host' });
      }
      event.resetUrl = new URL(event.resetUrl).toString();
    }

    const normalizedPhone = normalizeWooPhone(event.customer.phone);
    if (!normalizedPhone && process.env.MOCK_WHATSAPP !== 'true') {
      return res.status(422).json({ success: false, message: 'Customer phone number is missing or invalid' });
    }
    if (process.env.MOCK_WHATSAPP !== 'true' && event.customer.phoneVerified !== true) {
      return res.status(422).json({ success: false, message: 'Customer phone must be verified before WhatsApp delivery' });
    }

    const delivery = await deliverWooAuthWhatsAppMessage({
      prisma,
      tenantId,
      event,
      customerName,
      phone: normalizedPhone,
    });
    return res.status(200).json({
      success: true,
      accepted: true,
      delivery: delivery.simulated ? 'simulated' : 'sent',
    });
  } catch (error) {
    console.error('[WooCommerce Auth] Event handling failed:', error.message);
    return res.status(502).json({ success: false, message: 'WooCommerce auth event could not be delivered' });
  }
};
