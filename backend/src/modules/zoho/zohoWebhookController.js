// src/modules/zoho/zohoWebhookController.js

import { processZohoWebhookEvent } from './zohoWebhookService.js';

/**
 * POST /api/zoho/webhook
 * Public endpoint — receives Zoho CRM notification events.
 * Tenant identification is done via the `token` field in the notification payload
 * (set to tenantId during subscription creation).
 */
export const handleZohoWebhook = async (req, res) => {
  try {
    const body = req.body;

    if (!body || !body.notifications) {
      return res.status(200).json({ status: 'ignored', reason: 'no_notifications' });
    }

    // Zoho expects a 200 response within 5 seconds.
    // Process asynchronously to avoid timeout.
    res.status(200).json({ status: 'ok' });

    // Process in background (fire-and-forget)
    processZohoWebhookEvent(body).catch((err) => {
      console.error('❌ [ZohoWebhook] Background processing failed:', err.message);
    });
  } catch (error) {
    console.error('❌ [ZohoWebhook] Ingestion error:', error);
    res.status(200).json({ status: 'error' }); // Always return 200 to prevent Zoho retries
  }
};