import express from 'express';
import * as superAdminController from './superadminController.js';
import {verifySuperAdmin} from '../../middlewares/authSuperAdmin.js';


const router = express.Router();

// router.post('/create',superAdminController.createSuperAdmin);
//SuperAdmin Auth Routes
router.post('/create',superAdminController.createSuperAdmin);

router.post('/login',superAdminController.loginSuperAdmin);

router.post('/logout',superAdminController.logoutSuperAdmin);

router.post('/refresh-token',superAdminController. refreshAccessTokenController);

router.post('/forgot-sup-password',superAdminController.forgotPasswordSuperAdmin);

router.post('/reset-sup-password', superAdminController.resetPasswordSuperAdmin);


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

router.get('/get-tenant/:id', verifySuperAdmin, superAdminController.getTenantById);

router.put('/update-tenant/:id', verifySuperAdmin, superAdminController.updateTenantById);

router.patch('/deactivate-tenant/:id', verifySuperAdmin, superAdminController.deactivateTenant);

router.patch('/reactivate-tenant/:id', verifySuperAdmin, superAdminController.reactivateTenant);

router.delete('/delete-tenant/:id', verifySuperAdmin, superAdminController.deleteTenantById);


// Tenant Status
router.patch('/approve-tenant/:id', verifySuperAdmin, superAdminController.approveTenant);

router.patch('/block-tenant/:id', verifySuperAdmin, superAdminController.blockTenant);

router.patch('/unblock-tenant/:id', verifySuperAdmin, superAdminController.unblockTenant);

export default router;