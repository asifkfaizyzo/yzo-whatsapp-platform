// backend/src/modules/webhook/webhookRoutes.js
import express from 'express';
import { verifyMetaWebhook, receiveMetaWebhookEvent, verifyMetaSignature } from './webhookController.js';

const router = express.Router();

// Meta verification endpoint (GET)
router.get('/whatsapp', verifyMetaWebhook);

// Meta message event receiver (POST)
router.post('/whatsapp', verifyMetaSignature, receiveMetaWebhookEvent);

export default router;