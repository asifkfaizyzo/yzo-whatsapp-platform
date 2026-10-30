import crypto from 'node:crypto';
import axios from 'axios';
import * as shopifyService from './shopifyService.js';
import { registerShopifyWebhooks } from './shopifyWebhookService.js';
import { syncAllProducts } from './shopifyProductSyncService.js';

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const SHOP_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

const getShopifyConfig = () => {
  const { SHOPIFY_API_KEY, SHOPIFY_API_SECRET } = process.env;
  if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET) {
    throw new Error('SHOPIFY_API_KEY and SHOPIFY_API_SECRET must be configured');
  }
  return { apiKey: SHOPIFY_API_KEY, apiSecret: SHOPIFY_API_SECRET };
};

const getCallbackUrl = (req) => {
  const backendUrl = (process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
  return `${backendUrl}${req.baseUrl}/oauth/callback`;
};

const getFrontendUrl = () => (process.env.FRONTEND_URL || 'http://localhost:5174').replace(/\/+$/, '');

const normalizeShopDomain = (shop) => {
  let domain = String(shop || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (!domain.includes('.')) domain = `${domain}.myshopify.com`;
  return domain;
};

const createState = (tenantId, shop, apiSecret) => {
  const payload = Buffer.from(JSON.stringify({
    tenantId,
    shop,
    issuedAt: Date.now(),
    nonce: crypto.randomBytes(16).toString('hex'),
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', apiSecret).update(payload).digest('hex');
  return `${payload}.${signature}`;
};

const verifyState = (state, apiSecret) => {
  const [payload, signature, ...extra] = String(state || '').split('.');
  if (!payload || !signature || extra.length) return null;

  const expected = crypto.createHmac('sha256', apiSecret).update(payload).digest();
  let supplied;
  try {
    supplied = Buffer.from(signature, 'hex');
  } catch {
    return null;
  }
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(expected, supplied)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const age = Date.now() - decoded.issuedAt;
    if (!decoded.tenantId || !decoded.shop || !decoded.nonce || age < 0 || age > OAUTH_STATE_TTL_MS) return null;
    return decoded;
  } catch {
    return null;
  }
};

const verifyCallbackHmac = (query, apiSecret) => {
  const { hmac, signature, ...params } = query;
  if (!hmac || signature) return false;

  const message = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  const expected = crypto.createHmac('sha256', apiSecret).update(message).digest();
  let supplied;
  try {
    supplied = Buffer.from(hmac, 'hex');
  } catch {
    return false;
  }
  return supplied.length === expected.length && crypto.timingSafeEqual(expected, supplied);
};

const redirectToIntegrations = (res, params) => {
  const destination = new URL('/dashboard/integrations', getFrontendUrl());
  destination.searchParams.set('app', 'shopify');
  for (const [key, value] of Object.entries(params)) {
    destination.searchParams.set(key, value);
  }
  return res.redirect(destination.toString());
};

export const getOAuthUrl = (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id || req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Tenant context missing' });
    }

    const shop = normalizeShopDomain(req.query.shop);
    if (!SHOP_DOMAIN_PATTERN.test(shop)) {
      return res.status(400).json({ success: false, message: 'Enter a valid Shopify myshopify.com domain' });
    }

    const { apiKey, apiSecret } = getShopifyConfig();
    const callbackUrl = getCallbackUrl(req);
    console.log('👉 EXACT CALLBACK URL BEING SENT TO SHOPIFY:', callbackUrl);
    const scopes = process.env.SHOPIFY_SCOPES || 'read_orders,read_products,read_customers,read_checkouts';
    const authorizationUrl = new URL(`https://${shop}/admin/oauth/authorize`);
    authorizationUrl.searchParams.set('client_id', apiKey);
    authorizationUrl.searchParams.set('scope', scopes);
    authorizationUrl.searchParams.set('redirect_uri', callbackUrl);
    authorizationUrl.searchParams.set('state', createState(tenantId, shop, apiSecret));

    return res.json({ success: true, authUrl: authorizationUrl.toString() });
  } catch (error) {
    console.error('Error generating Shopify OAuth URL:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to start Shopify authorization' });
  }
};

export const handleOAuthCallback = async (req, res) => {
  try {
    const { apiKey, apiSecret } = getShopifyConfig();
    const shop = normalizeShopDomain(req.query.shop);
    const state = verifyState(req.query.state, apiSecret);

    if (!verifyCallbackHmac(req.query, apiSecret)) {
      return redirectToIntegrations(res, { error: 'Shopify authorization could not be verified. Please try again.' });
    }
    if (!SHOP_DOMAIN_PATTERN.test(shop) || !state || state.shop !== shop) {
      return redirectToIntegrations(res, { error: 'Shopify authorization expired or did not match this store. Please try again.' });
    }
    if (req.query.error) {
      return redirectToIntegrations(res, { error: 'Shopify authorization was cancelled.' });
    }
    if (!req.query.code) {
      return redirectToIntegrations(res, { error: 'Shopify did not provide an authorization code.' });
    }

    const tokenResponse = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id: apiKey,
      client_secret: apiSecret,
      code: req.query.code,
    }, { timeout: 10000 });

    const accessToken = tokenResponse.data?.access_token;
    if (!accessToken) {
      throw new Error('Shopify did not return an access token');
    }

    await shopifyService.connect(state.tenantId, null, {
      shopName: shop,
      accessToken,
      webhookSecret: apiSecret,
    });

          // Automatically register webhooks for OAuth connection
    try {
      await registerShopifyWebhooks(shop, accessToken);
    } catch (err) {
      console.error('⚠️ OAuth Webhook Registration Error:', err.message);
    }

    // 🆕 Auto-trigger initial product catalog sync (non-blocking)
    syncAllProducts(state.tenantId)
      .then((result) => {
        console.log(`🚀 [OAuth] Initial product sync completed: ${result.totalSynced} products`);
      })
      .catch((err) => {
        console.error('⚠️ [OAuth] Initial product sync failed:', err.message);
      });

    return redirectToIntegrations(res, { connected: 'true' });
  } catch (error) {
    console.error('Error completing Shopify OAuth callback:', error);
    return redirectToIntegrations(res, { error: 'Could not connect your Shopify store. Please try again or use manual connection.' });
  }
};
