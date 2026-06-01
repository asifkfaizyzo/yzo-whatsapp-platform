import express from 'express';
import * as superAdminController from './superadminController.js';
import {verifySuperAdmin} from '../../middlewares/authSuperAdmin.js';

const router = express.Router();


// router.post('/create',superAdminController.createSuperAdmin);

router.post('/create',superAdminController.createSuperAdmin);

router.post('/login',superAdminController.loginSuperAdmin);

router.post('/logout',superAdminController.logoutSuperAdmin);

router.post('/refresh-token',superAdminController. refreshAccessTokenController);

// 🔥 Protected Route
router.get('/profile', verifySuperAdmin, (req, res) => {
    return res.status(200).json({
      success: true,
      message: 'Middleware working properly', superAdmin:
        req.superAdmin,
    });

  }
);

export default router;