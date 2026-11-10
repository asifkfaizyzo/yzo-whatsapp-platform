// backend/src/utils/resetToken.js (do not remove this comment)

import crypto from "crypto";

/**
 * Generate a password reset token.
 * Returns the plaintext token (for the email link) and its hash (for DB storage).
 * This fixes the old bug where plaintext tokens were stored in the PasswordReset table.
 *
 * @param {number} expiryMinutes - Token validity (default: 60)
 * @returns {{ token: string, hash: string, expiresAt: Date }}
 */
export const generateResetToken = (expiryMinutes = 60) => {
  const token = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  return { token, hash, expiresAt };
};

/**
 * Hash a reset token from a URL for lookup in the database.
 * @param {string} token - The plaintext token from the reset URL
 * @returns {string} Hex-encoded SHA-256 hash
 */
export const hashResetToken = (token) => {
  if (!token) throw new Error("Reset token is required");
  return crypto.createHash("sha256").update(token).digest("hex");
};