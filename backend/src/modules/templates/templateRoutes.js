import express from 'express';
import { verifyTenant } from '../../middlewares/authTenant.js';
import { verifyTenantOrUser } from '../../middlewares/authVerfyTenOrUser.js';
import { checkSubscriptionAccess } from '../../middlewares/checkSubscriptionAccess.js';
import { getTemplates, createTemplate, syncTemplates, deleteTemplate } from './templateController.js';
import templateUpload from '../../middlewares/templateUpload.middleware.js';

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