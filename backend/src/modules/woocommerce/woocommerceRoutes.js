// src/modules/woocommerce/woocommerceRoutes.js
import express from 'express';
import { handleWooCommerceWebhook } from '../webhook/woocommerceWebhookController.js';
import { handleWooCommerceAuthEvent } from '../webhook/woocommerceAuthWebhookController.js';
import { handleWooCommerceOAuthCallback, getWooCommerceOAuthUrl } from './woocommerceOAuthController.js';
import { processAbandonedCartReminders } from './woocommerceCartRecoveryService.js';
import {
  getWooCommerceStatus,
  getWooCommerceAuthWebhookConfig,
  connectWooCommerce,
  disconnectWooCommerce,
  saveWooCommerceTrackingUrlTemplates,
  updateWooCommerceAlertSettings,
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
router.put('/alert-settings', updateWooCommerceAlertSettings);
router.get('/oauth/url', getWooCommerceOAuthUrl);
router.post('/connect', connectWooCommerce);
router.post('/disconnect', disconnectWooCommerce);
router.delete('/disconnect', disconnectWooCommerce);


// inside the protected router section:
router.post('/test/trigger-cart-recovery', async (req, res) => {
  try {
    await processAbandonedCartReminders();
    res.json({ success: true, message: 'Cart recovery scanner triggered' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


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