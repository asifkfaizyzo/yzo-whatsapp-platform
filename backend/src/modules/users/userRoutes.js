import express from 'express';
import * as userController from './userController.js';

import {generateAccessToken, generateRefreshToken} from '../auth/jwtservice.js';
import {forgotPasswordUser,resetPasswordUser,} from './userController.js';
import { verifyTenantOrUser } from '../../middlewares/authVerfyTenOrUser.js';
import { verifyUser } from '../../middlewares/authUser.js';

import { 
         loginSchema, forgotPasswordSchema, resetPasswordSchema, 
         refreshTokenSchema, logoutSchema, changePasswordSchema, 
        } from '../../validations/auth.validation.js';
import validate from '../../middlewares/validate.middleware.js';

const router = express.Router();


// ═════════════════════════════════════════
// AUTH ROUTES
// ═════════════════════════════════════════
router.post('/login-user', validate(loginSchema), userController.loginUser);
router.post('/logout-user', validate(logoutSchema), userController.logoutUser);
router.post('/refresh-user-access', validate(refreshTokenSchema), userController.refreshUserAccessToken);
router.post('/forgot-usr-password', validate(forgotPasswordSchema), userController.forgotPasswordUser);
router.post('/reset-usr-password', validate(resetPasswordSchema), userController.resetPasswordUser);

// ═════════════════════════════════════════
// 🆕 USER PROFILE ROUTES
// ═════════════════════════════════════════
router.get('/me', verifyUser, userController.getUserProfile);
router.put('/change-password', verifyUser, userController.updateUserPassword);

// ═════════════════════════════════════════
// CONTACTS
// ═════════════════════════════════════════
router.get('/my-assigned-contacts', verifyUser, userController.getMyAssignedContacts);

export default router;