// backend/src/modules/superadmin/superadmin.routes.js (do not remove this comment)
import express from "express";
import {
  getAllPayments,
  getTenantBilling,
  adminDownloadInvoice,
  getGSTSettings,
  updateGSTSettings,
} from "./superadmin.controller.js";

import { authenticate } from "../../middleware/authenticate.js";
import { requireSRAdmin } from "../../middleware/requireSRAdmin.js";

const router = express.Router();

// ══════════════════════════════════════
// PROFILE (simple health check)
// ══════════════════════════════════════
router.get("/profile", authenticate, requireSRAdmin, (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Middleware working properly",
    superAdmin: req.srAdmin,
  });
});

// ══════════════════════════════════════
// REVENUE ROUTES
// ══════════════════════════════════════
router.get("/revenue/payments", authenticate, requireSRAdmin, getAllPayments);
router.get("/revenue/tenant/:id", authenticate, requireSRAdmin, getTenantBilling);
router.get(
  "/revenue/invoice/:paymentId",
  authenticate, requireSRAdmin,
  adminDownloadInvoice,
);

// ══════════════════════════════════════
// GST / TAX SETTINGS
// ══════════════════════════════════════
router.get("/settings/tax", authenticate, requireSRAdmin, getGSTSettings);
router.put("/settings/tax", authenticate, requireSRAdmin, updateGSTSettings);

// ══════════════════════════════════════
// OPERATIONAL PLATFORM REPORTS
// ══════════════════════════════════════
import * as reportsController from "./reports.controller.js";

router.get("/reports/kpis", authenticate, requireSRAdmin, reportsController.getReportKPIs);
router.get(
  "/reports/messages",
  authenticate, requireSRAdmin,
  reportsController.getReportMessages,
);
router.get(
  "/reports/delivery",
  authenticate, requireSRAdmin,
  reportsController.getReportDelivery,
);
router.get(
  "/reports/tenants",
  authenticate, requireSRAdmin,
  reportsController.getReportTenants,
);
router.get(
  "/reports/system-health",
  authenticate, requireSRAdmin,
  reportsController.getReportSystemHealth,
);

export default router;