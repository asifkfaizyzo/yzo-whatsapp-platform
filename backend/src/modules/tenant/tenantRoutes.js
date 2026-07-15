// modules/tenant/tenantRoutes.js

import express from 'express';
import * as tenantController from './tenantController.js';
import { verifyTenant, requireApprovedTenant, verifyOnboarding } from '../../middlewares/authTenant.js';
import { verifyTenantOrUser } from '../../middlewares/authVerfyTenOrUser.js';

import {
    loginSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    refreshTokenSchema,
    logoutSchema,
    googleLoginSchema,
    changePasswordSchema
} from '../../validations/auth.validation.js';
import validate from '../../middlewares/validate.middleware.js';
import {
    step1Schema,
    step2Schema,
    step3Schema,
    step4Schema,
    step5Schema,
    updateAutoReopenSchema,
    updateTenantProfileSchema
} from '../../validations/tenant.validation.js';
import {
    createUserSchema,
    updateUserSchema,
    userIdParamSchema
} from '../../validations/user.validation.js';

// ✅ NO contactController import here - it lives in contacts folder
// ✅ NO contactCrudService import here - it lives in contacts folder

const router = express.Router();

// ===================== AUTH & ONBOARDING ROUTES =====================
router.post('/register/step-1', validate(step1Schema), tenantController.onboardingStep1);
router.put('/register/step-2', verifyOnboarding, validate(step2Schema), tenantController.onboardingStep2);
router.post('/register/verify-email', verifyOnboarding, tenantController.verifyEmailOtp);
router.put('/register/step-3', verifyOnboarding, validate(step3Schema), tenantController.onboardingStep3);
router.put('/register/step-4', verifyOnboarding, validate(step4Schema), tenantController.onboardingStep4);
router.put('/register/step-5', verifyOnboarding, validate(step5Schema), tenantController.onboardingStep5);
router.get('/register/status', tenantController.getOnboardingStatus);

router.post('/login', validate(loginSchema), tenantController.loginTenant);
router.post('/logout', validate(logoutSchema), tenantController.logoutTenant);
router.post('/refresh-token', validate(refreshTokenSchema), tenantController.refreshTenantAccessToken);
router.post('/forgot-ten-password', validate(forgotPasswordSchema), tenantController.forgotPasswordTenant);
router.post('/reset-ten-password', validate(resetPasswordSchema), tenantController.resetPasswordTenant);

router.post('/google-login', validate(googleLoginSchema), tenantController.googleLoginTenant);

// ===================== TENANT PROFILE =====================
router.get('/me', verifyTenant, tenantController.getLoggedInTenant);
router.put('/update-profile', verifyTenant, validate(updateTenantProfileSchema), tenantController.updateTenantProfile);
router.put('/change-password', verifyTenant, validate(changePasswordSchema), tenantController.updateTenantPassword);

// ===================== USER MANAGEMENT =====================
router.post('/create-user', verifyTenant, requireApprovedTenant, validate(createUserSchema), tenantController.createUser);
router.get('/get-all-users', verifyTenant, tenantController.getUsersByTenant);
router.get('/get-user/:id', verifyTenant, validate(userIdParamSchema), tenantController.getUserById);
router.put('/update-user/:id', verifyTenant, requireApprovedTenant, validate(updateUserSchema), tenantController.updateUserById);
router.patch('/users/:id/deactivate', verifyTenant, requireApprovedTenant, tenantController.deactivateUserById);
router.patch('/users/:id/reactivate', verifyTenant, requireApprovedTenant, tenantController.reactivateUserById);
router.delete('/delete-user/:id', verifyTenant, requireApprovedTenant, validate(userIdParamSchema), tenantController.deleteUserById);

// ===================== CONTACT ASSIGNMENT =====================
router.patch('/assign-contact/:contactId', verifyTenant, tenantController.assignContactController);
router.patch('/re-assign-contacts/:contactId', verifyTenant, tenantController.reassignContactController);
router.patch('/unassign-contact/:contactId', verifyTenant, tenantController.unassignContactController);
router.get('/unassigned-contacts', verifyTenant, tenantController.getUnassigned);
router.patch('/assign-multiple', verifyTenant, tenantController.assignMultipleContacts);

// ===================== CONVERSATIONS =====================
router.get('/list-User-conversations', verifyTenant, tenantController.listConversationsController);

// ===================== AUTO-REOPEN =====================
router.get('/auto-reopen-config', verifyTenant, tenantController.getAutoReopenConfig);
router.put('/auto-reopen-config', verifyTenant, validate(updateAutoReopenSchema), tenantController.updateAutoReopenConfig);

// ===================== WHATSAPP CREDENTIALS =====================
router.get('/whatsapp-credentials', verifyTenant, tenantController.getWhatsappCredentials);
router.put('/whatsapp-credentials', verifyTenant, tenantController.updateWhatsappCredentials);

export default router;