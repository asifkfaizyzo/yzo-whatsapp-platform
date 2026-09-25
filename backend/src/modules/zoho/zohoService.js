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
import { zohoRequest } from './zohoClient.js';

/**
 * Dynamic URL resolvers matching platform patterns
 */
export function getDynamicBackendUrl(req) {
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL.replace(/\/+$/, '');
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
 * Subscribe to Zoho CRM Contact change notifications.
 * Creates a webhook subscription in Zoho so that contact create/update/delete
 * events are pushed to Sudo Reply's webhook endpoint.
 */
export async function subscribeToZohoNotifications(tenantId) {
  const backendUrl = getDynamicBackendUrl({ headers: {} });
  const webhookUrl = `${process.env.BACKEND_URL || backendUrl}/api/zoho/webhook`;

  try {
    const response = await zohoRequest(tenantId, {
      method: 'POST',
      url: '/crm/v7/actions/watch',
      data: {
        watch: [
          {
            channel_id: `sudo_${tenantId}_contacts`,
            channel_expiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            events: [
              { module: 'Contacts', methods: ['POST', 'PUT', 'DELETE'] },
            ],
            channel_type: 'webhook',
            notify_url: webhookUrl,
            token: tenantId, // Used to identify tenant on inbound webhook
          },
        ],
      },
    });

    console.log(`✅ [ZohoService] Notification subscription created for tenant ${tenantId}`);
    return { success: true, data: response };
  } catch (error) {
    // Notifications scope may not be granted yet — non-fatal
    console.warn(`⚠️ [ZohoService] Could not create Zoho notification subscription for tenant ${tenantId}:`, error.response?.data || error.message);
    return { success: false, message: error.message };
  }
}

/**
 * Unsubscribe from Zoho CRM notifications on disconnect.
 */
export async function unsubscribeFromZohoNotifications(tenantId) {
  try {
    await zohoRequest(tenantId, {
      method: 'POST',
      url: '/crm/v7/actions/watch',
      data: {
        _method: 'DELETE',
        channel_id: `sudo_${tenantId}_contacts`,
      },
    });
    console.log(`🗑️ [ZohoService] Notification subscription removed for tenant ${tenantId}`);
  } catch (error) {
    console.warn(`⚠️ [ZohoService] Could not remove Zoho notification subscription:`, error.message);
  }
}