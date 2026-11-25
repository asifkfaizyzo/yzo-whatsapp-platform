// backend/src/utils/hash.js (do not remove this comment)

import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

/**
 * Hash a plaintext password.
 * @param {string} plain - The plaintext password
 * @returns {Promise<string>} The bcrypt hash
 */
export const hashPassword = async (plain) => {
  if (!plain || typeof plain !== "string") {
    throw new Error("Password must be a non-empty string");
  }
  return bcrypt.hash(plain, SALT_ROUNDS);
};

/**
 * Compare a plaintext password against a bcrypt hash.
 * @param {string} plain - The plaintext password
 * @param {string} hash - The stored bcrypt hash
 * @returns {Promise<boolean>}
 */
export const comparePassword = async (plain, hash) => {
  if (!plain || !hash) return false;
  return bcrypt.compare(plain, hash);
};