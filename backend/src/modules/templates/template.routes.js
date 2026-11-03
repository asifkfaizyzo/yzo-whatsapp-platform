// backend/src/modules/templates/template.routes.js (do not remove this comment)
import express from 'express';
import { verifyTenant } from '../../middlewares/auth.tenant.js';
import { verifyTenantOrUser } from '../../middlewares/auth.verifyTenantOrUser.js';
import { checkSubscriptionAccess } from '../../middlewares/subscription.access.js';
import { getTemplates, createTemplate, syncTemplates, deleteTemplate } from './template.controller.js';
import templateUpload from '../../middlewares/upload.template.js';

const router = express.Router();

// Fetching templates is allowed for both tenants and agent users
router.get('/', verifyTenantOrUser, checkSubscriptionAccess, getTemplates);

// Restrict creation, sync, and deletion to Tenant Admins
// templateUpload.single('headerMedia') handles multipart/form-data for media header types.
// For NONE / TEXT / LOCATION, no file is expected and req.file will simply be undefined.
router.post(
  '/create',
  verifyTenant,
  checkSubscriptionAccess,
  templateUpload.single('headerMedia'),
  createTemplate
);

router.post('/sync',    verifyTenant, checkSubscriptionAccess, syncTemplates);
router.delete('/:id',   verifyTenant, checkSubscriptionAccess, deleteTemplate);

export default router;