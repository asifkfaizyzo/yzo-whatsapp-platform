// backend/src/lib/entitlements/entitlement.service.js (do not remove this comment)
import prisma from "../../config/prisma.js";
import { ENTITLEMENT_REGISTRY, getEntitlementMeta } from "./registry.js";

// Narrow on purpose: gateway keys / OAuth tokens on tenant_subscription are never loaded here.
const SUBSCRIPTION_CONTEXT_SELECT = {
  tenantId: true,
  planId: true,
  billingCycle: true,
  subscriptionStatus: true,
  planPeriodStart: true,
  planPeriodEnd: true,
  freeUntilDate: true,
  gracePeriodEnd: true,
  customLimitsOverride: true,
  plan: { select: { id: true, name: true, status: true, entitlements: true } },
};

/**
 * One round of two queries. Pass the result as `ctx` to the pure resolvers below
 * (and to getUsage / checkLimitAccess / consumeQuota) to avoid re-fetching.
 *
 * Only RECURRING add-ons shape entitlements. One-time top-ups live in TenantCreditPool.
 * PlanAddOn.isActive only controls whether an add-on can be SOLD; existing holders keep it.
 */
export const getTenantSubscriptionContext = async (tenantId) => {
  const now = new Date();
  const [subscription, activeAddOns] = await Promise.all([
    prisma.tenantSubscription.findUnique({
      where: { tenantId },
      select: SUBSCRIPTION_CONTEXT_SELECT,
    }),
    prisma.tenantAddOn.findMany({
      where: {
        tenantId,
        status: { in: ["active", "cancel_at_period_end"] },
        addOn: { type: "RECURRING" },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: {
        id: true,
        quantity: true,
        source: true,
        expiresAt: true,
        addOn: {
          select: { id: true, key: true, name: true, type: true, entitlementKey: true, entitlementValue: true },
        },
      },
    }),
  ]);
  return { subscription, activeAddOns };
};

const unknownKey = (key) =>
  Object.assign(new Error(`Unknown entitlement key "${key}"`), { code: "UNKNOWN_ENTITLEMENT" });

const build = (key, meta, value, source, isUnlimited = false) => ({
  key,
  value,
  source,
  isUnlimited,
  meta,
});

const toArray = (v) => (Array.isArray(v) ? v : []);

/**
 * Pure resolver. Precedence:
 *   1. subscription.customLimitsOverride[key] (non-null)  -> wins outright
 *   2. plan value (or registry default) combined with active RECURRING add-ons
 * INT: -1 = unlimited; add-on values are multiplied by quantity and summed.
 * BOOLEAN: any true. STRING_ARRAY: union.
 */
export const resolveEntitlementFromContext = (ctx, key) => {
  const meta = getEntitlementMeta(key);
  if (!meta) throw unknownKey(key);

  const subscription = ctx?.subscription ?? null;
  const addOns = (ctx?.activeAddOns ?? []).filter((a) => a.addOn?.entitlementKey === key);

  const override = subscription?.customLimitsOverride?.[key];
  if (override !== undefined && override !== null) {
    return build(key, meta, override, "CUSTOM_OVERRIDE", meta.type === "INT" && override === -1);
  }

  const planValue = subscription?.plan?.entitlements?.[key];
  const hasPlanValue = planValue !== undefined && planValue !== null;
  const base = hasPlanValue ? planValue : meta.default;
  const baseSource = hasPlanValue ? "BASE_PLAN" : "REGISTRY_DEFAULT";

  switch (meta.type) {
    case "INT": {
      const baseNum = Number(base);
      if (baseNum === -1) return build(key, meta, -1, baseSource, true);
      let total = Number.isFinite(baseNum) ? baseNum : 0;
      let contributed = false;
      for (const a of addOns) {
        const v = Number(a.addOn.entitlementValue);
        if (!Number.isFinite(v)) continue;
        if (v === -1) return build(key, meta, -1, "ADD_ON", true);
        total += v * (a.quantity ?? 1);
        contributed = true;
      }
      if (!contributed) return build(key, meta, total, baseSource);
      return build(key, meta, total, total - 0 > 0 && baseNum > 0 ? "PLAN_PLUS_ADDONS" : "ADD_ON");
    }

    case "BOOLEAN": {
      const addOnGrants = addOns.some((a) => a.addOn.entitlementValue === true);
      if (base === true) return build(key, meta, true, baseSource);
      if (addOnGrants) return build(key, meta, true, "ADD_ON");
      return build(key, meta, false, baseSource);
    }

    case "STRING_ARRAY": {
      const baseArr = toArray(base);
      const extra = addOns.flatMap((a) => toArray(a.addOn.entitlementValue));
      if (extra.length === 0) return build(key, meta, baseArr, baseSource);
      const union = [...new Set([...baseArr, ...extra])];
      return build(key, meta, union, baseArr.length > 0 ? "PLAN_PLUS_ADDONS" : "ADD_ON");
    }

    default:
      // Unknown value type: return the base untouched rather than guessing how add-ons combine.
      return build(key, meta, base, baseSource);
  }
};

export const resolveAllEntitlementsFromContext = (ctx) => {
  const out = {};
  for (const key of Object.keys(ENTITLEMENT_REGISTRY)) {
    out[key] = resolveEntitlementFromContext(ctx, key);
  }
  return out;
};

export const resolveEntitlement = async (tenantId, key) => {
  const ctx = await getTenantSubscriptionContext(tenantId);
  return resolveEntitlementFromContext(ctx, key);
};

export const resolveAllEntitlements = async (tenantId) => {
  const ctx = await getTenantSubscriptionContext(tenantId);
  return resolveAllEntitlementsFromContext(ctx);
};
