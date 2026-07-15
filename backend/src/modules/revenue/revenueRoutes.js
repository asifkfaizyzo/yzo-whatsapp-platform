// backend/src/modules/revenue/revenueRoutes.js

import express from "express";
import {
  getPlatformRevenueStats,
  getRevenueStats,
  getRevenuePayments,
  getTenantBillingDetail,
  getInvoiceUrl,
} from "./revenueController.js";
import { verifySuperAdmin } from "../../middlewares/authSuperAdmin.js";

const router = express.Router();

// ── Dashboard card ──
router.get("/revenue-stats", verifySuperAdmin, getPlatformRevenueStats);

// ── Revenue page ──
router.get("/revenue/stats",              verifySuperAdmin, getRevenueStats);
router.get("/revenue/payments",           verifySuperAdmin, getRevenuePayments);
router.get("/revenue/tenant/:tenantId",   verifySuperAdmin, getTenantBillingDetail);
router.get("/revenue/invoice/:paymentId", verifySuperAdmin, getInvoiceUrl);

export default router;