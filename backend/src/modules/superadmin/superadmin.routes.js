// backend/src/modules/superadmin/superadmin.routes.js (do not remove this comment)
import express from "express";
import * as superAdminController from "./superadmin.controller.js";
import {
  getAllPayments,
  getTenantBilling,
  adminDownloadInvoice,
  getGSTSettings,
  updateGSTSettings,
} from "./superadmin.controller.js";

import { authenticate } from "../../middleware/authenticate.js";
import { requireSRAdmin } from "../../middleware/requireSRAdmin.js";

import {
  createSuperAdminSchema,
  registerTenantSchema,
  updateTenantByAdminSchema,
  superAdminIdParamSchema,
} from "./superadmin.schema.js";
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  logoutSchema,
} from "../auth/auth.schema.js";
import validate from "../../middleware/validate.js";

const router = express.Router();

// router.post('/create',superAdminController.createSuperAdmin);
//SuperAdmin Auth Routes
router.post(
  "/create",
  authenticate, requireSRAdmin,
  validate(createSuperAdminSchema),
  superAdminController.createSuperAdmin,
);

router.post(
  "/login",
  validate(loginSchema),
  superAdminController.loginSuperAdmin,
);

router.post(
  "/logout",
  validate(logoutSchema),
  superAdminController.logoutSuperAdmin,
);

router.post(
  "/refresh-token",
  validate(refreshTokenSchema),
  superAdminController.refreshAccessTokenController,
);

router.post(
  "/forgot-sup-password",
  validate(forgotPasswordSchema),
  superAdminController.forgotPasswordSuperAdmin,
);

router.post(
  "/reset-sup-password",
  validate(resetPasswordSchema),
  superAdminController.resetPasswordSuperAdmin,
);

// 🔥 Protected Route
router.get("/profile", authenticate, requireSRAdmin, (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Middleware working properly",
    superAdmin: req.srAdmin,
  });
});

//Tenant Management
router.post(
  "/register-tenant",
  authenticate, requireSRAdmin,
  validate(registerTenantSchema),
  superAdminController.registerTenant,
);

router.get(
  "/get-all-tenants",
  authenticate, requireSRAdmin,
  superAdminController.getAllTenants,
);

router.get(
  "/get-tenant/:id",
  authenticate, requireSRAdmin,
  validate(superAdminIdParamSchema),
  superAdminController.getTenantById,
);

router.put(
  "/update-tenant/:id",
  authenticate, requireSRAdmin,
  validate(updateTenantByAdminSchema),
  superAdminController.updateTenantById,
);

router.patch(
  "/deactivate-tenant/:id",
  authenticate, requireSRAdmin,
  superAdminController.deactivateTenant,
);

router.patch(
  "/reactivate-tenant/:id",
  authenticate, requireSRAdmin,
  superAdminController.reactivateTenant,
);

router.delete(
  "/delete-tenant/:id",
  authenticate, requireSRAdmin,
  validate(superAdminIdParamSchema),
  superAdminController.deleteTenantById,
);

// Tenant Status
router.patch(
  "/approve-tenant/:id",
  authenticate, requireSRAdmin,
  validate(superAdminIdParamSchema),
  superAdminController.approveTenant,
);

router.patch(
  "/block-tenant/:id",
  authenticate, requireSRAdmin,
  validate(superAdminIdParamSchema),
  superAdminController.blockTenant,
);

router.patch(
  "/unblock-tenant/:id",
  authenticate, requireSRAdmin,
  superAdminController.unblockTenant,
);

// Tenant User Control
router.patch(
  "/users/:id/deactivate",
  authenticate, requireSRAdmin,
  superAdminController.deactivateUser,
);

router.patch(
  "/users/:id/reactivate",
  authenticate, requireSRAdmin,
  superAdminController.reactivateUser,
);

// ── Revenue Routes ──
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
// ── GST / Tax Settings Routes ──
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
