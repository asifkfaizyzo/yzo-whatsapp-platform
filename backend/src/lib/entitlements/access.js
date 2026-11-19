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
import {
  BYTES_PER_MB,
  getStorageUsedBytes,
  registerMediaAsset,
  markMediaAssetDeleted,
  removeMediaAssetRow,
} from "./storage.service.js";

export {
  BYTES_PER_MB,
  getStorageUsedBytes,
  getStorageUsedBytes as getStorageUsageBytes,
  registerMediaAsset,
  markMediaAssetDeleted,
  removeMediaAssetRow,
};

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Normalizes optional context argument so callers can pass either `{ ctx }` or `ctx` directly.
 */
const resolveContextArg = async (tenantId, ctxOrOpts) => {
  if (!ctxOrOpts) return getTenantSubscriptionContext(tenantId);
  if (ctxOrOpts.ctx) return ctxOrOpts.ctx;
  if (
    typeof ctxOrOpts === "object" &&
    ("subscription" in ctxOrOpts || "tenantId" in ctxOrOpts || "addOns" in ctxOrOpts)
  ) {
    return ctxOrOpts;
  }
  return getTenantSubscriptionContext(tenantId);
};

export const checkFeatureAccess = async (tenantId, featureKey, ctxOrOpts) => {
  if (typeof featureKey !== "string" || !featureKey.trim()) {
    const reason = "A feature key is required";
    return {
      allowed: false,
      status: 400,
      code: "FEATURE_KEY_REQUIRED",
      value: null,
      reason,
      message: reason,
    };
  }
  const key = featureKey.trim();
  const context = await resolveContextArg(tenantId, ctxOrOpts);

  const meta = getEntitlementMeta(key);
  if (meta) {
    const ent = resolveEntitlementFromContext(context, key);
    let allowed;
    if (meta.type === "BOOLEAN") allowed = ent.value === true;
    else if (meta.type === "STRING_ARRAY")
      allowed = Array.isArray(ent.value) && ent.value.length > 0;
    else allowed = ent.isUnlimited || Number(ent.value) > 0;

    const reason = allowed
      ? null
      : `"${meta.label}" is not included in your current plan`;
    return {
      allowed,
      status: allowed ? 200 : 403,
      code: allowed ? null : "FEATURE_NOT_AVAILABLE",
      value: ent.value,
      reason,
      message: reason,
    };
  }

  // By name: an integration or a channel
  const upper = key.toUpperCase();
  if (INTEGRATION_CATALOG.includes(upper)) {
    const list =
      resolveEntitlementFromContext(context, "allowedIntegrations").value ?? [];
    const allowed = list.includes(upper);
    const reason = allowed
      ? null
      : `The ${upper} integration is not included in your plan`;
    return {
      allowed,
      status: allowed ? 200 : 403,
      code: allowed ? null : "INTEGRATION_NOT_ALLOWED",
      value: allowed,
      reason,
      message: reason,
    };
  }
  if (CHANNEL_CATALOG.includes(upper)) {
    const list =
      resolveEntitlementFromContext(context, "allowedChannels").value ?? [];
    const allowed = list.includes(upper);
    const reason = allowed
      ? null
      : `The ${upper} channel is not included in your plan`;
    return {
      allowed,
      status: allowed ? 200 : 403,
      code: allowed ? null : "CHANNEL_NOT_ALLOWED",
      value: allowed,
      reason,
      message: reason,
    };
  }
  const reason = `Unknown feature "${featureKey}"`;
  return {
    allowed: false,
    status: 400,
    code: "UNKNOWN_FEATURE",
    value: null,
    reason,
    message: reason,
  };
};

/** Checks whether a specific messaging channel (WHATSAPP | INSTAGRAM | MESSENGER) is allowed. */
export const checkChannelAccess = async (tenantId, channel, ctxOrOpts) => {
  if (typeof channel !== "string" || !channel.trim()) {
    const reason = "A channel name is required";
    return {
      allowed: false,
      status: 400,
      code: "CHANNEL_REQUIRED",
      value: false,
      reason,
      message: reason,
    };
  }
  const upper = channel.trim().toUpperCase();
  const context = await resolveContextArg(tenantId, ctxOrOpts);
  const list =
    resolveEntitlementFromContext(context, "allowedChannels").value ?? [];
  const allowed = Array.isArray(list) && list.includes(upper);
  const reason = allowed
    ? null
    : `The ${upper} channel is not included in your current plan`;
  return {
    allowed,
    status: allowed ? 200 : 403,
    code: allowed ? null : "CHANNEL_NOT_ALLOWED",
    value: allowed,
    reason,
    message: reason,
  };
};

/** Read-only check for STATIC / METERED limits (never writes). `requiredCount` may be fractional (storage MB). */
export const checkLimitAccess = async (
  tenantId,
  limitKey,
  requiredCount = 1,
  ctxOrOpts,
) => {
  const meta = getEntitlementMeta(limitKey);
  if (!meta) {
    const reason = `Unknown entitlement "${limitKey}"`;
    return {
      allowed: false,
      status: 400,
      code: "UNKNOWN_ENTITLEMENT",
      reason,
      message: reason,
    };
  }
  if (!Number.isFinite(requiredCount) || requiredCount < 0) {
    const reason = "requiredCount must be a non-negative number";
    return {
      allowed: false,
      status: 400,
      code: "INVALID_REQUIRED_COUNT",
      reason,
      message: reason,
    };
  }
  if (meta.usage !== "STATIC" && meta.usage !== "METERED") {
    return { allowed: true, status: 200, code: null, reason: null, message: null };
  }

  const ctx = await resolveContextArg(tenantId, ctxOrOpts);
  const u = await getUsage(tenantId, limitKey, { ctx });

  if (meta.usage === "STATIC") {
    if (u.isUnlimited) {
      return {
        allowed: true,
        status: 200,
        code: null,
        current: u.used,
        limit: -1,
        remaining: -1,
        isUnlimited: true,
        reason: null,
        message: null,
      };
    }
    const allowed = u.used + requiredCount <= u.limit;
    const reason = allowed
      ? null
      : `${meta.label} limit reached (${u.used} of ${u.limit}). Upgrade your plan or buy an add-on.`;
    return {
      allowed,
      status: allowed ? 200 : 403,
      code: allowed ? null : "PLAN_LIMIT_REACHED",
      current: u.used,
      limit: u.limit,
      remaining: u.remaining,
      isUnlimited: false,
      reason,
      message: reason,
    };
  }

  if (u.isUnlimited) {
    return {
      allowed: true,
      status: 200,
      code: null,
      used: u.used,
      baseLimit: -1,
      poolRemaining: u.poolRemaining,
      totalLimit: -1,
      remaining: -1,
      isUnlimited: true,
      reason: null,
      message: null,
    };
  }
  const allowed = u.remaining >= requiredCount;
  const reason = allowed
    ? null
    : `Monthly ${meta.label} quota exhausted (${u.remaining} remaining, ${requiredCount} needed). Buy a top-up or upgrade your plan.`;
  return {
    allowed,
    status: allowed ? 200 : 403,
    code: allowed ? null : "QUOTA_EXCEEDED",
    used: u.used,
    baseLimit: u.baseLimit,
    poolRemaining: u.poolRemaining,
    totalLimit: u.totalLimit,
    remaining: u.remaining,
    isUnlimited: false,
    reason,
    message: reason,
  };
};

export const checkMeteredAccess = checkLimitAccess;

/** Pre-upload storage check, in exact bytes. Call after multer (size known); delete the file if denied. */
export const checkStorageAccess = async (
  tenantId,
  incomingBytes = 0,
  ctxOrOpts,
) => {
  const context = await resolveContextArg(tenantId, ctxOrOpts);
  const ent = resolveEntitlementFromContext(context, "maxStorageMb");
  const usedBytes = await getStorageUsedBytes(tenantId);
  const usedMb = round2(usedBytes / BYTES_PER_MB);
  const incomingMb = round2(incomingBytes / BYTES_PER_MB);

  if (ent.isUnlimited) {
    return {
      allowed: true,
      status: 200,
      code: null,
      usedMb,
      limitMb: -1,
      remainingMb: -1,
      incomingMb,
      isUnlimited: true,
      reason: null,
      message: null,
    };
  }
  const limitBytes = ent.value * BYTES_PER_MB;
  const allowed = usedBytes + incomingBytes <= limitBytes;
  const reason = allowed
    ? null
    : `Storage limit reached (${usedMb} MB of ${ent.value} MB used, upload needs ${incomingMb} MB). Upgrade your plan or buy a storage add-on.`;
  return {
    allowed,
    status: allowed ? 200 : 403,
    code: allowed ? null : "STORAGE_LIMIT_REACHED",
    usedMb,
    limitMb: ent.value,
    remainingMb: Math.max(round2((limitBytes - usedBytes) / BYTES_PER_MB), 0),
    incomingMb,
    isUnlimited: false,
    reason,
    message: reason,
  };
};

/** Check + consume in ONE atomic step (no separate check). Use this for metered actions. */
export const enforceAndConsumeQuota = async (
  tenantId,
  limitKey,
  count = 1,
  ctxOrOpts,
) => {
  const meta = getEntitlementMeta(limitKey);
  if (!meta || meta.usage !== "METERED") {
    const reason = `"${limitKey}" is not a metered entitlement`;
    return {
      allowed: false,
      status: 400,
      code: "NOT_METERED_ENTITLEMENT",
      reason,
      message: reason,
    };
  }
  const ctx = await resolveContextArg(tenantId, ctxOrOpts);
  const result = await consumeQuota(tenantId, limitKey, count, { ctx });
  if (!result.success) {
    const reason = `Monthly ${meta.label} quota exhausted (${result.remaining} remaining, ${count} needed). Buy a top-up or upgrade your plan.`;
    return {
      ...result,
      allowed: false,
      status: 403,
      code: result.reason || "QUOTA_EXCEEDED",
      reason,
      message: reason,
    };
  }
  return {
    ...result,
    allowed: true,
    status: 200,
    code: null,
    reason: null,
    message: null,
  };
};
