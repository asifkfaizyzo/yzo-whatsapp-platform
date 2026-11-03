// backend/src/modules/webhook/webhook.routes.js (do not remove this comment)
import express from 'express';
import rateLimit from 'express-rate-limit';
import { verifyMetaWebhook, receiveMetaWebhookEvent, verifyMetaSignature } from './webhook.controller.js';
import { handleRazorpayWebhook } from './razorpay.webhook.controller.js';
import { handleTenantOrderWebhook, handlePartnerWebhook } from './order.webhook.controller.js';
import { handleShopifyWebhook } from '../shopify/shopify.webhook.controller.js';        
import { handleWooCommerceWebhook } from './woocommerce.webhook.controller.js';

const router = express.Router();

// Webhook rate limiter (up to 300 req / minute per IP for high-volume gateway callbacks)
const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many webhook requests from this IP' }
});

// Meta verification endpoint (GET)
router.get('/whatsapp', verifyMetaWebhook);
router.get('/meta', verifyMetaWebhook);

// Meta message event receiver (POST)
router.post('/whatsapp', verifyMetaSignature, receiveMetaWebhookEvent);
router.post('/meta', verifyMetaSignature, receiveMetaWebhookEvent);

// Platform SaaS billing Razorpay webhook endpoint
router.post("/razorpay", handleRazorpayWebhook);

// Multi-tenant Commerce Razorpay webhook endpoint (Direct Keys per-tenant webhook)
router.post("/razorpay/order/:tenantId", webhookRateLimiter, handleTenantOrderWebhook);

// Programmatic Partner & Sub-Merchant Commerce Razorpay webhook endpoint (OAuth Mode)
router.post("/razorpay/partner", webhookRateLimiter, handlePartnerWebhook);

router.post("/shopify", webhookRateLimiter, handleShopifyWebhook);
router.post("/woocommerce", webhookRateLimiter, handleWooCommerceWebhook);

export default router;