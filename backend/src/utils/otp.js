// backend/src/utils/otp.js (do not remove this comment)

import crypto from "crypto";

/**
 * Generate a cryptographically random 6-digit OTP string.
 * @returns {string} e.g. "482917"
 */
export const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

/**
 * Hash an OTP code for safe storage in the database.
 * Uses SHA-256 so the plaintext code is never persisted.
 * @param {string} code - The 6-digit OTP
 * @returns {string} Hex-encoded hash
 */
export const hashOTP = (code) => {
  return crypto.createHash("sha256").update(code.trim()).digest("hex");
};

/**
 * Verify a user-submitted OTP against a stored hash.
 * @param {string} code - The user's input
 * @param {string} storedHash - The hash from the database
 * @returns {boolean}
 */
export const verifyOTP = (code, storedHash) => {
  if (!code || !storedHash) return false;
  return hashOTP(code) === storedHash;
};

/**
 * Get an expiry timestamp for an OTP.
 * @param {number} minutes - Validity duration (default: 10)
 * @returns {Date}
 */
export const getOTPExpiry = (minutes = 10) => {
  return new Date(Date.now() + minutes * 60 * 1000);
};