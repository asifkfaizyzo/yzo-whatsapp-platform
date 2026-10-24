import express from 'express';
import { verifyTenantOrUser } from '../../middlewares/authVerfyTenOrUser.js';
import * as shopifyController from './shopifyController.js';
import * as shopifyOAuthController from './shopifyOAuthController.js';
import * as shopifyWebhookController from './shopifyWebhookController.js';

const router = express.Router();

// 1. PUBLIC ROUTES (No Auth Middleware - Called by Shopify directly)
router.get('/oauth/callback', shopifyOAuthController.handleOAuthCallback);
router.post('/webhooks', shopifyWebhookController.handleIncomingWebhook);

// 2. AUTHENTICATED ROUTES (Requires SudoReply User Context)
router.use(verifyTenantOrUser);

router.get('/oauth/url', shopifyOAuthController.getOAuthUrl);
router.post('/connect', shopifyController.connect);
router.get('/status', shopifyController.getStatus);
router.put('/cart-recovery-settings', shopifyController.updateCartRecoverySettings);
router.post('/disconnect', shopifyController.disconnect);
router.delete('/disconnect', shopifyController.disconnect);

export default router;