import express from 'express';
import { verifyTenant, requireApprovedTenant } from '../../middlewares/authTenant.js';
import { setupWhatsApp, exchangeToken, getWhatsAppStatus, getMyWabas, disconnectWhatsApp } from './whatsappController.js';

const router = express.Router();

// All routes require a verified, approved tenant
router.use(verifyTenant, requireApprovedTenant);

// whatsappRoutes.js - ADD TEMPORARILY
router.post('/debug-token-exchange', verifyTenant, async (req, res) => {
  const { code } = req.body;
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();

  const uris = [
    null,
    'https://sudoreply.com/',
    'https://sudoreply.com',
    'https://www.sudoreply.com/',
    'https://www.sudoreply.com',
    'https://sudoreply.com/dashboard',
    'https://www.sudoreply.com/dashboard',
    'https://sudoreply.com/settings',
    'https://sudoreply.com/connect',
    '',  // empty string
  ];

  const results = [];

  for (const uri of uris) {
    const params = new URLSearchParams({ client_id: appId, client_secret: appSecret, code });
    if (uri !== null) params.append('redirect_uri', uri);

    const label = uri === null ? '(null - omitted)' : uri === '' ? '(empty string)' : uri;

    try {
      const r = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?${params}`);
      const d = await r.json();
      
      const result = {
        uri: label,
        success: !!d.access_token,
        error: d.error?.message || null,
        subcode: d.error?.error_subcode || null,
      };
      results.push(result);
      
      console.log(`[Debug] ${result.success ? '✅' : '❌'} "${label}" → ${result.error || 'SUCCESS'}`);
      
      // Stop on first success - code can only be used once!
      if (d.access_token) {
        return res.json({ 
          found: true, 
          winning_uri: label,
          results,
          message: `✅ SET META_REDIRECT_URI="${label}" in your .env`
        });
      }
    } catch (e) {
      results.push({ uri: label, success: false, error: e.message });
    }
  }

  return res.json({ found: false, results });
});

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