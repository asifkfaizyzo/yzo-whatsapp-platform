// backend/src/lib/entitlements/access.js (do not remove this comment)
import {
  CHANNEL_CATALOG,
  INTEGRATION_CATALOG,
  getEntitlementMeta,
} from "./registry.js";
import {
  getTenantSubscriptionContext,
  resolveEntitlementFromContext,
} from "./entitlement.service.js";
import { consumeQuota, getUsage } from "./usage.service.js";
import { BYTES_PER_MB, getStorageUsedBytes } from "./storage.service.js";

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Every check accepts `{ ctx }` (from getTenantSubscriptionContext) so a request that performs
 * several checks fetches the subscription context once.
 */

export const checkFeatureAccess = async (tenantId, featureKey, { ctx } = {}) => {
  if (typeof featureKey !== "string" || !featureKey.trim()) {
    return { allowed: false, value: null, reason: "A feature key is required" };
  }
  const key = featureKey.trim();
  const context = ctx ?? (await getTenantSubscriptionContext(tenantId));

  const meta = getEntitlementMeta(key);
  if (meta) {
    const ent = resolveEntitlementFromContext(context, key);
    let allowed;
    if (meta.type === "BOOLEAN") allowed = ent.value === true;
    else if (meta.type === "STRING_ARRAY") allowed = Array.isArray(ent.value) && ent.value.length > 0;
    else allowed = ent.isUnlimited || Number(ent.value) > 0; // numeric: "has any"
    return {
      allowed,
      value: ent.value,
      reason: allowed ? null : `"${meta.label}" is not included in your current plan`,
    };
  }

  // By name: an integration or a channel
  const upper = key.toUpperCase();
  if (INTEGRATION_CATALOG.includes(upper)) {
    const list = resolveEntitlementFromContext(context, "allowedIntegrations").value ?? [];
    const allowed = list.includes(upper);
    return { allowed, value: allowed, reason: allowed ? null : `The ${upper} integration is not included in your plan` };
  }
  if (CHANNEL_CATALOG.includes(upper)) {
    const list = resolveEntitlementFromContext(context, "allowedChannels").value ?? [];
    const allowed = list.includes(upper);
    return { allowed, value: allowed, reason: allowed ? null : `The ${upper} channel is not included in your plan` };
  }
  return { allowed: false, value: null, reason: `Unknown feature "${featureKey}"` };
};

/** Read-only check for STATIC / METERED limits (never writes). `requiredCount` may be fractional (storage MB). */
export const checkLimitAccess = async (tenantId, limitKey, requiredCount = 1, { ctx } = {}) => {
  const meta = getEntitlementMeta(limitKey);
  if (!meta) return { allowed: false, reason: `Unknown entitlement "${limitKey}"` };
  if (!Number.isFinite(requiredCount) || requiredCount < 0) {
    return { allowed: false, reason: "requiredCount must be a non-negative number" };
  }
  if (meta.usage !== "STATIC" && meta.usage !== "METERED") {
    return { allowed: true, reason: null };
  }

  const u = await getUsage(tenantId, limitKey, { ctx });

  if (meta.usage === "STATIC") {
    if (u.isUnlimited) {
      return { allowed: true, current: u.used, limit: -1, remaining: -1, isUnlimited: true, reason: null };
    }
    const allowed = u.used + requiredCount <= u.limit;
    return {
      allowed,
      current: u.used,
      limit: u.limit,
      remaining: u.remaining,
      isUnlimited: false,
      reason: allowed
        ? null
        : `${meta.label} limit reached (${u.used} of ${u.limit}). Upgrade your plan or buy an add-on.`,
    };
  }

  if (u.isUnlimited) {
    return {
      allowed: true, used: u.used, baseLimit: -1, poolRemaining: u.poolRemaining,
      totalLimit: -1, remaining: -1, isUnlimited: true, reason: null,
    };
  }
  const allowed = u.remaining >= requiredCount;
  return {
    allowed,
    used: u.used,
    baseLimit: u.baseLimit,
    poolRemaining: u.poolRemaining,
    totalLimit: u.totalLimit,
    remaining: u.remaining,
    isUnlimited: false,
    reason: allowed
      ? null
      : `Monthly ${meta.label} quota exhausted (${u.remaining} remaining, ${requiredCount} needed). Buy a top-up or upgrade your plan.`,
  };
};

/** Pre-upload storage check, in exact bytes. Call after multer (size known); delete the file if denied. */
export const checkStorageAccess = async (tenantId, incomingBytes = 0, { ctx } = {}) => {
  const context = ctx ?? (await getTenantSubscriptionContext(tenantId));
  const ent = resolveEntitlementFromContext(context, "maxStorageMb");
  const usedBytes = await getStorageUsedBytes(tenantId);
  const usedMb = round2(usedBytes / BYTES_PER_MB);
  const incomingMb = round2(incomingBytes / BYTES_PER_MB);

  if (ent.isUnlimited) {
    return { allowed: true, usedMb, limitMb: -1, remainingMb: -1, incomingMb, isUnlimited: true, reason: null };
  }
  const limitBytes = ent.value * BYTES_PER_MB;
  const allowed = usedBytes + incomingBytes <= limitBytes;
  return {
    allowed,
    usedMb,
    limitMb: ent.value,
    remainingMb: Math.max(round2((limitBytes - usedBytes) / BYTES_PER_MB), 0),
    incomingMb,
    isUnlimited: false,
    reason: allowed
      ? null
      : `Storage limit reached (${usedMb} MB of ${ent.value} MB used, upload needs ${incomingMb} MB). Upgrade your plan or buy a storage add-on.`,
  };
};

/** Check + consume in ONE atomic step (no separate check). Use this for metered actions. */
export const enforceAndConsumeQuota = async (tenantId, limitKey, count = 1, { ctx } = {}) => {
  const meta = getEntitlementMeta(limitKey);
  if (!meta || meta.usage !== "METERED") {
    return { allowed: false, reason: `"${limitKey}" is not a metered entitlement` };
  }
  const result = await consumeQuota(tenantId, limitKey, count, { ctx });
  if (!result.success) {
    return {
      ...result,
      allowed: false,
      code: result.reason,
      reason: `Monthly ${meta.label} quota exhausted (${result.remaining} remaining, ${count} needed). Buy a top-up or upgrade your plan.`,
    };
  }
  return { ...result, allowed: true, reason: null };
};