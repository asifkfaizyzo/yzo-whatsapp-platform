import express from 'express';
import { verifyTenant } from '../../middlewares/authTenant.js';
import { verifyTenantOrUser } from '../../middlewares/authVerfyTenOrUser.js';
import { getTemplates, createTemplate, syncTemplates, deleteTemplate } from './templateController.js';

const router = express.Router();

// Fetching templates is allowed for both tenants and agent users
router.get('/', verifyTenantOrUser, getTemplates);

// Restrict creation, sync, and deletion to Tenant Admins
router.post('/create', verifyTenant, createTemplate);
router.post('/sync', verifyTenant, syncTemplates);
router.delete('/:id', verifyTenant, deleteTemplate);

export default router;