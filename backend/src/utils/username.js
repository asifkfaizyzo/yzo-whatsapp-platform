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
 * Parse an email address into firstName / lastName.
 *   "john.doe123@gmail.com"  → { firstName: "John", lastName: "Doe" }
 *   "munnasif11@gmail.com"   → { firstName: "Munnasif", lastName: "" }
 *   "j.doe@gmail.com"        → { firstName: "J", lastName: "Doe" }
 *
 * @param {string} email
 * @returns {{ firstName: string, lastName: string }}
 */
export const parseEmailForName = (email) => {
  if (!email || typeof email !== "string") {
    return { firstName: "", lastName: "" };
  }

  const local = email.split("@")[0].toLowerCase();
  if (!local) return { firstName: "", lastName: "" };

  // Strip trailing digits so "munnasif11" → "munnasif"
  const stripped = local.replace(/\d+$/, "");
  if (!stripped) return { firstName: "", lastName: "" };

  // Split on common separators: dot, underscore, hyphen
  const parts = stripped.split(/[._-]+/).filter(Boolean);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  if (parts.length >= 2) {
    return {
      firstName: cap(parts[0]),
      lastName: cap(parts.slice(1).join(" ")),
    };
  }

  return { firstName: cap(parts[0] || ""), lastName: "" };
};

/**
 * Generate exactly 3 available username suggestions.
 *
 * Priority order:
 *   1. Email prefix (most recognisable to the user)
 *   2. Name-based combos (first_last, firstlast, etc.)
 *   3. Numeric fallbacks (first_42, first789, etc.)
 *
 * @param {string} firstName
 * @param {string} lastName
 * @param {string} [email]
 * @returns {Promise<string[]>} Up to 3 available usernames
 */
export const generateSuggestions = async (
  firstName = "",
  lastName = "",
  email = "",
) => {
  const first = firstName.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  const last = lastName.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  const emailPrefix = email
    ? email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "")
    : "";

  const candidates = [];
  const seen = new Set();

  const add = (c) => {
    const clean = c.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (clean.length >= USERNAME_MIN_LENGTH && !seen.has(clean)) {
      seen.add(clean);
      candidates.push(clean);
    }
  };

  // ── Priority 1: email prefix ──
  if (emailPrefix) add(emailPrefix);

  // ── Priority 2: name combos ──
  if (first && last) {
    add(`${first}_${last}`);
    add(`${first}${last}`);
    add(`${first}_${last.charAt(0)}`);
    add(`${first.charAt(0)}_${last}`);
  }
  if (first) add(first);
  if (last && !first) add(last);

  // ── Priority 3: numeric fallbacks ──
  const base = first || emailPrefix || last || "user";
  for (let i = 0; i < 6; i++) {
    add(`${base}_${Math.floor(Math.random() * 90 + 10)}`);
    add(`${base}${Math.floor(Math.random() * 900 + 100)}`);
  }

  // ── Pick first 3 available ──
  const available = [];
  for (const candidate of candidates) {
    if (available.length >= 3) break;
    if (await isUsernameAvailable(candidate)) {
      available.push(candidate);
    }
  }

  // ── Safety net: if still < 3, brute-force random suffixes ──
  let attempts = 0;
  while (available.length < 3 && attempts < 30) {
    attempts++;
    const suffix = Math.floor(Math.random() * 9000 + 1000);
    const candidate = `${base}${suffix}`;
    if (!seen.has(candidate) && candidate.length >= USERNAME_MIN_LENGTH) {
      seen.add(candidate);
      if (await isUsernameAvailable(candidate)) {
        available.push(candidate);
      }
    }
  }

  return available.slice(0, 3);
};