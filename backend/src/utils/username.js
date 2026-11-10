// backend/src/utils/username.js (do not remove this comment)

import prisma from "../config/prisma.js";

/**
 * Username rules:
 * - 4 to 30 characters
 * - Lowercase letters, numbers, and underscores only
 * - Globally unique across Tenant, User, and SuperAdmin tables
 * - Case-insensitive (stored lowercase)
 */

export const USERNAME_REGEX = /^[a-z0-9_]{4,30}$/;
export const USERNAME_MIN_LENGTH = 4;
export const USERNAME_MAX_LENGTH = 30;

/**
 * Validate username format (no DB check).
 * @param {string} username
 * @returns {string|null} Error message if invalid, null if valid
 */
export const validateUsernameFormat = (username) => {
  if (!username || typeof username !== "string") {
    return "Username is required";
  }

  const lower = username.toLowerCase().trim();

  if (lower.length < USERNAME_MIN_LENGTH) {
    return `Username must be at least ${USERNAME_MIN_LENGTH} characters`;
  }

  if (lower.length > USERNAME_MAX_LENGTH) {
    return `Username must be at most ${USERNAME_MAX_LENGTH} characters`;
  }

  if (!USERNAME_REGEX.test(lower)) {
    return "Username can only contain lowercase letters, numbers, and underscores";
  }

  return null;
};

/**
 * Check if a username is available across all actor tables.
 * @param {string} username
 * @returns {Promise<boolean>}
 */
export const isUsernameAvailable = async (username, options = {}) => {
  const lower = username.toLowerCase().trim();

  const tenantWhere = { username: lower };
  if (options.excludeTenantId) {
    tenantWhere.id = { not: options.excludeTenantId };
  }

  const userWhere = { username: lower };
  if (options.excludeUserId) {
    userWhere.id = { not: options.excludeUserId };
  }

  const adminWhere = { username: lower };
  if (options.excludeAdminId) {
    adminWhere.id = { not: options.excludeAdminId };
  }

  const [tenant, user, admin] = await Promise.all([
    prisma.tenant.findFirst({ where: tenantWhere }),
    prisma.user.findFirst({ where: userWhere }),
    prisma.superAdmin.findFirst({ where: adminWhere }),
  ]);

  return !tenant && !user && !admin;
};

/**
 * Validate username format AND availability.
 * @param {string} username
 * @returns {Promise<{ valid: boolean, error?: string }>}
 */
export const validateUsername = async (username) => {
  const formatError = validateUsernameFormat(username);
  if (formatError) {
    return { valid: false, error: formatError };
  }

  const available = await isUsernameAvailable(username);
  if (!available) {
    return { valid: false, error: "This username is already taken" };
  }

  return { valid: true };
};

/**
 * Generate available username suggestions from a person's name.
 * Returns up to 4 available suggestions.
 *
 * @param {string} firstName
 * @param {string} lastName
 * @returns {Promise<string[]>}
 */
export const generateSuggestions = async (firstName = "", lastName = "") => {
  const first = firstName.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  const last = lastName.toLowerCase().trim().replace(/[^a-z0-9]/g, "");

  if (!first) return [];

  // Build candidate list in priority order
  const candidates = [];
  const seen = new Set();

  const addCandidate = (c) => {
    const clean = c.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (clean.length >= USERNAME_MIN_LENGTH && !seen.has(clean)) {
      seen.add(clean);
      candidates.push(clean);
    }
  };

  // Priority patterns
  if (last) {
    addCandidate(`${first}_${last}`);
    addCandidate(`${first}${last}`);
    addCandidate(`${first}_${last.charAt(0)}`);
    addCandidate(`${first.charAt(0)}_${last}`);
    addCandidate(`${first}${last.charAt(0)}`);
  }
  addCandidate(first);
  addCandidate(`${first}_${Math.floor(Math.random() * 90 + 10)}`);
  addCandidate(`${first}${Math.floor(Math.random() * 90 + 10)}`);
  addCandidate(`${first}_${Math.floor(Math.random() * 900 + 100)}`);

  // Check availability, return first 4
  const available = [];
  for (const candidate of candidates) {
    if (available.length >= 4) break;
    if (await isUsernameAvailable(candidate)) {
      available.push(candidate);
    }
  }

  return available;
};