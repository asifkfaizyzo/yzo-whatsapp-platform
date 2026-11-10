// backend/src/modules/tenant/auth/tenant.auth.routes.js (do not remove this comment)

import { Router } from "express";
import * as ctrl from "./tenant.auth.controller.js";
import { authenticate } from "../../../middleware/authenticate.js";
import { requireTenant } from "../../../middleware/requireTenant.js";
import { requireOnboarding } from "../../../middleware/requireOnboarding.js";
import {
  authLimiter,
  signupLimiter,
  otpLimiter,
  resetLimiter,
  usernameCheckLimiter,
} from "../../../middleware/rateLimiter.js";
import validate from "../../../middleware/validate.js";
import {
  signupSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  googleSignupSchema,
  facebookSignupSchema,
  googleLoginSchema,
  facebookLoginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  checkUsernameSchema,
  usernameSuggestionsSchema,
  setUsernameSchema,
  profileSchema,
  verifyOtpSchema,
  onboardingStepSchema,
  setPasswordSchema,
} from "./tenant.auth.schema.js";

const router = Router();

// ═══════════════════════════════════════════════════════════
// PUBLIC ROUTES (no auth required)
// ═══════════════════════════════════════════════════════════

// ── Email Signup & Login ──
router.post("/signup", signupLimiter, validate(signupSchema), ctrl.signup);
router.post("/login", authLimiter, validate(loginSchema), ctrl.login);

// ── Token Management ──
router.post("/logout", validate(logoutSchema), ctrl.logout);
router.post("/refresh", validate(refreshSchema), ctrl.refresh);

// ── OAuth Signup (creates account or auto-logins) ──
router.post(
  "/google-signup",
  signupLimiter,
  validate(googleSignupSchema),
  ctrl.googleSignup,
);
router.post(
  "/facebook-signup",
  signupLimiter,
  validate(facebookSignupSchema),
  ctrl.facebookSignup,
);

// ── OAuth Login (existing accounts only) ──
router.post(
  "/google-login",
  authLimiter,
  validate(googleLoginSchema),
  ctrl.googleLogin,
);
router.post(
  "/facebook-login",
  authLimiter,
  validate(facebookLoginSchema),
  ctrl.facebookLogin,
);

// ── Password Reset ──
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
// ONBOARDING ROUTES (auth + onboarding status required)
// ═══════════════════════════════════════════════════════════

router.get(
  "/check-username",
  authenticate,
  requireOnboarding,
  usernameCheckLimiter,
  validate(checkUsernameSchema),
  ctrl.checkUsername,
);

router.get(
  "/username-suggestions",
  authenticate,
  requireOnboarding,
  validate(usernameSuggestionsSchema),
  ctrl.usernameSuggestions,
);

router.put(
  "/onboarding/profile",
  authenticate,
  requireOnboarding,
  validate(profileSchema),
  ctrl.updateProfile,
);

router.post(
  "/onboarding/verify-email",
  authenticate,
  requireOnboarding,
  otpLimiter,
  validate(verifyOtpSchema),
  ctrl.verifyEmailOtp,
);

router.post(
  "/onboarding/resend-otp",
  authenticate,
  requireOnboarding,
  otpLimiter,
  ctrl.resendOtp,
);

router.put(
  "/onboarding/step",
  authenticate,
  requireOnboarding,
  validate(onboardingStepSchema),
  ctrl.updateOnboardingStep,
);

router.put(
  "/onboarding/set-password",
  authenticate,
  requireOnboarding,
  validate(setPasswordSchema),
  ctrl.setPassword,
);

// ═══════════════════════════════════════════════════════════
// LEGACY GUARD (for ACTIVE tenants with NULL username)
// ═══════════════════════════════════════════════════════════

router.put(
  "/set-username",
  authenticate,
  requireTenant,
  validate(setUsernameSchema),
  ctrl.setUsername,
);

export default router;