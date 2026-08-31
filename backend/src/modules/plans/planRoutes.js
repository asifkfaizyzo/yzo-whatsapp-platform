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
  downloadInvoice
} from "./planController.js";
import { verifySuperAdmin } from "../../middlewares/authSuperAdmin.js"
import { verifyTenantOrUser } from "../../middlewares/authVerfyTenOrUser.js"
import { verifyTenant } from "../../middlewares/authTenant.js";

import rateLimit from "express-rate-limit";

const router = Router();

// Rate limiter for payment order creation to prevent order spam & DB bloat
const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: {
    success: false,
    message: "Too many payment orders initiated. Please wait a few minutes before trying again.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Public routes (no auth — for tenant pricing page) ──
router.get("/public", getPublicPlans);
router.get("/features", getFeatures);

// ── Razorpay routes (TENANT ONLY — not regular users/agents) ──
router.post("/create-order", verifyTenant, orderLimiter, createPaymentOrder);
router.post("/verify-payment", verifyTenant, verifyPaymentAndActivate);
router.post("/create-subscription-trial", verifyTenant, orderLimiter, createSubscriptionTrial);
router.post("/verify-subscription-trial", verifyTenant, verifySubscriptionTrial);
router.post("/create-paid-subscription", verifyTenant, orderLimiter, createPaidSubscription);
router.post("/verify-paid-subscription", verifyTenant, verifyPaidSubscription);


// ── Billing details (TENANT ONLY — not users) ──
router.get("/billing", verifyTenant, getBillingDetails);
router.get("/billing/invoice/:paymentId", verifyTenant, downloadInvoice);

// ── Protected routes (superadmin only) ──
router.use(verifySuperAdmin);

router.get("/", getPlans);
router.get("/:id", getPlan);
router.post("/", createPlan);
router.put("/:id", updatePlan);
router.patch("/:id/toggle-status", toggleStatus);
router.delete("/:id", deletePlan);

router.post("/features/create", createFeature);
router.delete("/features/:id", deleteFeature);

export default router;