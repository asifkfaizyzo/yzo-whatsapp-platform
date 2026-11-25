// backend/src/modules/superadmin/auth/sradmin.auth.routes.js (do not remove this comment)

import { Router } from "express";
import * as ctrl from "./sradmin.auth.controller.js";
import { authenticate } from "../../../middleware/authenticate.js";
import { requireSRAdmin } from "../../../middleware/requireSRAdmin.js";
import {
  authLimiter,
  resetLimiter,
} from "../../../middleware/rateLimiter.js";
import validate from "../../../middleware/validate.js";
import {
  createSRAdminSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./sradmin.auth.schema.js";

const router = Router();

// ═══════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ═══════════════════════════════════════════════════════════

router.post("/login", authLimiter, validate(loginSchema), ctrl.login);
router.post("/logout", validate(logoutSchema), ctrl.logout);
router.post("/refresh", validate(refreshSchema), ctrl.refresh);

router.post(
  "/forgot-password",
  resetLimiter,
  validate(forgotPasswordSchema),
  ctrl.forgotPassword,
);
router.post(
  "/reset-password",
  resetLimiter,
  validate(resetPasswordSchema),
  ctrl.resetPassword,
);

// ═══════════════════════════════════════════════════════════
// PROTECTED ROUTES (existing SRAdmin only)
// ═══════════════════════════════════════════════════════════

router.post(
  "/create",
  authenticate,
  requireSRAdmin,
  validate(createSRAdminSchema),
  ctrl.createSRAdmin,
);

// ── Profile health check (moved from superadmin.routes.js) ──
router.get("/profile", authenticate, requireSRAdmin, (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Middleware working properly",
    superAdmin: req.srAdmin,
  });
});

export default router;