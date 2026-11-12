// backend/src/modules/auth/auth.utils.js (do not remove this comment)

/**
 * Auth utility functions.
 *
 * Extracted from the old email.service.js monolith.
 * These are pure token helpers — no email sending, no DB calls.
 *
 * Usage:
 *   import { generateResetToken, getResetTokenExpiry } from "../auth/auth.utils.js";
 */

import crypto from "crypto";

/**
 * Generate a cryptographically secure password reset token.
 *
 * @returns {string} 64-character hex string
 */
export const generateResetToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

/**
 * Get the expiry timestamp for a password reset token (1 hour from now).
 *
 * @returns {Date}
 */
export const getResetTokenExpiry = () => {
  return new Date(Date.now() + 60 * 60 * 1000);
};