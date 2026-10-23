// src/modules/zoho/zohoRoutes.js

import express from 'express';
import { verifyTenant, requireApprovedTenant } from '../../middlewares/authTenant.js';
import * as zohoController from './zohoController.js';

const router = express.Router();

// ── Connection Management ──
router.get('/connect', verifyTenant, requireApprovedTenant, zohoController.getConnectUrl);
router.get('/status', verifyTenant, zohoController.getStatus);
router.get('/plan', verifyTenant, zohoController.getPlanInfo);
router.post('/test', verifyTenant, requireApprovedTenant, zohoController.testConnection);
router.post('/disconnect', verifyTenant, requireApprovedTenant, zohoController.disconnect);

// ── Contact Synchronization ──
router.post('/sync/contacts', verifyTenant, requireApprovedTenant, zohoController.triggerContactSync);
router.post('/sync/incremental', verifyTenant, requireApprovedTenant, zohoController.triggerIncrementalSync);
router.get('/sync/status', verifyTenant, zohoController.getSyncStatus);

// ── Preferences ──
router.get('/preferences', verifyTenant, zohoController.getPreferences);
router.put('/preferences', verifyTenant, requireApprovedTenant, zohoController.updatePreferences);

// ── Phase 6 Advanced CRM Endpoints ──
router.get('/products', verifyTenant, requireApprovedTenant, zohoController.listProducts);
router.post('/events', verifyTenant, requireApprovedTenant, zohoController.bookEvent);
router.post('/tickets/:ticketId/sync-case', verifyTenant, requireApprovedTenant, zohoController.syncTicketCase);
router.post('/invoices/:invoiceId/send-whatsapp', verifyTenant, requireApprovedTenant, zohoController.dispatchInvoice);


router.post('/sync/pull', verifyTenant, requireApprovedTenant, zohoController.triggerPullSync);

export default router;