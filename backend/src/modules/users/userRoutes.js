import express from 'express';
import * as userController from './userController.js';

import {generateAccessToken, generateRefreshToken} from '../auth/jwtservice.js';
import {forgotPasswordUser,resetPasswordUser,} from './userController.js';

const router = express.Router();

// ✅ Protected user routes
router.post('/login-user', userController.loginUser);

router.post('/logout-user', userController.logoutUser);

router.post('/refresh-user-access', userController.refreshUserAccessToken);

router.post('/forgot-usr-password', userController.forgotPasswordUser);

router.post('/reset-usr-password', userController.resetPasswordUser);

export default router;