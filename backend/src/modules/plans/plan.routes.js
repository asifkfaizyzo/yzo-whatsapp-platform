// backend/src/modules/plans/plan.routes.js (do not remove this comment)
import { Router } from "express";
import {
  getPlans,
  getPublicPlans,
  getPlan,
  createPlan,
  updatePlan,
  toggleStatus,
  deletePlan,
  getFeatures,
  createFeature,
  deleteFeature,
  createPaymentOrder,
  verifyPaymentAndActivate,
  createSubscriptionTrial,
  verifySubscriptionTrial,
  createPaidSubscription,
  verifyPaidSubscription,
  getBillingDetails,
  downloadInvoice,
} from "./plan.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireSRAdmin } from "../../middleware/requireSRAdmin.js";
import { requireTenantOrUser } from "../../middleware/requireTenantOrUser.js";
import { requireTenant } from "../../middleware/requireTenant.js";

import rateLimit from "express-rate-limit";

const router = Router();

// Rate limiter for payment order creation to prevent order spam & DB bloat
const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: {
    success: false,
    message:
      "Too many payment orders initiated. Please wait a few minutes before trying again.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Public routes (no auth — for tenant pricing page) ──
router.get("/public", getPublicPlans);
router.get("/features", getFeatures);

// ── Razorpay routes (TENANT ONLY — not regular users/agents) ──
router.post("/create-order", authenticate, requireTenant, orderLimiter, createPaymentOrder);
router.post("/verify-payment", authenticate, requireTenant, verifyPaymentAndActivate);
router.post(
  "/create-subscription-trial",
  authenticate, requireTenant,
  orderLimiter,
  createSubscriptionTrial,
);
router.post(
  "/verify-subscription-trial",
  authenticate, requireTenant,
  verifySubscriptionTrial,
);
router.post(
  "/create-paid-subscription",
  authenticate, requireTenant,
  orderLimiter,
  createPaidSubscription,
);
router.post("/verify-paid-subscription", authenticate, requireTenant, verifyPaidSubscription);

// ── Billing details (TENANT ONLY — not users) ──
router.get("/billing", authenticate, requireTenant, getBillingDetails);
router.get("/billing/invoice/:paymentId", authenticate, requireTenant, downloadInvoice);

// ── Protected routes (superadmin only) ──
router.use(authenticate, requireSRAdmin);

router.get("/", getPlans);
router.get("/:id", getPlan);
router.post("/", createPlan);
router.put("/:id", updatePlan);
router.patch("/:id/toggle-status", toggleStatus);
router.delete("/:id", deletePlan);

router.post("/features/create", createFeature);
router.delete("/features/:id", deleteFeature);

export default router;
