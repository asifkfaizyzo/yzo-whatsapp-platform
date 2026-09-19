import axios from 'axios';
import prisma from '../../config/prisma.js';
import { redisConnection } from '../../config/redis.js';
import { encrypt, decrypt } from '../../lib/crypto.js';
import { emitToTenant } from '../../lib/socket.js';

const LOCK_TTL_SECONDS = 30;
const WAIT_TIMEOUT_MS = 2000;

/**
 * Ensures a valid access token for the given tenant.
 * Uses a Redis distributed lock to prevent concurrent refresh races across cluster nodes.
 *
 * @param {string} tenantId
 * @returns {Promise<string|null>} Decrypted active access token
 */
export async function getValidAccessToken(tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      razorpayAuthType: true,
      razorpayAccountId: true,
      razorpayAccessToken: true,
      razorpayRefreshToken: true,
      razorpayTokenExpiresAt: true,
      razorpayAccountStatus: true,
    },
  });

  if (!tenant || tenant.razorpayAuthType !== 'OAUTH' || !tenant.razorpayAccessToken) {
    return null;
  }

  // If token is still valid for > 5 minutes, return it directly
  const now = new Date();
  const bufferMs = 5 * 60 * 1000;
  if (tenant.razorpayTokenExpiresAt && tenant.razorpayTokenExpiresAt.getTime() - now.getTime() > bufferMs) {
    return decrypt(tenant.razorpayAccessToken);
  }

  // Token needs refresh — acquire Redis distributed lock
  const lockKey = `rzp_refresh:${tenantId}`;
  const acquiredLock = await redisConnection.set(lockKey, '1', 'EX', LOCK_TTL_SECONDS, 'NX');

  if (!acquiredLock) {
    // Another worker is refreshing; wait and re-read
    await new Promise((resolve) => setTimeout(resolve, WAIT_TIMEOUT_MS));
    const freshTenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { razorpayAccessToken: true },
    });
    return freshTenant?.razorpayAccessToken ? decrypt(freshTenant.razorpayAccessToken) : null;
  }

  try {
    const clientId = process.env.RAZORPAY_CLIENT_ID;
    const clientSecret = process.env.RAZORPAY_CLIENT_SECRET;
    const refreshToken = decrypt(tenant.razorpayRefreshToken);

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Missing Razorpay OAuth credentials or refresh token');
    }

    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await axios.post(
      'https://auth.razorpay.com/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${authHeader}`,
        },
        timeout: 10000,
      }
    );

    const { access_token, refresh_token: newRefreshToken, expires_in } = response.data;
    const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000);

    const updateData = {
      razorpayAccessToken: encrypt(access_token),
      razorpayTokenExpiresAt: expiresAt,
    };

    if (newRefreshToken) {
      updateData.razorpayRefreshToken = encrypt(newRefreshToken);
    }

    await prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
    });

    return access_token;
  } catch (error) {
    console.error(`❌ [RazorpayTokenService] Token refresh failed for tenant ${tenantId}:`, error.response?.data || error.message);

    // If 400 or 401: Merchant might have revoked access on Razorpay
    if (error.response?.status === 400 || error.response?.status === 401) {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          razorpayAccountStatus: 'DISCONNECTED',
          enableOnlinePayment: false,
        },
      });
      emitToTenant(tenantId, 'payment_gateway_revoked', {
        reason: 'Razorpay authorization was revoked or expired. Switched to COD.',
      });
    }

    throw error;
  } finally {
    // Release the distributed lock
    await redisConnection.del(lockKey).catch(() => {});
  }
}
