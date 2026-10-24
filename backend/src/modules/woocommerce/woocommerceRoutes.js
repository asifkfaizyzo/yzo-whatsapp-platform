// src/modules/woocommerce/woocommerceRoutes.js
import express from 'express';
import { handleWooCommerceWebhook } from '../webhook/woocommerceWebhookController.js';
import { handleWooCommerceCartEvent } from '../webhook/woocommerceCartWebhookController.js';
import { handleWooCommerceAuthEvent } from '../webhook/woocommerceAuthWebhookController.js';
import { handleWooCommerceOAuthCallback, getWooCommerceOAuthUrl } from './woocommerceOAuthController.js';
import {
  getWooCommerceStatus,
  getWooCommerceAuthWebhookConfig,
  getWooCommerceCartRecoveryWebhookConfig,
  connectWooCommerce,
  disconnectWooCommerce,
  saveWooCommerceTrackingUrlTemplates,
  updateWooCommerceAlertSettings,
  updateWooCommerceCartRecoverySettings,
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
const cartEventLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many WooCommerce cart events; try again shortly.' },
});

// 🔓 PUBLIC ROUTES
router.post('/webhook', handleWooCommerceWebhook);
router.post('/cart-events', cartEventLimiter, handleWooCommerceCartEvent);
router.post('/auth-events', authEventLimiter, handleWooCommerceAuthEvent);
router.post('/oauth/callback', handleWooCommerceOAuthCallback);
router.get('/oauth/callback', handleWooCommerceOAuthCallback);


// 🔒 PROTECTED TENANT ROUTES
router.use(verifyTenantOrUser);
router.get('/status', getWooCommerceStatus);
router.get('/auth-webhook-config', getWooCommerceAuthWebhookConfig);
router.get('/cart-recovery-webhook-config', getWooCommerceCartRecoveryWebhookConfig);
router.put('/tracking-url-templates', saveWooCommerceTrackingUrlTemplates);
router.put('/alert-settings', updateWooCommerceAlertSettings);
router.put('/cart-recovery-settings', updateWooCommerceCartRecoverySettings);
router.get('/oauth/url', getWooCommerceOAuthUrl);
router.post('/connect', connectWooCommerce);
router.post('/disconnect', disconnectWooCommerce);
router.delete('/disconnect', disconnectWooCommerce);


// ── Test Admin Alert Endpoints ─────────────────────────────────────────
router.post('/test/low-stock', async (req, res) => {
  try {
    const { processLowStockAlerts } = await import('./woocommerceAlertService.js');
    await processLowStockAlerts();
    res.json({ success: true, message: 'Low stock scanner triggered' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/test/daily-summary', async (req, res) => {
  try {
    const { processDailyBusinessSummary } = await import('./woocommerceAlertService.js');
    await processDailyBusinessSummary();
    res.json({ success: true, message: 'Daily business summary scanner triggered' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


export default router;