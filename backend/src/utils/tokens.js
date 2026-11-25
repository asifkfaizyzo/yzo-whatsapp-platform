// backend/src/utils/tokens.js (do not remove this comment)

import {
  generateAccessToken,
  generateRefreshToken,
} from "../modules/auth/jwt.service.js";

/**
 * Create an access + refresh token pair for any actor type.
 *
 * @param {Object} payload
 * @param {string} payload.id - Actor's database ID
 * @param {string} payload.email - Actor's email
 * @param {string} payload.type - "TENANT" | "USER" | "SUPERADMIN"
 * @returns {{ accessToken: string, refreshToken: string }}
 */
export const createTokenPair = ({ id, email, type }) => {
  if (!id || !type) {
    throw new Error("Token payload requires id and type");
  }

  const accessToken = generateAccessToken({ id, email, type });
  const refreshToken = generateRefreshToken({ id, type });

  return { accessToken, refreshToken };
};