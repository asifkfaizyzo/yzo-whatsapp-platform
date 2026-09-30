// src/modules/zoho/zohoService.js

import crypto from 'crypto';
import axios from 'axios';
import prisma from '../../config/prisma.js';
import { redisConnection } from '../../config/redis.js';
import { encrypt, decrypt } from '../../lib/crypto.js';
import { emitToTenant } from '../../lib/socket.js';
import { createAuditLog } from '../audit/auditLogService.js';
import {
  ZOHO_DC_MAP,
  ZOHO_PHASE_1_SCOPES,
  ZOHO_DEFAULT_AUTH_URL,
  ZOHO_STATE_REDIS_PREFIX,
  ZOHO_STATE_TTL_SECONDS,
} from './zohoConstants.js';
import { zohoRequest, extractAndSaveRateLimits } from './zohoClient.js';
import { detectZohoPlan } from './zohoPlanService.js';

/**
 * Dynamic URL resolvers matching platform patterns
 */
export function getDynamicBackendUrl(req) {
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL.replace(/\/+$/, '');
  if (process.env.BASE_URL && process.env.BASE_URL.startsWith('http')) return process.env.BASE_URL.replace(/\/+$/, '');
  
  // If running behind a reverse proxy in production
  if (process.env.NODE_ENV === 'production') {
    return 'https://sudoreply.com';
  }

  if (!req || !req.headers) return 'http://localhost:5000'; // Safe background fallback
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5000';
  return `${protocol}://${host}`;
}

export function getDynamicFrontendUrl(req) {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.replace(/\/+$/, '');

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
  return (tenantUrl || 'http://localhost:5174').replace(/\/+$/, '');
}

/**
 * Generate Zoho OAuth authorization URL for the authenticated tenant.
 */
export async function getOAuthAuthorizeUrl(tenantId, req) {
  const clientId = process.env.ZOHO_CLIENT_ID;
  if (!clientId) {
    throw new Error('ZOHO_CLIENT_ID is not configured in environment');
  }

  const backendUrl = getDynamicBackendUrl(req);
  const redirectUri = process.env.ZOHO_REDIRECT_URI || `${backendUrl}/api/zoho/callback`;

  // Generate 32-byte cryptographic random state
  const state = crypto.randomBytes(32).toString('hex');
  const redisKey = `${ZOHO_STATE_REDIS_PREFIX}${state}`;

  // Store in Redis with 10-minute TTL for one-time verification
  await redisConnection.set(
    redisKey,
    JSON.stringify({ tenantId, createdAt: Date.now() }),
    'EX',
    ZOHO_STATE_TTL_SECONDS
  );

  const scopeParam = encodeURIComponent(ZOHO_PHASE_1_SCOPES.join(','));
  const authUrl = `${ZOHO_DEFAULT_AUTH_URL}?response_type=code&client_id=${encodeURIComponent(
    clientId
  )}&scope=${scopeParam}&access_type=offline&prompt=consent&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&state=${encodeURIComponent(state)}`;

  return { url: authUrl };
}

/**
 * Handle incoming OAuth redirection callback from Zoho.
 */
export async function handleOAuthCallback(queryParams, req) {
  const { code, state, location, error: oauthError, error_description } = queryParams;
  const frontendUrl = getDynamicFrontendUrl(req);

  if (oauthError) {
    console.error('❌ [ZohoOAuth] Authorization denied or failed:', oauthError, error_description);
    return {
      redirectUrl: `${frontendUrl}/dashboard/integrations?app=zoho&error=${encodeURIComponent(
        error_description || oauthError
      )}`,
    };
  }

  if (!code || !state) {
    return {
      redirectUrl: `${frontendUrl}/dashboard/integrations?app=zoho&error=Missing+authorization+code+or+state`,
    };
  }

  // Verify and consume one-time OAuth state from Redis
  const redisKey = `${ZOHO_STATE_REDIS_PREFIX}${state}`;
  const rawStateData = await redisConnection.get(redisKey);

  if (!rawStateData) {
    console.error('❌ [ZohoOAuth] Invalid or expired OAuth state parameter');
    return {
      redirectUrl: `${frontendUrl}/dashboard/integrations?app=zoho&error=${encodeURIComponent(
        'OAuth session expired or invalid. Please try connecting again.'
      )}`,
    };
  }

  // Immediately delete state from Redis to guarantee single-use
  await redisConnection.del(redisKey).catch(() => {});

  let tenantId;
  try {
    const parsedState = JSON.parse(rawStateData);
    tenantId = parsedState.tenantId;
  } catch (err) {
    return {
      redirectUrl: `${frontendUrl}/dashboard/integrations?app=zoho&error=Corrupted+OAuth+session`,
    };
  }

  if (!tenantId) {
    return {
      redirectUrl: `${frontendUrl}/dashboard/integrations?app=zoho&error=Tenant+session+not+found`,
    };
  }

  try {
    const clientId = process.env.ZOHO_CLIENT_ID;
    const clientSecret = process.env.ZOHO_CLIENT_SECRET;
    const backendUrl = getDynamicBackendUrl(req);
    const primaryRedirectUri = process.env.ZOHO_REDIRECT_URI || `${backendUrl}/api/zoho/callback`;

    if (!clientId || !clientSecret) {
      throw new Error('Zoho application credentials missing on server');
    }

    // Determine token exchange endpoint from DC location parameter
    const dcKey = (location || 'us').toLowerCase();
    const accountsDomain = ZOHO_DC_MAP[dcKey]?.accountsDomain || 'accounts.zoho.com';
    const tokenUrl = `https://${accountsDomain}/oauth/v2/token`;

    console.log(`🔄 [ZohoOAuth] Exchanging code for tenant ${tenantId} via ${tokenUrl}`);

    const tokenResponse = await axios.post(
      tokenUrl,
      null,
      {
        params: {
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: primaryRedirectUri,
          code: code,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 15000,
      }
    );

    const tokenData = tokenResponse.data;

    if (tokenData.error) {
      throw new Error(`Zoho token exchange error: ${tokenData.error_description || tokenData.error}`);
    }

    const { access_token, refresh_token, expires_in, api_domain } = tokenData;

    if (!access_token) {
      throw new Error('Zoho token exchange response missing access_token');
    }

    const resolvedApiDomain = api_domain || ZOHO_DC_MAP[dcKey]?.apiDomain || 'https://www.zohoapis.com';

    // Fetch Current User Identity to obtain `zuid` and user email
    let connectedUserEmail = null;
    let connectedUserId = null;

    try {
      const userRes = await axios.get(`${resolvedApiDomain.replace(/\/+$/, '')}/crm/v7/users?type=CurrentUser`, {
        headers: {
          Authorization: `Zoho-oauthtoken ${access_token}`,
        },
        timeout: 10000,
      });

      // 🎯 CAPTURE LIVE RATE LIMIT HEADERS IMMEDIATELY ON CONNECTION
      if (userRes.headers) {
        await extractAndSaveRateLimits(tenantId, userRes.headers);
      }

      const currentUser = userRes.data?.users?.[0];
      if (currentUser) {
        connectedUserId = currentUser.id || currentUser.zuid || null;
        connectedUserEmail = currentUser.email || null;
      }
    } catch (userErr) {
      console.warn('⚠️ [ZohoOAuth] Could not fetch CurrentUser profile:', userErr.response?.data || userErr.message);
    }

    const existingTenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, zohoAccountId: true, tenantName: true, email: true },
    });

    if (!existingTenant) {
      throw new Error('Tenant workspace record not found');
    }

    // Account Switching Check: If connecting a DIFFERENT Zoho account, clear stale contact mappings
    if (
      existingTenant.zohoAccountId &&
      connectedUserId &&
      existingTenant.zohoAccountId !== connectedUserId
    ) {
      console.log(`⚠️ [ZohoOAuth] Tenant ${tenantId} switched Zoho accounts (${existingTenant.zohoAccountId} -> ${connectedUserId}). Clearing old ContactProviderMappings.`);
      await prisma.contactProviderMapping.deleteMany({
        where: { tenantId, provider: 'ZOHO' },
      });
    }

    const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000);

    const updateData = {
      zohoAccessToken: encrypt(access_token),
      zohoTokenExpiresAt: expiresAt,
      zohoDataCenter: dcKey,
      zohoApiDomain: resolvedApiDomain,
      zohoAccountEmail: connectedUserEmail,
      zohoAccountId: connectedUserId || existingTenant.zohoAccountId,
      zohoConnectionStatus: 'CONNECTED',
      zohoConnectedAt: new Date(),
      zohoScopes: ZOHO_PHASE_1_SCOPES.join(','),
    };

    if (refresh_token) {
      updateData.zohoRefreshToken = encrypt(refresh_token);
    }

    await prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
    });

    await createAuditLog({
      actorId: existingTenant.id,
      actorType: 'TENANT',
      actorName: existingTenant.tenantName || existingTenant.email || 'Tenant',
      actorEmail: existingTenant.email || '',
      action: 'ZOHO_CONNECTED',
      module: 'INTEGRATIONS',
      description: `Zoho CRM successfully connected for account ${connectedUserEmail || connectedUserId || 'user'}`,
      tenantId: existingTenant.id,
    });

    // Run plan detection + webhook subscriptions in background
    postConnectionSetup(tenantId).catch((err) => {
      console.warn('⚠️ [ZohoOAuth] Post-connection setup failed:', err.message);
    });

    emitToTenant(tenantId, 'zoho_connection_updated', {
      status: 'CONNECTED',
      accountEmail: connectedUserEmail,
      dataCenter: dcKey,
    });

    console.log(`✅ [ZohoOAuth] Zoho successfully connected for tenant ${tenantId}`);

    return {
      redirectUrl: `${frontendUrl}/dashboard/integrations?app=zoho&connected=true`,
    };
  } catch (error) {
    const errorMsg = error.response?.data?.error_description || error.response?.data?.error || error.message || 'OAuth token exchange failed';
    console.error('❌ [ZohoOAuth] Callback exchange error:', errorMsg);
    return {
      redirectUrl: `${frontendUrl}/dashboard/integrations?app=zoho&error=${encodeURIComponent(errorMsg)}`,
    };
  }
}

/**
 * Get safe connection status for the authenticated tenant.
 */
export async function getZohoConnectionStatus(tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      zohoConnectionStatus: true,
      zohoAccountEmail: true,
      zohoAccountId: true,
      zohoDataCenter: true,
      zohoApiDomain: true,
      zohoConnectedAt: true,
      zohoTokenExpiresAt: true,
      zohoScopes: true,
    },
  });

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  // Fetch cached rate limit details from Redis
  let rateLimit = null;
  try {
    const cachedLimit = await redisConnection.get(`zoho_rate_limit:${tenantId}`);
    if (cachedLimit) {
      rateLimit = JSON.parse(cachedLimit);
    }
  } catch (err) {
    console.warn('⚠️ [ZohoService] Failed to fetch rate limit from Redis:', err.message);
  }

  // 🚫 ZERO FAKE FALLBACKS — Only return real Zoho headers if they exist
  const dcInfo = ZOHO_DC_MAP[(tenant.zohoDataCenter || 'us').toLowerCase()];

  return {
    connected: tenant.zohoConnectionStatus === 'CONNECTED',
    status: tenant.zohoConnectionStatus || 'DISCONNECTED',
    accountEmail: tenant.zohoAccountEmail || null,
    accountId: tenant.zohoAccountId || null,
    dataCenter: tenant.zohoDataCenter || null,
    dataCenterLabel: dcInfo?.label || tenant.zohoDataCenter || null,
    apiDomain: tenant.zohoApiDomain || null,
    connectedAt: tenant.zohoConnectedAt || null,
    scopes: tenant.zohoScopes ? tenant.zohoScopes.split(',') : [],
    rateLimit, // Will be null until real headers arrive from Zoho!
  };
}

/**
 * Test live connection with Zoho CRM.
 */
export async function testZohoConnection(tenantId) {
  const result = await zohoRequest(tenantId, {
    method: 'GET',
    url: '/crm/v7/users?type=CurrentUser',
  });

  const currentUser = result?.users?.[0];

  // Retrieve the newly extracted rate limits directly
  let rateLimit = null;
  try {
    const cached = await redisConnection.get(`zoho_rate_limit:${tenantId}`);
    if (cached) {
      rateLimit = JSON.parse(cached);
    }
  } catch (_) {}

  return {
    success: true,
    message: 'Zoho CRM connection is active and valid',
    user: currentUser
      ? {
          name: currentUser.full_name || currentUser.first_name || 'Zoho User',
          email: currentUser.email,
          role: currentUser.role?.name || null,
          profile: currentUser.profile?.name || null,
        }
      : null,
    rateLimit, // <-- Pass rateLimit directly in the response
  };
}

/**
 * Disconnect Zoho CRM integration for the authenticated tenant.
 */
export async function disconnectZoho(tenantId, meta = {}) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      zohoRefreshToken: true,
      zohoDataCenter: true,
      zohoAccountEmail: true,
      tenantName: true,
      email: true,
    },
  });

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  // Best-effort notification unsubscription
  try {
    await unsubscribeFromZohoNotifications(tenantId);
  } catch (err) {
    console.warn('⚠️ [ZohoOAuth] Failed to unsubscribe from notifications:', err.message);
  }

  // Best-effort token revocation with Zoho
  if (tenant.zohoRefreshToken) {
    try {
      const decryptedToken = decrypt(tenant.zohoRefreshToken);
      const dcKey = (tenant.zohoDataCenter || 'us').toLowerCase();
      const accountsDomain = ZOHO_DC_MAP[dcKey]?.accountsDomain || 'accounts.zoho.com';
      await axios.post(
        `https://${accountsDomain}/oauth/v2/token/revoke`,
        null,
        {
          params: { token: decryptedToken },
          timeout: 8000,
        }
      );
      console.log(`🗑️ [ZohoOAuth] Revoked refresh token on Zoho for tenant ${tenantId}`);
    } catch (revokeErr) {
      console.warn('⚠️ [ZohoOAuth] Token revocation failed (ignoring):', revokeErr.message);
    }
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      zohoAccessToken: null,
      zohoRefreshToken: null,
      zohoTokenExpiresAt: null,
      zohoAccountId: null,
      zohoDataCenter: null,
      zohoApiDomain: null,
      zohoAccountEmail: null,
      zohoConnectionStatus: 'DISCONNECTED',
      zohoConnectedAt: null,
      zohoScopes: null,
    },
  });

  await createAuditLog({
    actorId: tenant.id,
    actorType: 'TENANT',
    actorName: tenant.tenantName || tenant.email || 'Tenant',
    actorEmail: tenant.email || '',
    action: 'ZOHO_DISCONNECTED',
    module: 'INTEGRATIONS',
    description: `Zoho CRM disconnected (was connected to ${tenant.zohoAccountEmail || 'account'})`,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    tenantId: tenant.id,
  });

  emitToTenant(tenantId, 'zoho_connection_updated', {
    status: 'DISCONNECTED',
  });

  return { message: 'Zoho CRM integration disconnected successfully' };
}

/**
 * Subscribe to Zoho CRM Contact change notifications (Contact edits flow back to Sudo).
 */
export async function subscribeToZohoNotifications(tenantId) {
  const backendUrl = getDynamicBackendUrl();
  const webhookUrl = `${backendUrl.replace(/\/+$/, '')}/api/zoho/webhook`;

  // Zoho Security Enforcement: Webhook URL MUST use HTTPS protocol
  if (webhookUrl.startsWith('http://localhost') || !webhookUrl.startsWith('https://')) {
    console.warn(
      `⚠️ [ZohoSetup] Zoho CRM Webhooks require a secure HTTPS endpoint. ` +
      `Skipping subscription on HTTP: ${webhookUrl}\n` +
      `💡 Ensure BACKEND_URL="https://sudoreply.com" is set in your .env`
    );
    return { success: false, message: 'HTTPS required for Zoho webhook' };
  }

  // Generate clean 32-character alphanumeric channel IDs (no underscores or special characters)
  const cleanTenantHash = tenantId.replace(/[^a-zA-Z0-9]/g, '');
  const contactsChannelId = `sudo${cleanTenantHash}c`.substring(0, 32);
  const leadsChannelId = `sudo${cleanTenantHash}l`.substring(0, 32);

  // 23-hour safety expiry window (Zoho max expiry is 24h)
  const channelExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();

  try {
    const response = await zohoRequest(tenantId, {
      method: 'POST',
      url: '/crm/v7/actions/watch',
      data: {
        watch: [
          {
            channel_id: contactsChannelId,
            channel_expiry: channelExpiry,
            events: [
              'Contacts.create',
              'Contacts.edit',
              'Contacts.delete'
            ],
            channel_type: 'webhook',
            notify_url: webhookUrl,
            token: tenantId,
          },
          {
            channel_id: leadsChannelId,
            channel_expiry: channelExpiry,
            events: [
              'Leads.create',
              'Leads.edit',
              'Leads.delete'
            ],
            channel_type: 'webhook',
            notify_url: webhookUrl,
            token: tenantId,
          }
        ],
      },
    });

    console.log(`✅ [ZohoService] Notification subscription created on Zoho CRM for tenant ${tenantId} -> ${webhookUrl}`);
    return { success: true, data: response };
  } catch (error) {
    const errorData = error.response?.data;
    console.error(
      `⚠️ [ZohoService] Notification subscription rejected by Zoho:\n`,
      JSON.stringify(errorData || error.message, null, 2)
    );
    return { success: false, message: error.message };
  }
}

/**
 * Unsubscribe from Zoho CRM notifications on disconnect.
 */
export async function unsubscribeFromZohoNotifications(tenantId) {
  const cleanTenantHash = tenantId.replace(/[^a-zA-Z0-9]/g, '');
  const contactsChannelId = `sudo${cleanTenantHash}c`.substring(0, 32);
  const leadsChannelId = `sudo${cleanTenantHash}l`.substring(0, 32);

  try {
    await zohoRequest(tenantId, {
      method: 'POST',
      url: '/crm/v7/actions/watch',
      data: {
        watch: [
          {
            channel_id: contactsChannelId,
            _method: 'DELETE',
          },
          {
            channel_id: leadsChannelId,
            _method: 'DELETE',
          }
        ],
      },
    });
    console.log(`🗑️ [ZohoService] Notification subscriptions removed for tenant ${tenantId}`);
  } catch (error) {
    console.warn(`⚠️ [ZohoService] Could not remove Zoho notification subscription:`, error.response?.data || error.message);
  }
}

/**
 * Post-connection setup: Detect plan + subscribe to notifications
 */
export async function postConnectionSetup(tenantId) {
  // 1. Detect Zoho plan
  try {
    const plan = await detectZohoPlan(tenantId, true);
    console.log(`📊 [ZohoSetup] Plan detected: ${plan.edition} for tenant ${tenantId}`);

    // Emit live update to frontend so UI updates instantly without refresh!
    emitToTenant(tenantId, 'zoho_plan_updated', plan);
  } catch (err) {
    console.warn(`⚠️ [ZohoSetup] Plan detection failed:`, err.message);
  }

  // 2. Subscribe to Zoho notifications (for bidirectional sync)
  try {
    await subscribeToZohoNotifications(tenantId);
  } catch (err) {
    console.warn(`⚠️ [ZohoSetup] Notification subscription failed:`, err.message);
  }
}