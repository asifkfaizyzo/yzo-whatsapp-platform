// backend/src/modules/webhook/webhookRoutes.js
import express from 'express';
import { verifyMetaWebhook, receiveMetaWebhookEvent, verifyMetaSignature } from './webhookController.js';
import { handleRazorpayWebhook } from './razorpayWebhookController.js';

const router = express.Router();

// Meta verification endpoint (GET)
router.get('/whatsapp', verifyMetaWebhook);

// Meta message event receiver (POST)
// router.post('/whatsapp', verifyMetaSignature, receiveMetaWebhookEvent);



//Test use for development purposes, to bypass signature verification
// ✅ DEV MODE — skip signature verification
if (process.env.MOCK_WHATSAPP === 'true') {
  console.log('⚠️  MOCK_WHATSAPP=true → skipping Meta signature check')
  router.post('/whatsapp', receiveMetaWebhookEvent)
} else {
  router.post('/whatsapp', verifyMetaSignature, receiveMetaWebhookEvent)
}

// Razorpay webhook endpoint
router.post("/razorpay", handleRazorpayWebhook);

export default router;