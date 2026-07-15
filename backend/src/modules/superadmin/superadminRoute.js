import express from 'express';
import * as superAdminController from './superadminController.js';
import {
  getAllPayments,getTenantBilling,adminDownloadInvoice,
} from './superadminController.js';

import {verifySuperAdmin} from '../../middlewares/authSuperAdmin.js';

import { createSuperAdminSchema, updateTenantByAdminSchema, superAdminIdParamSchema } from '../../validations/superAdmin.validation.js';
import { loginSchema, forgotPasswordSchema, resetPasswordSchema, refreshTokenSchema, logoutSchema } from '../../validations/auth.validation.js';
import validate from '../../middlewares/validate.middleware.js';


const router = express.Router();

// router.post('/create',superAdminController.createSuperAdmin);
//SuperAdmin Auth Routes
router.post('/create',verifySuperAdmin, validate(createSuperAdminSchema), superAdminController.createSuperAdmin);

router.post('/login', validate(loginSchema), superAdminController.loginSuperAdmin);

router.post('/logout',validate(logoutSchema), superAdminController.logoutSuperAdmin);

router.post('/refresh-token',validate(refreshTokenSchema), superAdminController. refreshAccessTokenController);

router.post('/forgot-sup-password',validate(forgotPasswordSchema), superAdminController.forgotPasswordSuperAdmin);

router.post('/reset-sup-password', validate(resetPasswordSchema), superAdminController.resetPasswordSuperAdmin);


// 🔥 Protected Route
router.get('/profile', verifySuperAdmin, (req, res) => {
    return res.status(200).json({
      success: true,
      message: 'Middleware working properly', superAdmin:
        req.superAdmin,
    });

  }
);


//Tenant Management
router.get('/get-all-tenants', verifySuperAdmin, superAdminController.getAllTenants);

router.get('/get-tenant/:id', verifySuperAdmin, validate(superAdminIdParamSchema), superAdminController.getTenantById);

router.put('/update-tenant/:id', verifySuperAdmin, validate(updateTenantByAdminSchema), superAdminController.updateTenantById);

router.patch('/deactivate-tenant/:id', verifySuperAdmin, superAdminController.deactivateTenant);

router.patch('/reactivate-tenant/:id', verifySuperAdmin, superAdminController.reactivateTenant);

router.delete('/delete-tenant/:id', verifySuperAdmin, validate(superAdminIdParamSchema), superAdminController.deleteTenantById);


// Tenant Status
router.patch('/approve-tenant/:id', verifySuperAdmin, validate(superAdminIdParamSchema), superAdminController.approveTenant);

router.patch('/block-tenant/:id', verifySuperAdmin, validate(superAdminIdParamSchema), superAdminController.blockTenant);

router.patch('/unblock-tenant/:id', verifySuperAdmin, superAdminController.unblockTenant);


// Tenant User Control
router.patch('/users/:id/deactivate', verifySuperAdmin, superAdminController.deactivateUser);

router.patch('/users/:id/reactivate', verifySuperAdmin, superAdminController.reactivateUser);

// ── Revenue Routes ──
router.get('/revenue/payments', verifySuperAdmin, getAllPayments);
router.get('/revenue/tenant/:id', verifySuperAdmin, getTenantBilling);
router.get('/revenue/invoice/:paymentId', verifySuperAdmin, adminDownloadInvoice);

export default router;