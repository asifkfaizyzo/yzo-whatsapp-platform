// backend/src/modules/broadcasts/broadcast.routes.js (do not remove this comment)
import express from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireTenant } from "../../middleware/requireTenant.js";
import { requireTenantOrUser } from "../../middleware/requireTenantOrUser.js";
import { checkSubscriptionAccess } from "../../middleware/subscriptionAccess.js";
import {
  getBroadcasts,
  getBroadcastStats,
  getBroadcastRecipients,
  exportBroadcastRecipients,
  retryFailedBroadcast,
  pauseBroadcast,
  resumeBroadcast,
  launchBroadcast,
  cancelBroadcast,
} from "./broadcast.controller.js";
import { resolveWooCommerceSegment } from "./broadcast.wooSegment.service.js";
import { resolveShopifySegment } from "./broadcast.shopifySegment.service.js";

const router = express.Router();

// Viewing broadcasts list and stats/logs is allowed for users (agents) and tenants
router.get("/", authenticate, requireTenantOrUser, checkSubscriptionAccess, getBroadcasts);
router.get(
  "/:id/stats",
  authenticate, requireTenantOrUser,
  checkSubscriptionAccess,
  getBroadcastStats,
);
router.get(
  "/:id/recipients",
  authenticate, requireTenantOrUser,
  checkSubscriptionAccess,
  getBroadcastRecipients,
);
router.get(
  "/:id/export",
  authenticate, requireTenantOrUser,
  checkSubscriptionAccess,
  exportBroadcastRecipients,
);

// Actions restricted to Tenant Admins
router.post("/launch", authenticate, requireTenant, checkSubscriptionAccess, launchBroadcast);
router.post(
  "/:id/cancel",
  authenticate, requireTenant,
  checkSubscriptionAccess,
  cancelBroadcast,
);
router.post(
  "/:id/pause",
  authenticate, requireTenant,
  checkSubscriptionAccess,
  pauseBroadcast,
);
router.post(
  "/:id/resume",
  authenticate, requireTenant,
  checkSubscriptionAccess,
  resumeBroadcast,
);
router.post(
  "/:id/retry-failed",
  authenticate, requireTenant,
  checkSubscriptionAccess,
  retryFailedBroadcast,
);

// 🔒 TEST ROUTE: WooCommerce Smart Segmentation Tester
router.post(
  "/test/woo-segment",
  authenticate, requireTenantOrUser,
  checkSubscriptionAccess,
  async (req, res) => {
    try {
      const tenantId = req.tenantId || req.tenant?.id;
      const result = await resolveWooCommerceSegment(tenantId, {
        segmentMinSpend: req.body.segmentMinSpend ?? null,
        segmentMinOrders: req.body.segmentMinOrders ?? null,
        segmentInactiveDays: req.body.segmentInactiveDays ?? null,
        segmentIncludeAllWoo: req.body.segmentIncludeAllWoo ?? false,
      });
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error("Error testing woo segment:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  },
);

export default router;
