
import express from 'express';
import * as googleSheetsController from './googleSheetsController.js';
import { verifyTenant } from '../../middlewares/authTenant.js'; // Check path to your verifyTenant file

const router = express.Router();

// ── Auth & Status ──
router.get('/auth-url', verifyTenant, googleSheetsController.getAuthUrl);
router.get('/callback', googleSheetsController.handleCallback);
router.get('/status', verifyTenant, googleSheetsController.getStatus);
router.delete('/disconnect', verifyTenant, googleSheetsController.disconnect);

// ── Column Configuration Routes ──
router.get('/fields', verifyTenant, googleSheetsController.getFields);
router.post('/fields', verifyTenant, googleSheetsController.createField);
router.put('/fields/reorder', verifyTenant, googleSheetsController.reorderFields);
router.put('/fields/:fieldId', verifyTenant, googleSheetsController.updateField);
router.put('/fields/:fieldId/toggle', verifyTenant, googleSheetsController.toggleField);
router.delete('/fields/:fieldId', verifyTenant, googleSheetsController.deleteField);
router.post('/fields/sync', verifyTenant, googleSheetsController.syncFields);

// ── Sheet Preview & Broadcast ──
router.get('/preview', verifyTenant, googleSheetsController.previewSheet);
router.post('/broadcast', verifyTenant, googleSheetsController.createBroadcast);



export default router;