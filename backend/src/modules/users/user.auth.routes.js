// backend/src/modules/users/user.auth.routes.new.js (do not remove this comment)

import { Router } from "express";
import * as ctrl from "./user.auth.controller.new.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireUser } from "../../middleware/requireUser.js";
import {
  authLimiter,
  resetLimiter,
} from "../../middleware/rateLimiter.js";
import validate from "../../middlewares/validate.middleware.js";
import {
  loginSchema,
  logoutSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  googleLoginSchema,
  setUsernameSchema,
} from "./user.auth.schema.new.js";

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

router.post(
  "/google-login",
  authLimiter,
  validate(googleLoginSchema),
  ctrl.googleLogin,
);

// ═══════════════════════════════════════════════════════════
// AUTHENTICATED ROUTES
// ═══════════════════════════════════════════════════════════

router.put(
  "/set-username",
  authenticate,
  requireUser,
  validate(setUsernameSchema),
  ctrl.setUsername,
);

export default router;