import express from 'express';
import { verifyTenant, requireApprovedTenant } from '../../middlewares/authTenant.js';
import { setupWhatsApp, exchangeToken, getWhatsAppStatus, getMyWabas, disconnectWhatsApp } from './whatsappController.js';

const router = express.Router();

// All routes require a verified, approved tenant
router.use(verifyTenant, requireApprovedTenant);

// POST /api2/whatsapp/exchange-token
// Exchanges auth code for long-lived access token and saves WABA/Phone to tenant
router.post('/exchange-token', exchangeToken);

// POST /api2/whatsapp/setup
// Saves WABA ID + Phone Number ID directly (fallback system token approach)
router.post('/setup', setupWhatsApp);
// GET /api2/whatsapp/status
// Returns whether this tenant has a WhatsApp number connected
router.get('/status', getWhatsAppStatus);

router.get('/my-wabas', getMyWabas);

router.post('/disconnect', disconnectWhatsApp);

export default router;