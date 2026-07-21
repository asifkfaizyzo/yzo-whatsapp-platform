import express from 'express';
import { verifyTenant, requireApprovedTenant } from '../../middlewares/authTenant.js';
import { verifyTenantOrUser } from '../../middlewares/authVerfyTenOrUser.js';
import { setupWhatsApp, getWhatsAppStatus, getMyWabas, disconnectWhatsApp } from './whatsappController.js';
import { setupWhatsAppSchema } from '../../validations/tenant.validation.js';
import validate from '../../middlewares/validate.middleware.js';

const router = express.Router();

// GET /api2/whatsapp/status - Allowed for both Tenants and Users (Agents)
router.get('/status', verifyTenantOrUser, getWhatsAppStatus);

// All other routes require a verified, approved tenant admin
router.use(verifyTenant, requireApprovedTenant);

// POST /api2/whatsapp/setup
router.post('/setup', validate(setupWhatsAppSchema), setupWhatsApp);

router.get('/my-wabas', getMyWabas);

router.post('/disconnect', disconnectWhatsApp);

export default router;