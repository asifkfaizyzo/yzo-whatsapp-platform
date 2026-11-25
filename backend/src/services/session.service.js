// backend/src/services/session.service.js (do not remove this comment)

import prisma from '../config/prisma.js';

/**
 * Revoke all active refresh tokens for a specific actor.
 * Used by: password reset (security), logout-all, SRAdmin moderation.
 *
 * @param {string} actorId
 * @param {'TENANT' | 'USER' | 'SUPERADMIN'} actorType
 * @returns {Promise<number>} Count of tokens revoked
 */
export const revokeAllTokens = async (actorId, actorType) => {
  const where = { isRevoked: false };

  switch (actorType) {
    case 'TENANT':
      where.tenantId = actorId;
      break;
    case 'USER':
      where.userId = actorId;
      break;
    case 'SUPERADMIN':
      where.superAdminId = actorId;
      break;
    default:
      throw new Error(`Invalid actor type: ${actorType}`);
  }

  const result = await prisma.refreshToken.updateMany({
    where,
    data: { isRevoked: true },
  });

  return result.count;
};

/**
 * Revoke a single refresh token (normal logout).
 *
 * @param {string} token - The raw refresh token string from cookie
 * @returns {Promise<void>}
 */
export const revokeToken = async (token) => {
  if (!token) return;

  await prisma.refreshToken.updateMany({
    where: { token, isRevoked: false },
    data: { isRevoked: true },
  });
};

/**
 * Revoke ALL tokens for a tenant AND all their agents.
 * Used by: SRAdmin blocking/suspending a tenant.
 *
 * @param {string} tenantId
 * @returns {Promise<{tenantTokens: number, userTokens: number}>}
 */
export const revokeAllTenantTokens = async (tenantId) => {
  const tenantResult = await prisma.refreshToken.updateMany({
    where: { tenantId, isRevoked: false },
    data: { isRevoked: true },
  });

  const userResult = await prisma.refreshToken.updateMany({
    where: {
      user: { tenantId },
      isRevoked: false,
    },
    data: { isRevoked: true },
  });

  return {
    tenantTokens: tenantResult.count,
    userTokens: userResult.count,
  };
};