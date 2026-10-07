// src/modules/woocommerce/woocommerceRoutes.js
import express from 'express';
import { handleWooCommerceWebhook } from '../webhook/woocommerceWebhookController.js';
import { handleWooCommerceAuthEvent } from '../webhook/woocommerceAuthWebhookController.js';
import { handleWooCommerceOAuthCallback, getWooCommerceOAuthUrl } from './woocommerceOAuthController.js';
import {
  getWooCommerceStatus,
  getWooCommerceAuthWebhookConfig,
  connectWooCommerce,
  disconnectWooCommerce,
  saveWooCommerceTrackingUrlTemplates,
} from './woocommerceController.js';
import { verifyTenantOrUser } from '../../middlewares/authVerfyTenOrUser.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();
const authEventLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many WooCommerce auth events; try again shortly.' },
});

// 🔓 PUBLIC ROUTES
router.post('/webhook', handleWooCommerceWebhook);
router.post('/auth-events', authEventLimiter, handleWooCommerceAuthEvent);
router.post('/oauth/callback', handleWooCommerceOAuthCallback);
router.get('/oauth/callback', handleWooCommerceOAuthCallback);


// 🔒 PROTECTED TENANT ROUTES
router.use(verifyTenantOrUser);
router.get('/status', getWooCommerceStatus);
router.get('/auth-webhook-config', getWooCommerceAuthWebhookConfig);
router.put('/tracking-url-templates', saveWooCommerceTrackingUrlTemplates);
router.get('/oauth/url', getWooCommerceOAuthUrl);
router.post('/connect', connectWooCommerce);
router.post('/disconnect', disconnectWooCommerce);
router.delete('/disconnect', disconnectWooCommerce);

export default router;