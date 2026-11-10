// backend/src/modules/revenue/revenue.routes.js (do not remove this comment)

import express from "express";
import {
  getPlatformRevenueStats,
  getRevenueStats,
  getRevenuePayments,
  getTenantBillingDetail,
  getInvoiceUrl,
} from "./revenue.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireSRAdmin } from "../../middleware/requireSRAdmin.js";

const router = express.Router();

// ── Dashboard card ──
router.get("/revenue-stats", authenticate, requireSRAdmin, getPlatformRevenueStats);

// ── Revenue page ──
router.get("/revenue/stats", authenticate, requireSRAdmin, getRevenueStats);
router.get("/revenue/payments", authenticate, requireSRAdmin, getRevenuePayments);
router.get(
  "/revenue/tenant/:tenantId",
  authenticate, requireSRAdmin,
  getTenantBillingDetail,
);
router.get("/revenue/invoice/:paymentId", authenticate, requireSRAdmin, getInvoiceUrl);

export default router;
