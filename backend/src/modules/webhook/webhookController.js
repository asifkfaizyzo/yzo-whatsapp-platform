import crypto from 'crypto';
import { webhookQueue } from '../../queues/webhookQueue.js';

export const verifyMetaSignature = (req, res, next) => {
  // Support single or multiple secrets across Meta products (WhatsApp, Messenger, Instagram)
  const rawSecrets = [
    process.env.META_APP_SECRET,
    process.env.INSTAGRAM_APP_SECRET,
    process.env.FACEBOOK_APP_SECRET,
  ]
    .filter(Boolean)
    .flatMap(s => s.split(','))
    .map(s => s.trim().replace(/^["']|["']$/g, ''))
    .filter(s => s && s !== 'your_meta_app_secret_here');

  // Enforce secret requirement in production
  if (rawSecrets.length === 0) {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ META_APP_SECRET is missing in production! Rejecting webhook.');
      return res.status(500).json({ success: false, message: 'Server configuration error' });
    }
    console.warn('⚠️ META_APP_SECRET is not configured or using placeholder in .env. Skipping signature verification in dev.');
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

  const receivedSignature = signatureHeader.includes('sha256=')
    ? signatureHeader.split('sha256=')[1].trim().toLowerCase()
    : signatureHeader.trim().toLowerCase();

  const rawBody = req.rawBody || '';

  const matchedSecret = rawSecrets.find(secret => {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')
      .toLowerCase();
    return receivedSignature === expected;
  });

  if (!matchedSecret) {
    console.warn('⚠️ Webhook signature validation failed! Request unauthorized.');
    console.warn('🔍 [Meta Webhook Debug]:', {
      object: req.body?.object || 'unknown',
      url: req.originalUrl,
      hasRawBody: Boolean(req.rawBody),
      rawBodyLength: req.rawBody ? req.rawBody.length : 0,
      receivedSignaturePrefix: receivedSignature ? receivedSignature.substring(0, 10) + '...' : 'none',
      configuredSecretsCount: rawSecrets.length,
      secretPrefixes: rawSecrets.map(s => s.substring(0, 4) + '...'),
    });
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

    if (['whatsapp_business_account', 'page', 'instagram'].includes(body.object)) {
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