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
      update: {
        storeUrl: cleanUrl,
        status: 'PENDING',
      },
      create: {
        tenantId,
        storeUrl: cleanUrl,
        consumerKey: '',
        consumerSecret: '',
        status: 'PENDING',
      },
    });

    // Build exact backend host and route dynamically
    const backendHost = (process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
    const routePrefix = req.baseUrl || '/api/woocommerce';
    const callbackUrl = `${backendHost}${routePrefix}/oauth/callback`;

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5174').replace(/\/+$/, '');
    const returnUrl = `${frontendUrl}/dashboard/integrations?app=woocommerce&connected=true`;

    // Construct OAuth URL using URL object for RFC 3986 compliance
    const authObj = new URL(`${cleanUrl}/wc-auth/v1/authorize`);
    authObj.searchParams.set('app_name', 'Sudo Reply');
    authObj.searchParams.set('scope', 'read_write');
    authObj.searchParams.set('user_id', tenantId);
    authObj.searchParams.set('return_url', returnUrl);
    authObj.searchParams.set('callback_url', callbackUrl);

    const authUrl = authObj.toString();

    console.log('🔗 [WooCommerceOAuth] Generated auth URL:', authUrl);

    return res.json({ success: true, authUrl });
  } catch (error) {
    console.error('Error generating WooCommerce OAuth URL:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

/**
 * WooCommerce posts generated consumer key & secret back to this endpoint
 */
export const handleWooCommerceOAuthCallback = async (req, res) => {
  try {
    console.log('📥 [WooCommerceOAuthCallback] Received credentials callback from WooCommerce');

    let payload = req.body;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {}
    }
    if (!payload || Object.keys(payload).length === 0) {
      payload = req.query;
    }

    console.log('📥 [WooCommerceOAuthCallback] Payload received:', JSON.stringify(payload));

    const { user_id, consumer_key, consumer_secret } = payload || {};

    if (!user_id || !consumer_key || !consumer_secret) {
      console.error('❌ [WooCommerceOAuthCallback] Missing parameters in payload:', payload);
      return res.status(200).json({ success: false, message: 'Missing required OAuth parameters' });
    }

    const tenantId = user_id;

    const existing = await prisma.wooCommerceConnection.findUnique({
      where: { tenantId },
    });

    const storeUrl = existing?.storeUrl || '';

    await prisma.wooCommerceConnection.upsert({
      where: { tenantId },
      update: {
        consumerKey: consumer_key,
        consumerSecret: consumer_secret,
        status: 'active',
      },
      create: {
        tenantId,
        storeUrl,
        consumerKey: consumer_key,
        consumerSecret: consumer_secret,
        status: 'active',
      },
    });

    console.log(`✅ [WooCommerceOAuthCallback] Connection SUCCESS for tenant: ${tenantId}`);

    // Return HTTP 200 JSON back to WooCommerce
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ success: true, message: 'OAuth credentials stored successfully' });

    // Auto-provision webhooks in background
    if (storeUrl) {
      setTimeout(() => {
        autoProvisionWebhooks(tenantId, storeUrl, consumer_key, consumer_secret)
          .then(() => console.log(`🎉 [WooCommerceOAuthCallback] Webhooks auto-provisioned for tenant: ${tenantId}`))
          .catch((err) => console.error(`⚠️ [WooCommerceOAuthCallback] Webhook provisioning warning:`, err.message));
      }, 500);
    }
  } catch (error) {
    console.error('💥 [WooCommerceOAuthCallback] Error processing callback:', error);
    if (!res.headersSent) {
      res.status(200).json({ success: false, message: error.message });
    }
  }
};