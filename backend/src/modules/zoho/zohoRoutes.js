// src/modules/zoho/zohoRoutes.js 

import express from 'express';
import { verifyTenant, requireApprovedTenant } from '../../middlewares/authTenant.js';
import * as zohoController from './zohoController.js';

const router = express.Router();

// ── Connection Management ──
router.get('/connect', verifyTenant, requireApprovedTenant, zohoController.getConnectUrl);
router.get('/status', verifyTenant, zohoController.getStatus);
router.post('/test', verifyTenant, requireApprovedTenant, zohoController.testConnection);
router.post('/disconnect', verifyTenant, requireApprovedTenant, zohoController.disconnect);

// ── Contact Synchronization ──
router.post('/sync/contacts', verifyTenant, requireApprovedTenant, zohoController.triggerContactSync);
router.post('/sync/incremental', verifyTenant, requireApprovedTenant, zohoController.triggerIncrementalSync);
router.get('/sync/status', verifyTenant, zohoController.getSyncStatus);

export default router;