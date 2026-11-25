// backend/src/modules/tenant/auth/tenant.setup.service.js (do not remove this comment)

/**
 * Setup gate — determines which fields a tenant is missing.
 *
 * "Complete" means the tenant has all the fields that the current
 * onboarding flow collects. The gate only applies to tenants who
 * have already finished onboarding (onboardingCompleted = true)
 * but are missing fields that were added later.
 *
 * Controlled by SETUP_GATE_ENABLED env var. When off (default),
 * required is always false.
 */

const GATE_ENABLED = ["true", "1", "yes"].includes(
  (process.env.SETUP_GATE_ENABLED || "").toLowerCase(),
);

/**
 * Compute which required fields are missing from a tenant row.
 *
 * @param {object} tenant - Tenant row (must include password, firstName, etc.)
 * @returns {{ required: boolean, missing: string[] }}
 */
export const getSetupStatus = (tenant) => {
  if (!tenant) return { required: false, missing: [] };

  const missing = [];

  if (!tenant.firstName) missing.push("firstName");
  if (!tenant.lastName) missing.push("lastName");
  if (!tenant.username) missing.push("username");
  if (!tenant.password) missing.push("password");
  if (!tenant.tenantName) missing.push("tenantName");
  if (!tenant.phone) missing.push("phone");
  if (!tenant.companySize) missing.push("companySize");

  const required =
    GATE_ENABLED &&
    tenant.onboardingCompleted === true &&
    missing.length > 0;

  return { required, missing };
};