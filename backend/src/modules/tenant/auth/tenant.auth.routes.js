// backend/src/modules/tenant/auth/tenant.auth.routes.js (do not remove this comment)
import express from 'express';
import * as tenantController from './tenant.auth.controller.js';
import { verifyOnboarding } from '../../../middlewares/auth.tenant.js';
import validate from '../../../middlewares/validate.middleware.js';
import {
    loginSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    refreshTokenSchema,
    logoutSchema,
    googleLoginSchema,
    facebookLoginSchema,
} from '../../auth/auth.schema.js';
import {
    step1Schema,
    step2Schema,
    step3Schema,
    step4Schema,
    step5Schema,
} from './tenant.auth.schema.js';

const router = express.Router();

// ── Multi-Step Onboarding ──
router.post('/register/step-1', validate(step1Schema), tenantController.onboardingStep1);
router.put('/register/step-2', verifyOnboarding, validate(step2Schema), tenantController.onboardingStep2);
router.post('/register/verify-email', verifyOnboarding, tenantController.verifyEmailOtp);
router.put('/register/step-3', verifyOnboarding, validate(step3Schema), tenantController.onboardingStep3);
router.put('/register/step-4', verifyOnboarding, validate(step4Schema), tenantController.onboardingStep4);
router.put('/register/step-5', verifyOnboarding, validate(step5Schema), tenantController.onboardingStep5);
router.get('/register/status', tenantController.getOnboardingStatus);

// ── Auth ──
router.post('/login', validate(loginSchema), tenantController.loginTenant);
router.post('/logout', validate(logoutSchema), tenantController.logoutTenant);
router.post('/refresh-token', validate(refreshTokenSchema), tenantController.refreshTenantAccessToken);
router.post('/forgot-ten-password', validate(forgotPasswordSchema), tenantController.forgotPasswordTenant);
router.post('/reset-ten-password', validate(resetPasswordSchema), tenantController.resetPasswordTenant);

// ── Social Login ──
router.post('/google-login', validate(googleLoginSchema), tenantController.googleLoginTenant);
router.post('/facebook-login', validate(facebookLoginSchema), tenantController.facebookLoginTenant);

export default router;
