import express from 'express';
import * as tenantController from './tenantController.js';
import { verifyTenant, requireApprovedTenant } from '../../middlewares/authTenant.js';

import {generateAccessToken, generateRefreshToken} from '../auth/jwtservice.js';
import {forgotPasswordTenant,resetPasswordTenant, } from './tenantController.js';

import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  logoutSchema,
} from '../../validations/auth.validation.js';
import validate from '../../middlewares/validate.middleware.js';
import { createTenantSchema } from '../../validations/tenant.validation.js';
import { createUserSchema, updateUserSchema, userIdParamSchema } from '../../validations/user.validation.js';

const router = express.Router();

router.post('/register', validate(createTenantSchema), tenantController.registerTenant);

router.post('/login', validate(loginSchema), tenantController.loginTenant);

router.post('/logout', validate(logoutSchema), tenantController.logoutTenant);

router.post('/refresh-token', validate(refreshTokenSchema), tenantController.refreshTenantAccessToken);

router.post('/forgot-ten-password', validate(forgotPasswordSchema), tenantController.forgotPasswordTenant);

router.post('/reset-ten-password', validate(resetPasswordSchema), tenantController.resetPasswordTenant);

router.get('/me', verifyTenant, tenantController.getLoggedInTenant);

router.get("/list-User-conversations",verifyTenant,tenantController.listConversationsController);



//create user by tenant_🔥Protected Route
router.post('/create-user', verifyTenant, requireApprovedTenant, validate(createUserSchema), tenantController.createUser);

router.get('/get-all-users', verifyTenant, tenantController.getUsersByTenant);

router.get('/get-user/:id', verifyTenant, validate(userIdParamSchema), tenantController.getUserById);

router.put('/update-user/:id', verifyTenant, requireApprovedTenant, validate(updateUserSchema), tenantController.updateUserById);

router.patch('/users/:id/deactivate', verifyTenant, requireApprovedTenant, tenantController.deactivateUserById);

router.patch('/users/:id/reactivate', verifyTenant, requireApprovedTenant, tenantController.reactivateUserById);

router.delete('/delete-user/:id', verifyTenant, requireApprovedTenant, validate(userIdParamSchema), tenantController.deleteUserById);

// router.get('/unassigned-contacts', verifyTenant, tenantController.getUnassignedContacts);

router.patch('/assign-contact/:contactId', verifyTenant, tenantController.assignContactController);1

router.patch('/re-assign-contacts/:contactId', verifyTenant, tenantController. reassignContactController);

router.patch('/unassign-contact/:contactId', verifyTenant, tenantController.unassignContactController);

export default router;