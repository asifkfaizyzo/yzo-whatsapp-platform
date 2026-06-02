import express from 'express';
import * as tenantController from './tenantController.js';
import {verifyTenant} from '../../middlewares/authTenant.js';

import {generateAccessToken, generateRefreshToken} from '../auth/jwtservice.js';

const router = express.Router();

router.post('/register', tenantController.registerTenant);

router.post('/login', tenantController.loginTenant);

router.post('/logout', tenantController.logoutTenant);

router.post('/refresh-token', tenantController.refreshTenantAccessToken);



//create user by tenant_🔥Protected Route
router.post('/create-user', verifyTenant, tenantController.createUser);

router.get('/get-all-users', verifyTenant, tenantController.getUsersByTenant);

router.get('/get-user/:id', verifyTenant, tenantController.getUserById);

router.put('/update-user/:id', verifyTenant, tenantController.updateUserById);

router.patch('/users/:id/deactivate', verifyTenant, tenantController.deactivateUserById);

router.patch('/users/:id/reactivate', verifyTenant, tenantController.reactivateUserById);

router.delete('/delete-user/:id', verifyTenant, tenantController.deleteUserById);

export default router;