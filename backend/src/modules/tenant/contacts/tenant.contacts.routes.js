// backend/src/modules/tenant/contacts/tenant.contacts.routes.js (do not remove this comment)
import express from 'express';
import * as tenantController from './tenant.contacts.controller.js';
import { verifyTenant } from '../../../middlewares/auth.tenant.js';

const router = express.Router();

router.patch('/assign-contact/:contactId', verifyTenant, tenantController.assignContactController);
router.patch('/re-assign-contacts/:contactId', verifyTenant, tenantController.reassignContactController);
router.patch('/unassign-contact/:contactId', verifyTenant, tenantController.unassignContactController);
router.get('/unassigned-contacts', verifyTenant, tenantController.getUnassigned);
router.patch('/assign-multiple', verifyTenant, tenantController.assignMultipleContacts);

export default router;
