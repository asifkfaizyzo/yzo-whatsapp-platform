import crypto from 'crypto';
import { webhookQueue } from '../../queues/webhookQueue.js';

export const verifyMetaSignature = (req, res, next) => {
  const appSecret = process.env.META_APP_SECRET;

  // Enforce secret requirement in production
  if (!appSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ META_APP_SECRET is missing in production! Rejecting webhook.');
      return res.status(500).json({ success: false, message: 'Server configuration error' });
    }
    console.warn('⚠️ META_APP_SECRET is not configured in .env. Skipping signature verification in dev.');
    return next();
  }

  const signatureHeader = req.headers['x-hub-signature-256'];
  if (!signatureHeader) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️ Incoming webhook request missing x-hub-signature-256 header. (Skipping signature check in dev mode)');
      return next();
    }
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
      // Offload to BullMQ Queue asynchronously to ensure instant 200 response
      await webhookQueue.add('meta-webhook-payload', body, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 }
      });

      return res.status(200).send('EVENT_RECEIVED');
    }
    return res.sendStatus(404);
  } catch (err) {
    console.error('Webhook queuing error:', err);
    return res.sendStatus(500);
  }
};
