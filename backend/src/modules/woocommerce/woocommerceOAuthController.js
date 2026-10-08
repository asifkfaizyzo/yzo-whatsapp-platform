import prisma from '../../config/prisma.js';
import { autoProvisionWebhooks } from './woocommerceService.js';

/**
 * Generates the 1-Click OAuth authorization URL for WooCommerce
 */
export const getWooCommerceOAuthUrl = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id;
    let { storeUrl } = req.query;

    if (!storeUrl) {
      return res.status(400).json({ success: false, message: 'storeUrl is required' });
    }

    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Tenant context missing' });
    }

    // Clean store URL
    let cleanUrl = storeUrl.trim().replace(/\/+$/, '');
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    // Upsert pending connection
    await prisma.wooCommerceConnection.upsert({
      where: { tenantId },
      update: { storeUrl: cleanUrl, status: 'PENDING' },
      create: {
        tenantId,
        storeUrl: cleanUrl,
        consumerKey: '',
        consumerSecret: '',
        status: 'PENDING'
      }
    });

    const backendUrl = process.env.BACKEND_URL || 'https://api.sudoreply.com';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';

    const callbackUrl = `${backendUrl}/api2/woocommerce/oauth/callback`;
    const returnUrl = `${frontendUrl}/dashboard/integrations?app=woocommerce&connected=true`;

    const authUrl = `${cleanUrl}/wc-auth/v1/authorize?app_name=SudoReply&scope=read_write&user_id=${encodeURIComponent(tenantId)}&return_url=${encodeURIComponent(returnUrl)}&callback_url=${encodeURIComponent(callbackUrl)}`;

    console.log('🔗 [WooCommerceOAuth] Generated auth URL for tenant:', tenantId);

    return res.json({ success: true, authUrl });
  } catch (error) {
    console.error('Error generating WooCommerce OAuth URL:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * WooCommerce posts generated consumer key & secret back to this endpoint
 */
export const handleWooCommerceOAuthCallback = async (req, res) => {
  try {
    console.log('📥 [WooCommerceOAuthCallback] Received credentials callback');

    let payload = req.body;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch (e) {}
    }
    if (!payload || Object.keys(payload).length === 0) {
      payload = req.query;
    }

    const { user_id, consumer_key, consumer_secret } = payload || {};

    if (!user_id || !consumer_key || !consumer_secret) {
      console.error('❌ [WooCommerceOAuthCallback] Missing parameters in payload:', payload);
      return res.status(400).json({ success: false, message: 'Missing required OAuth parameters' });
    }

    const tenantId = user_id;

    const existing = await prisma.wooCommerceConnection.findUnique({
      where: { tenantId }
    });

    const storeUrl = existing?.storeUrl || '';

    const connection = await prisma.wooCommerceConnection.upsert({
      where: { tenantId },
      update: {
        consumerKey: consumer_key,
        consumerSecret: consumer_secret,
        status: 'CONNECTED'
      },
      create: {
        tenantId,
        storeUrl,
        consumerKey: consumer_key,
        consumerSecret: consumer_secret,
        status: 'CONNECTED'
      }
    });

    console.log(`✅ [WooCommerceOAuthCallback] Connection SUCCESS for tenant: ${tenantId}`);

    // Return HTTP 200 JSON back to WooCommerce immediately
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ success: true, message: 'OAuth credentials stored successfully' });

    // Auto-provision webhooks in background
    if (connection.storeUrl) {
      setTimeout(() => {
        autoProvisionWebhooks(tenantId, connection.storeUrl, consumer_key, consumer_secret)
          .then(() => console.log(`🎉 [WooCommerceOAuthCallback] Webhooks auto-provisioned for tenant: ${tenantId}`))
          .catch(err => console.error(`⚠️ [WooCommerceOAuthCallback] Webhook provisioning warning:`, err.message));
      }, 500);
    }

  } catch (error) {
    console.error('💥 [WooCommerceOAuthCallback] Error processing callback:', error);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
};