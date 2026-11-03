// backend/src/modules/tenant/users/tenant.users.routes.js (do not remove this comment)
import express from 'express';
import * as tenantController from './tenant.users.controller.js';
import { verifyTenant, requireApprovedTenant } from '../../../middlewares/auth.tenant.js';
import validate from '../../../middlewares/validate.middleware.js';
import {
    createUserSchema,
    updateUserSchema,
    userIdParamSchema,
} from '../../users/user.schema.js';

const router = express.Router();

router.post('/create-user', verifyTenant, requireApprovedTenant, validate(createUserSchema), tenantController.createUser);
router.get('/get-all-users', verifyTenant, tenantController.getUsersByTenant);
router.get('/get-user/:id', verifyTenant, validate(userIdParamSchema), tenantController.getUserById);
router.put('/update-user/:id', verifyTenant, requireApprovedTenant, validate(updateUserSchema), tenantController.updateUserById);
router.patch('/users/:id/deactivate', verifyTenant, requireApprovedTenant, tenantController.deactivateUserById);
router.patch('/users/:id/reactivate', verifyTenant, requireApprovedTenant, tenantController.reactivateUserById);
router.delete('/delete-user/:id', verifyTenant, requireApprovedTenant, validate(userIdParamSchema), tenantController.deleteUserById);

export default router;
