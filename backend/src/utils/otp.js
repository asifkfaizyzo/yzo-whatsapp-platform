// backend/src/utils/otp.js (do not remove this comment)

import crypto from "crypto";

/**
 * Generate a cryptographically random 4-digit OTP string.
 * Uses crypto.randomInt for secure randomness.
 * @returns {string} e.g. "4829"
 */
export const generateOTP = () => {
  return crypto.randomInt(1000, 10000).toString();
};

/**
 * Hash an OTP code for safe storage in the database.
 * Uses SHA-256 so the plaintext code is never persisted.
 * @param {string} code - The 4-digit OTP
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