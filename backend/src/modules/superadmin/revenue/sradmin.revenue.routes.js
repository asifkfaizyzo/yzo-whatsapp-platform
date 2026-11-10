// backend/src/modules/superadmin/revenue/sradmin.revenue.routes.js
import express from "express";
import {
  getPlatformRevenueStats,
  getRevenueStats,
  getRevenuePayments,
  getTenantBillingDetail,
  adminDownloadInvoice,
} from "./sradmin.revenue.controller.js";
import { authenticate } from "../../../middleware/authenticate.js";
import { requireSRAdmin } from "../../../middleware/requireSRAdmin.js";

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

// ── Invoice download (adminDownloadInvoice wins — was first-mount in app.js) ──
router.get(
  "/revenue/invoice/:paymentId",
  authenticate, requireSRAdmin,
  adminDownloadInvoice,
);

export default router;