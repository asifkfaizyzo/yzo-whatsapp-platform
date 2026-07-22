import express from 'express';
import { verifyTenant, requireApprovedTenant } from '../../middlewares/authTenant.js';
import { setupWhatsApp, getWhatsAppStatus, getMyWabas, disconnectWhatsApp } from './whatsappController.js';

const router = express.Router();

// All routes require a verified, approved tenant
router.use(verifyTenant, requireApprovedTenant);
// POST /api2/whatsapp/setup
// Saves WABA ID + Phone Number ID directly (from postMessage WA_EMBEDDED_SIGNUP FINISH event)
router.post('/setup', setupWhatsApp);
// GET /api2/whatsapp/status
// Returns whether this tenant has a WhatsApp number connected
router.get('/status', getWhatsAppStatus);

router.get('/my-wabas', getMyWabas);

router.post('/disconnect', disconnectWhatsApp);

export default router;