// backend/src/modules/revenue/revenue.routes.js (do not remove this comment)

import express from "express";
import {
  getPlatformRevenueStats,
  getRevenueStats,
  getRevenuePayments,
  getTenantBillingDetail,
  getInvoiceUrl,
} from "./revenue.controller.js";
import { verifySuperAdmin } from "../../middlewares/auth.superAdmin.js";

const router = express.Router();

// ── Dashboard card ──
router.get("/revenue-stats", verifySuperAdmin, getPlatformRevenueStats);

// ── Revenue page ──
router.get("/revenue/stats", verifySuperAdmin, getRevenueStats);
router.get("/revenue/payments", verifySuperAdmin, getRevenuePayments);
router.get(
  "/revenue/tenant/:tenantId",
  verifySuperAdmin,
  getTenantBillingDetail,
);
router.get("/revenue/invoice/:paymentId", verifySuperAdmin, getInvoiceUrl);

export default router;
