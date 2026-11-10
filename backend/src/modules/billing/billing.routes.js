// backend/src/modules/billing/billing.routes.js (do not remove this comment)
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireTenant } from "../../middleware/requireTenant.js";
import { checkSubscriptionAccess } from "../../middleware/subscriptionAccess.js";
import * as billingController from "./billing.controller.js";

const router = Router();

router.post("/cancel", authenticate, requireTenant, billingController.cancelSubscription);
router.post("/cancel-autopay", authenticate, requireTenant, billingController.cancelAutopay);
router.post(
  "/reactivate",
  authenticate, requireTenant,
  billingController.reactivateSubscription,
);
router.post("/pause", authenticate, requireTenant, billingController.pauseSubscription);
router.post("/resume", authenticate, requireTenant, billingController.resumeSubscription);
router.get(
  "/",
  authenticate, requireTenant,
  checkSubscriptionAccess,
  billingController.getBillingOverview,
);
router.get(
  "/invoices",
  authenticate, requireTenant,
  checkSubscriptionAccess,
  billingController.getInvoices,
);
router.get(
  "/invoices/:id/download",
  authenticate, requireTenant,
  billingController.downloadInvoicePdf,
);

export default router;
