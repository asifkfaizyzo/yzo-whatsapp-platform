// backend/src/modules/tenant/integrations/tenant.integrations.routes.js (do not remove this comment)
import express from "express";
import * as tenantController from "./tenant.integrations.controller.js";
import * as razorpayOAuthController from "../razorpay.oauth.controller.js";
import { authenticate } from "../../../middleware/authenticate.js";
import { requireTenant } from "../../../middleware/requireTenant.js";

const router = express.Router();

// ── WhatsApp Credentials ──
router.get(
  "/whatsapp-credentials",
  authenticate, requireTenant,
  tenantController.getWhatsappCredentials,
);
router.put(
  "/whatsapp-credentials",
  authenticate, requireTenant,
  tenantController.updateWhatsappCredentials,
);

// ── Meta (FB & IG) Channels ──
router.get(
  "/meta-channels/status",
  authenticate, requireTenant,
  tenantController.getMetaChannelsStatus,
);
router.post(
  "/meta-channels/connect",
  authenticate, requireTenant,
  tenantController.connectMetaChannels,
);
router.delete(
  "/meta-channels/disconnect",
  authenticate, requireTenant,
  tenantController.disconnectMetaChannels,
);

// ── Payment Gateway (Razorpay Direct) ──
router.get(
  "/payment-gateway",
  authenticate, requireTenant,
  tenantController.getPaymentGatewayConfig,
);
router.put(
  "/payment-gateway",
  authenticate, requireTenant,
  tenantController.updatePaymentGatewayConfig,
);
router.post(
  "/payment-gateway/test",
  authenticate, requireTenant,
  tenantController.testPaymentGatewayConnection,
);

// ── Payment Gateway (Razorpay OAuth) ──
router.get(
  "/payment-gateway/oauth/url",
  authenticate, requireTenant,
  razorpayOAuthController.getOAuthAuthorizeUrl,
);
router.get(
  "/payment-gateway/oauth/status",
  authenticate, requireTenant,
  razorpayOAuthController.getOAuthStatus,
);
router.post(
  "/payment-gateway/oauth/disconnect",
  authenticate, requireTenant,
  razorpayOAuthController.disconnectRazorpayOAuth,
);

export default router;
