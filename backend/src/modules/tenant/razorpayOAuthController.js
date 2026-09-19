import crypto from 'crypto';
import axios from 'axios';
import prisma from '../../config/prisma.js';
import { encrypt, decrypt } from '../../lib/crypto.js';
import { emitToTenant } from '../../lib/socket.js';

const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Sign state payload: tenantId:timestamp:nonce
 */
function createSignedState(tenantId) {
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(8).toString('hex');
  const payload = `${tenantId}:${timestamp}:${nonce}`;
  const secret = process.env.ACCESS_SECRET || 'yzo_razorpay_oauth_state_secret_32b';
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

/**
 * Verify and parse signed state: tenantId:timestamp:nonce.signature
 */
function verifyAndExtractState(signedState) {
  if (!signedState || !signedState.includes('.')) {
    throw new Error('Malformed state parameter');
  }

  const [payload, signature] = signedState.split('.');
  const secret = process.env.ACCESS_SECRET || 'yzo_razorpay_oauth_state_secret_32b';
  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  const sigBuffer = Buffer.from(signature, 'utf8');
  const expBuffer = Buffer.from(expectedSig, 'utf8');

  if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
    throw new Error('Invalid state signature (tampering detected)');
  }

  const [tenantId, timestampStr] = payload.split(':');
  const timestamp = parseInt(timestampStr, 10);

  if (Date.now() - timestamp > STATE_MAX_AGE_MS) {
    throw new Error('OAuth authorization session expired. Please try again.');
  }

  return tenantId;
}

/**
 * Helper to provision programmatic webhook for sub-merchant account with 3x retry
 */
async function provisionSubMerchantWebhook(accountId, alertEmail, webhookSecret, req) {
  const partnerKey = process.env.RAZORPAY_KEY_ID;
  const partnerSecret = process.env.RAZORPAY_KEY_SECRET;
  const backendUrl = req ? getDynamicBackendUrl(req) : (process.env.BACKEND_URL || 'http://localhost:5000');
  const webhookUrl = `${backendUrl}/api/webhook/razorpay/partner`;

  if (!partnerKey || !partnerSecret) {
    console.warn('⚠️ [RazorpayOAuth] RAZORPAY_KEY_ID / SECRET not configured. Skipping programmatic webhook creation.');
    return null;
  }

  const basicAuth = Buffer.from(`${partnerKey}:${partnerSecret}`).toString('base64');
  const payload = {
    url: webhookUrl,
    alert_email: alertEmail || process.env.EMAIL_USER || 'info@sudoreply.com',
    secret: webhookSecret,
    events: [
      'payment_link.paid',
      'payment_link.cancelled',
      'payment_link.expired',
      'payment.captured',
      'payment.failed',
      'refund.processed',
    ],
  };

  let webhookId = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await axios.post(
        `https://api.razorpay.com/v1/accounts/${accountId}/webhooks`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${basicAuth}`,
            'X-Razorpay-Account': accountId,
          },
          timeout: 10000,
        }
      );
      webhookId = response.data?.id;
      console.log(`✅ [RazorpayOAuth] Successfully created programmatic webhook ${webhookId} for ${accountId}`);
      break;
    } catch (err) {
      console.error(`⚠️ [RazorpayOAuth] Attempt ${attempt} failed to create webhook for ${accountId}:`, err.response?.data || err.message);
      if (attempt === 3) {
        console.error(`❌ [RazorpayOAuth] Programmatic webhook creation aborted after 3 attempts for ${accountId}`);
      } else {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }

  return webhookId;
}

/**
 * Helper to delete sub-merchant webhook on disconnect
 */
async function deleteSubMerchantWebhook(accountId, webhookId) {
  if (!accountId || !webhookId) return;

  const partnerKey = process.env.RAZORPAY_KEY_ID;
  const partnerSecret = process.env.RAZORPAY_KEY_SECRET;
  if (!partnerKey || !partnerSecret) return;

  const basicAuth = Buffer.from(`${partnerKey}:${partnerSecret}`).toString('base64');
  try {
    await axios.delete(`https://api.razorpay.com/v1/accounts/${accountId}/webhooks/${webhookId}`, {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'X-Razorpay-Account': accountId,
      },
      timeout: 8000,
    });
    console.log(`🗑️ [RazorpayOAuth] Deleted webhook ${webhookId} for ${accountId}`);
  } catch (err) {
    console.warn(`⚠️ [RazorpayOAuth] Failed to delete webhook ${webhookId}:`, err.response?.data || err.message);
  }
}

/**
 * Helper to revoke OAuth tokens with Razorpay
 */
async function revokeOAuthToken(token) {
  if (!token) return;
  const clientId = process.env.RAZORPAY_CLIENT_ID;
  const clientSecret = process.env.RAZORPAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return;

  try {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    await axios.post(
      'https://auth.razorpay.com/token/revoke',
      new URLSearchParams({
        token: token,
        token_type_hint: 'access_token',
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
        },
        timeout: 8000,
      }
    );
    console.log('🗑️ [RazorpayOAuth] Revoked OAuth access token with Razorpay');
  } catch (err) {
    console.warn('⚠️ [RazorpayOAuth] Token revoke error:', err.response?.data || err.message);
  }
}

/**
 * Helper to dynamically deduce backend base URL from request headers/env
 */
function getDynamicBackendUrl(req) {
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5000';
  return `${protocol}://${host}`;
}

/**
 * Helper to dynamically deduce tenant frontend base URL from request/env
 */
function getDynamicFrontendUrl(req) {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;

  const allowedUrls = process.env.FRONTEND_URLS
    ? process.env.FRONTEND_URLS.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const origin = req.headers.origin || req.headers.referer;
  if (origin) {
    try {
      const parsedOrigin = new URL(origin).origin;
      if (allowedUrls.length === 0 || allowedUrls.includes(parsedOrigin)) {
        return parsedOrigin;
      }
    } catch (_) {}
  }

  const tenantUrl = allowedUrls.find((u) => u.includes('5174') || !u.includes('5173')) || allowedUrls[0];
  return tenantUrl || 'http://localhost:5174';
}

// ──────────────────────────────────────────────
// CONTROLLERS
// ──────────────────────────────────────────────

/**
 * GET /api/tenant/payment-gateway/oauth/url
 * Returns authorization URL for 1-Click Connect
 */
export async function getOAuthAuthorizeUrl(req, res) {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const clientId = process.env.RAZORPAY_CLIENT_ID;
    const backendUrl = getDynamicBackendUrl(req);
    const redirectUri = process.env.RAZORPAY_REDIRECT_URI || `${backendUrl}/api/auth/razorpay/callback`;

    if (!clientId) {
      console.error('❌ [RazorpayOAuth] RAZORPAY_CLIENT_ID missing in process.env');
      return res.status(400).json({
        success: false,
        error: 'Razorpay Partner OAuth is not yet configured. Please verify RAZORPAY_CLIENT_ID in server environment.',
      });
    }

    console.log('🔗 [RazorpayOAuth] Generated authorization URL with redirect_uri:', redirectUri);

    const signedState = createSignedState(tenantId);
    const scope = 'read_write';
    const authUrl = `https://auth.razorpay.com/authorize?client_id=${encodeURIComponent(
      clientId
    )}&response_type=code&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(
      signedState
    )}&redirect_uri=${encodeURIComponent(redirectUri)}`;

    return res.status(200).json({
      success: true,
      url: authUrl,
    });
  } catch (error) {
    console.error('❌ [RazorpayOAuth] getOAuthAuthorizeUrl error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

function extractErrorMessage(error) {
  const data = error.response?.data;
  if (!data) return error.message || 'OAuth onboarding failed';
  if (typeof data === 'string') return data;
  if (typeof data.error_description === 'string') return data.error_description;
  if (typeof data.error === 'string') return data.error;
  if (data.error && typeof data.error.description === 'string') return data.error.description;
  if (typeof data.message === 'string') return data.message;
  return error.message || 'OAuth onboarding failed';
}

/**
 * GET /api/auth/razorpay/callback
 * Handles OAuth redirection callback from auth.razorpay.com
 */
export async function handleOAuthCallback(req, res) {
  console.log('📥 [RazorpayOAuth] Incoming callback received:', {
    query: req.query,
    originalUrl: req.originalUrl,
    host: req.headers.host,
  });

  const { code, state, error: oauthError, error_description } = req.query;
  const frontendUrl = getDynamicFrontendUrl(req);
  const backendUrl = getDynamicBackendUrl(req);
  const primaryRedirectUri = process.env.RAZORPAY_REDIRECT_URI || `${backendUrl}/api/auth/razorpay/callback`;

  if (oauthError) {
    console.error('❌ [RazorpayOAuth] Authorization denied or failed:', oauthError, error_description);
    return res.redirect(
      `${frontendUrl}/dashboard/integrations?app=razorpay&error=${encodeURIComponent(
        error_description || oauthError
      )}`
    );
  }

  if (!code || !state) {
    console.warn('⚠️ [RazorpayOAuth] Missing code or state in callback query params');
    return res.redirect(
      `${frontendUrl}/dashboard/integrations?app=razorpay&error=Missing+authorization+code+or+state`
    );
  }

  let tenantId;
  try {
    tenantId = verifyAndExtractState(state);
    console.log(`🔑 [RazorpayOAuth] State verified for tenantId: ${tenantId}`);
  } catch (err) {
    console.error('❌ [RazorpayOAuth] State verification failed:', err.message);
    return res.redirect(
      `${frontendUrl}/dashboard/integrations?app=razorpay&error=${encodeURIComponent(err.message)}`
    );
  }

  try {
    const clientId = process.env.RAZORPAY_CLIENT_ID;
    const clientSecret = process.env.RAZORPAY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Razorpay Partner credentials missing on server');
    }

    // 1. Exchange authorization code for access & refresh tokens
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const redirectCandidates = [
      primaryRedirectUri,
      'http://localhost:5000/api/auth/razorpay/callback',
      'http://localhost:5174/api/auth/razorpay/callback',
      'http://localhost:5000/api2/auth/razorpay/callback',
      'http://localhost:5174/api2/auth/razorpay/callback',
      'http://localhost:5000/auth/razorpay/callback',
      'http://localhost:5174/auth/razorpay/callback',
    ];
    const uniqueCandidates = [...new Set(redirectCandidates)];

    let tokenResponse = null;
    let lastExchangeError = null;

    for (const testUri of uniqueCandidates) {
      try {
        console.log(`🔄 [RazorpayOAuth] Attempting token exchange with redirect_uri: ${testUri}`);
        tokenResponse = await axios.post(
          'https://auth.razorpay.com/token',
          new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: testUri,
          }).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: `Basic ${basicAuth}`,
            },
            timeout: 12000,
          }
        );
        console.log(`✅ [RazorpayOAuth] Token exchange succeeded with redirect_uri: ${testUri}`);
        break;
      } catch (err) {
        lastExchangeError = err;
        const errDetail = extractErrorMessage(err);
        console.error(`⚠️ [RazorpayOAuth] Token exchange failed with ${testUri}:`, {
          status: err.response?.status,
          responseData: err.response?.data,
          errorDetail: errDetail,
        });
      }
    }

    if (!tokenResponse) {
      throw lastExchangeError || new Error('Token exchange failed with all candidate redirect URIs');
    }

    const {
      access_token,
      refresh_token,
      expires_in,
      razorpay_account_id,
    } = tokenResponse.data;

    if (!razorpay_account_id || !access_token) {
      throw new Error('Razorpay response did not include account ID or access token');
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, email: true, razorpayWebhookId: true, razorpayAccountId: true },
    });

    if (!tenant) {
      throw new Error('Tenant record not found');
    }

    // 2. Generate per-tenant random 32-byte secret for webhook HMAC verification
    const webhookSecret = crypto.randomBytes(32).toString('hex');

    // 3. Programmatically provision webhook for sub-merchant account (with 3x retry)
    const webhookId = await provisionSubMerchantWebhook(
      razorpay_account_id,
      tenant.email,
      webhookSecret,
      req
    );

    // 4. Save credentials to Database (Option A: KYC-Gated Online Payment Activation)
    const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000);
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        razorpayAuthType: 'OAUTH',
        razorpayAccountId: razorpay_account_id,
        razorpayAccessToken: encrypt(access_token),
        razorpayRefreshToken: refresh_token ? encrypt(refresh_token) : undefined,
        razorpayTokenExpiresAt: expiresAt,
        razorpayWebhookSecret: encrypt(webhookSecret),
        razorpayWebhookId: webhookId,
        razorpayAccountStatus: 'CONNECTED',
        razorpayKycStatus: 'VERIFIED',
        enableOnlinePayment: true,
      },
    });

    emitToTenant(tenantId, 'payment_gateway_updated', {
      authType: 'OAUTH',
      accountId: razorpay_account_id,
      status: 'CONNECTED',
      kycStatus: 'VERIFIED',
    });

    return res.redirect(`${frontendUrl}/dashboard/integrations?app=razorpay&connected=true`);
  } catch (error) {
    const msg = extractErrorMessage(error);
    console.error('❌ [RazorpayOAuth] handleOAuthCallback final failure:', msg, error.response?.data || error);
    return res.redirect(
      `${frontendUrl}/dashboard/integrations?app=razorpay&error=${encodeURIComponent(msg)}`
    );
  }
}

/**
 * POST /api/tenant/payment-gateway/oauth/disconnect
 * Disconnects OAuth integration, cleans up webhook and revokes tokens
 */
export async function disconnectRazorpayOAuth(req, res) {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        razorpayAccountId: true,
        razorpayWebhookId: true,
        razorpayAccessToken: true,
        razorpayKeyId: true,
      },
    });

    const hasConnection = tenant && (Boolean(tenant.razorpayAccountId) || Boolean(tenant.razorpayKeyId));
    if (!hasConnection) {
      return res.status(400).json({ success: false, error: 'No connected Razorpay account found' });
    }

    // 1. If OAuth was connected, delete programmatic webhook from Razorpay
    if (tenant.razorpayAccountId && tenant.razorpayWebhookId) {
      await deleteSubMerchantWebhook(tenant.razorpayAccountId, tenant.razorpayWebhookId);
    }

    // 2. Revoke OAuth token if present
    if (tenant.razorpayAccessToken) {
      await revokeOAuthToken(decrypt(tenant.razorpayAccessToken));
    }

    // 3. Clear all Razorpay credentials (both OAuth and manual keys) in DB
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        razorpayAuthType: 'OAUTH',
        razorpayAccountId: null,
        razorpayAccessToken: null,
        razorpayRefreshToken: null,
        razorpayTokenExpiresAt: null,
        razorpayWebhookId: null,
        razorpayKeyId: null,
        razorpayKeySecret: null,
        razorpayWebhookSecret: null,
        razorpayAccountStatus: 'DISCONNECTED',
        razorpayKycStatus: 'NOT_APPLICABLE',
        enableOnlinePayment: false,
      },
    });

    // Invalidate cached Razorpay client instance across workers
    try {
      const { invalidateTenantRazorpayCache } = await import('../orders/orderPaymentService.js');
      await invalidateTenantRazorpayCache(tenantId);
    } catch (cacheErr) {
      console.warn('⚠️ [RazorpayOAuth] Cache invalidation notice:', cacheErr.message);
    }

    emitToTenant(tenantId, 'payment_gateway_updated', {
      authType: 'OAUTH',
      status: 'DISCONNECTED',
    });

    return res.status(200).json({
      success: true,
      message: 'Razorpay account successfully disconnected.',
    });
  } catch (error) {
    console.error('❌ [RazorpayOAuth] disconnectRazorpayOAuth error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/tenant/payment-gateway/oauth/status
 * Returns current OAuth connection and KYC verification status
 */
export async function getOAuthStatus(req, res) {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        razorpayAuthType: true,
        razorpayAccountId: true,
        razorpayAccountStatus: true,
        razorpayKycStatus: true,
        enableOnlinePayment: true,
        enableCod: true,
        razorpayKeyId: true,
        razorpayWebhookSecret: true,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        authType: tenant?.razorpayAuthType || 'DIRECT_KEYS',
        accountId: tenant?.razorpayAccountId || null,
        accountStatus: tenant?.razorpayAccountStatus || 'DISCONNECTED',
        kycStatus: tenant?.razorpayKycStatus || 'PENDING',
        enableOnlinePayment: tenant?.enableOnlinePayment || false,
        enableCod: tenant?.enableCod ?? true,
        hasDirectKeys: Boolean(tenant?.razorpayKeyId),
        hasWebhookSecret: Boolean(tenant?.razorpayWebhookSecret),
      },
    });
  } catch (error) {
    console.error('❌ [RazorpayOAuth] getOAuthStatus error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
