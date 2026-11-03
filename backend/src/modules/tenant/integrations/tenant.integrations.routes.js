// backend/src/modules/tenant/integrations/tenant.integrations.routes.js (do not remove this comment)
import express from 'express';
import * as tenantController from './tenant.integrations.controller.js';
import * as razorpayOAuthController from '../razorpay.oauth.controller.js';
import { verifyTenant } from '../../../middlewares/auth.tenant.js';

const router = express.Router();

// ── WhatsApp Credentials ──
router.get('/whatsapp-credentials', verifyTenant, tenantController.getWhatsappCredentials);
router.put('/whatsapp-credentials', verifyTenant, tenantController.updateWhatsappCredentials);

// ── Meta (FB & IG) Channels ──
router.get('/meta-channels/status', verifyTenant, tenantController.getMetaChannelsStatus);
router.post('/meta-channels/connect', verifyTenant, tenantController.connectMetaChannels);
router.delete('/meta-channels/disconnect', verifyTenant, tenantController.disconnectMetaChannels);

// ── Payment Gateway (Razorpay Direct) ──
router.get('/payment-gateway', verifyTenant, tenantController.getPaymentGatewayConfig);
router.put('/payment-gateway', verifyTenant, tenantController.updatePaymentGatewayConfig);
router.post('/payment-gateway/test', verifyTenant, tenantController.testPaymentGatewayConnection);

// ── Payment Gateway (Razorpay OAuth) ──
router.get('/payment-gateway/oauth/url', verifyTenant, razorpayOAuthController.getOAuthAuthorizeUrl);
router.get('/payment-gateway/oauth/status', verifyTenant, razorpayOAuthController.getOAuthStatus);
router.post('/payment-gateway/oauth/disconnect', verifyTenant, razorpayOAuthController.disconnectRazorpayOAuth);

export default router;
