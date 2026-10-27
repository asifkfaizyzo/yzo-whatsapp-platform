import express from 'express';
import { verifyTenantOrUser } from '../../middlewares/authVerfyTenOrUser.js';
import * as shopifyController from './shopifyController.js';
import * as shopifyOAuthController from './shopifyOAuthController.js';
import * as shopifyWebhookController from './shopifyWebhookController.js';
import * as shopifyProductController from './shopifyProductController.js';

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
router.get('/post-purchase-settings', shopifyController.getPostPurchaseSettings);
router.put('/post-purchase-settings', shopifyController.updatePostPurchaseSettings);
router.post('/disconnect', shopifyController.disconnect);
router.delete('/disconnect', shopifyController.disconnect);

// Category 5: bulk historical customer sync
router.post('/sync-customers', shopifyController.triggerCustomerSync);

// ── Category 6: Product Catalog Sync ──
router.post('/products/sync', shopifyProductController.triggerProductSync);
router.get('/products', shopifyProductController.listProducts);
router.get('/products/:shopifyProductId', shopifyProductController.getProduct);

// ── Back-in-Stock Subscription Endpoints ──
router.post('/back-in-stock/subscribe', shopifyController.subscribeBackInStock);
router.post('/back-in-stock/unsubscribe', shopifyController.unsubscribeBackInStock);
router.get('/back-in-stock/subscriptions', shopifyController.getBackInStockSubscriptions);

export default router;