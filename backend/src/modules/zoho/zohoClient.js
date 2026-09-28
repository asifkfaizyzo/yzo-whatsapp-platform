// src/modules/zoho/zohoClient.js

import axios from 'axios';
import prisma from '../../config/prisma.js';
import { redisConnection } from '../../config/redis.js';
import { encrypt, decrypt } from '../../lib/crypto.js';
import { emitToTenant } from '../../lib/socket.js';
import { createAuditLog } from '../audit/auditLogService.js';
import {
  ZOHO_DC_MAP,
  ZOHO_LOCK_TTL_SECONDS,
  ZOHO_REFRESH_BUFFER_MS,
} from './zohoConstants.js';

const WAIT_TIMEOUT_MS = 2000;

/**
 * Helper to extract and persist Zoho Rate-Limit headers to Redis
 */
export async function extractAndSaveRateLimits(tenantId, headers) {
  if (!headers || !tenantId) return;

  // Normalize all header keys to lowercase
  const normalized = {};
  Object.keys(headers).forEach((k) => {
    normalized[k.toLowerCase()] = headers[k];
  });

  const rawRemaining =
    normalized['x-ratelimit-remaining'] ??
    normalized['x-ratelimit-day-remaining'] ??
    normalized['x-rate-limit-remaining'];

  const rawLimit =
    normalized['x-ratelimit-limit'] ??
    normalized['x-ratelimit-day-limit'] ??
    normalized['x-rate-limit-limit'];

  const rawReset =
    normalized['x-ratelimit-reset'] ??
    normalized['x-ratelimit-day-reset'] ??
    normalized['x-rate-limit-reset'];

  if (rawRemaining !== undefined) {
    const remainingNum = parseInt(rawRemaining, 10);
    let limitNum = rawLimit !== undefined ? parseInt(rawLimit, 10) : null;

    // If Zoho sends remaining credits but omits total quota header, infer from remaining
    if (!limitNum || isNaN(limitNum)) {
      if (remainingNum > 10000) limitNum = 50000;
      else if (remainingNum > 5000) limitNum = 10000;
      else if (remainingNum > 1000) limitNum = 5000;
      else limitNum = Math.max(1000, remainingNum);
    }

    const rateLimitData = {
      limit: limitNum,
      remaining: remainingNum,
      reset: rawReset ? parseInt(rawReset, 10) : null,
      updatedAt: Date.now(),
      isEstimated: false,
    };

    try {
      await redisConnection.set(
        `zoho_rate_limit:${tenantId}`,
        JSON.stringify(rateLimitData),
        'EX',
        86400
      );
      emitToTenant(tenantId, 'zoho_rate_limits', rateLimitData);
      console.log(`📊 [ZohoRateLimit LIVE] ${rateLimitData.remaining} / ${rateLimitData.limit} credits remaining (Reset in: ${rateLimitData.reset || 0}s)`);
    } catch (err) {
      console.warn('⚠️ [ZohoRateLimit] Redis save error:', err.message);
    }
  }
}

/**
 * Ensures a valid access token for the given tenant.
 */
export async function getValidZohoAccessToken(tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      zohoAccessToken: true,
      zohoRefreshToken: true,
      zohoTokenExpiresAt: true,
      zohoDataCenter: true,
      zohoApiDomain: true,
      zohoConnectionStatus: true,
      tenantName: true,
      email: true,
    },
  });

  if (
    !tenant ||
    tenant.zohoConnectionStatus !== 'CONNECTED' ||
    !tenant.zohoAccessToken ||
    !tenant.zohoRefreshToken
  ) {
    throw new Error('Zoho CRM is not connected for this tenant');
  }

  const now = new Date();
  const expiresAt = tenant.zohoTokenExpiresAt ? new Date(tenant.zohoTokenExpiresAt) : new Date(0);

  if (expiresAt.getTime() - now.getTime() > ZOHO_REFRESH_BUFFER_MS) {
    return {
      accessToken: decrypt(tenant.zohoAccessToken),
      apiDomain: tenant.zohoApiDomain || ZOHO_DC_MAP[tenant.zohoDataCenter || 'us']?.apiDomain || 'https://www.zohoapis.com',
    };
  }

  const lockKey = `zoho_refresh:${tenantId}`;
  const acquiredLock = await redisConnection.set(lockKey, '1', 'EX', ZOHO_LOCK_TTL_SECONDS, 'NX');

  if (!acquiredLock) {
    await new Promise((resolve) => setTimeout(resolve, WAIT_TIMEOUT_MS));
    const freshTenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        zohoAccessToken: true,
        zohoApiDomain: true,
        zohoDataCenter: true,
        zohoConnectionStatus: true,
      },
    });

    if (!freshTenant || freshTenant.zohoConnectionStatus !== 'CONNECTED') {
      throw new Error('Zoho connection status invalid after token refresh wait');
    }

    return {
      accessToken: decrypt(freshTenant.zohoAccessToken),
      apiDomain: freshTenant.zohoApiDomain || ZOHO_DC_MAP[freshTenant.zohoDataCenter || 'us']?.apiDomain || 'https://www.zohoapis.com',
    };
  }

  try {
    const clientId = process.env.ZOHO_CLIENT_ID;
    const clientSecret = process.env.ZOHO_CLIENT_SECRET;
    const decryptedRefreshToken = decrypt(tenant.zohoRefreshToken);

    if (!clientId || !clientSecret || !decryptedRefreshToken) {
      throw new Error('Missing Zoho OAuth credentials or refresh token');
    }

    const dcKey = (tenant.zohoDataCenter || 'us').toLowerCase();
    const accountsDomain = ZOHO_DC_MAP[dcKey]?.accountsDomain || 'accounts.zoho.com';
    const refreshUrl = `https://${accountsDomain}/oauth/v2/token`;

    const response = await axios.post(
      refreshUrl,
      null,
      {
        params: {
          grant_type: 'refresh_token',
          refresh_token: decryptedRefreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 12000,
      }
    );

    const data = response.data;

    if (data.error) {
      throw new Error(`Zoho refresh error: ${data.error}`);
    }

    const { access_token, expires_in, api_domain } = data;

    if (!access_token) {
      throw new Error('Zoho token refresh response missing access_token');
    }

    const newExpiresAt = new Date(Date.now() + (expires_in || 3600) * 1000);
    const resolvedApiDomain = api_domain || tenant.zohoApiDomain || ZOHO_DC_MAP[dcKey]?.apiDomain || 'https://www.zohoapis.com';

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        zohoAccessToken: encrypt(access_token),
        zohoTokenExpiresAt: newExpiresAt,
        zohoApiDomain: resolvedApiDomain,
      },
    });

    console.log(`✅ [ZohoClient] Token refreshed successfully for tenant ${tenantId}`);

    return {
      accessToken: access_token,
      apiDomain: resolvedApiDomain,
    };
  } catch (error) {
    const errorData = error.response?.data;
    const status = error.response?.status;
    const isRevoked =
      status === 400 ||
      status === 401 ||
      (typeof errorData === 'object' && (errorData?.error === 'invalid_token' || errorData?.error === 'invalid_grant'));

    console.error(`❌ [ZohoClient] Token refresh failed for tenant ${tenantId}:`, errorData || error.message);

    if (isRevoked) {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          zohoConnectionStatus: 'REFRESH_FAILED',
        },
      });

      await createAuditLog({
        actorId: tenant.id,
        actorType: 'TENANT',
        actorName: tenant.tenantName || tenant.email || 'Tenant',
        actorEmail: tenant.email || '',
        action: 'ZOHO_TOKEN_REFRESH_FAILED',
        module: 'INTEGRATIONS',
        description: 'Zoho token refresh failed. Integration authorization was revoked or expired.',
        tenantId: tenant.id,
      });

      emitToTenant(tenantId, 'zoho_connection_revoked', {
        reason: 'Zoho CRM authorization was revoked or expired. Please reconnect your account in Settings.',
      });
    }

    throw error;
  } finally {
    await redisConnection.del(lockKey).catch(() => {});
  }
}

/**
 * Execute an authenticated request to the tenant's Zoho CRM API instance.
 */
export async function zohoRequest(tenantId, requestConfig) {
  const { accessToken, apiDomain } = await getValidZohoAccessToken(tenantId);

  const cleanBase = apiDomain.replace(/\/+$/, '');
  const cleanPath = (requestConfig.url || '').startsWith('/')
    ? requestConfig.url
    : `/${requestConfig.url || ''}`;

  const fullUrl = cleanPath.startsWith('http') ? cleanPath : `${cleanBase}${cleanPath}`;

  const config = {
    ...requestConfig,
    url: fullUrl,
    headers: {
      ...requestConfig.headers,
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
    },
    timeout: requestConfig.timeout || 15000,
  };

  try {
    const response = await axios(config);
    await extractAndSaveRateLimits(tenantId, response.headers);
    return response.data;
  } catch (error) {
    if (error.response?.headers) {
      await extractAndSaveRateLimits(tenantId, error.response.headers);
    }
    console.error(`❌ [ZohoClient] Request failed [${config.method || 'GET'} ${fullUrl}]:`, error.response?.data || error.message);
    throw error;
  }
}