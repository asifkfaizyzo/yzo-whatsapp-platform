// backend/src/lib/entitlements/usage.service.js (do not remove this comment)
import prisma from "../../config/prisma.js";
import { getEntitlementMeta } from "./registry.js";
import {
  getTenantSubscriptionContext,
  resolveEntitlementFromContext,
  resolveAllEntitlementsFromContext,
} from "./entitlement.service.js";
import { BYTES_PER_MB, getStorageUsedBytes } from "./storage.service.js";

const STORAGE_KEY = "maxStorageMb";
const INT_CEILING = 2_000_000_000; // "unlimited" cap for metering (still counted, never denied)
const MAX_CONSUME_BATCH = 10_000_000;
const MAX_GRANT = 100_000_000;

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const percent = (part, total) =>
  total > 0 ? Math.min(100, Math.round((part / total) * 100)) : part > 0 ? 100 : 0;

class QuotaExceeded extends Error {}

// ─────────────────────────────────────────────────────────────────────────────
// Usage windows: monthly, anchored on planPeriodStart, END EXCLUSIVE.
// Extending a subscription (planPeriodEnd) never moves the anchor, so usage does not reset.
// A new paid period (renewal / manual-activate) moves planPeriodStart and starts a fresh quota.
// No period at all -> UTC calendar month.
// ─────────────────────────────────────────────────────────────────────────────
const addMonthsUTC = (anchor, k) => {
  const a = new Date(anchor);
  const day = a.getUTCDate();
  const t = new Date(
    Date.UTC(
      a.getUTCFullYear(),
      a.getUTCMonth() + k,
      1,
      a.getUTCHours(),
      a.getUTCMinutes(),
      a.getUTCSeconds(),
      a.getUTCMilliseconds()
    )
  );
  const lastDay = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(day, lastDay));
  return t;
};

export const getUsageWindow = (subscription, now = new Date()) => {
  const anchor = subscription?.planPeriodStart ? new Date(subscription.planPeriodStart) : null;
  if (!anchor || Number.isNaN(anchor.getTime())) {
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    return { periodStart: new Date(Date.UTC(y, m, 1)), periodEnd: new Date(Date.UTC(y, m + 1, 1)) };
  }
  let k = (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + (now.getUTCMonth() - anchor.getUTCMonth());
  if (k < 0) k = 0;
  while (k > 0 && addMonthsUTC(anchor, k) > now) k -= 1;
  while (addMonthsUTC(anchor, k + 1) <= now) k += 1;
  return { periodStart: addMonthsUTC(anchor, k), periodEnd: addMonthsUTC(anchor, k + 1) };
};

export const getTenantUsagePeriod = async (tenantId) => {
  const sub = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    select: { planPeriodStart: true },
  });
  return getUsageWindow(sub);
};

const usageWhere = (tenantId, window, key) => ({
  tenantId_periodStart_periodEnd_key: {
    tenantId,
    periodStart: window.periodStart,
    periodEnd: window.periodEnd,
    key,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// STATIC counters (check-then-create; concurrent creates may overshoot by a few; documented)
// ─────────────────────────────────────────────────────────────────────────────
export const getStaticCount = async (tenantId, key) => {
  if (key === STORAGE_KEY) {
    return round2((await getStorageUsedBytes(tenantId)) / BYTES_PER_MB); // MB, 2 decimals
  }
  const meta = getEntitlementMeta(key);
  switch (meta?.counterModel) {
    case "User":
      return prisma.user.count({ where: { tenantId, deletedAt: null } });
    case "Contact":
      return prisma.contact.count({ where: { tenantId } });
    case "Tag":
      return prisma.tag.count({ where: { tenantId } });
    case "SheetField":
      return prisma.sheetField.count({ where: { tenantId, fieldCategory: "custom" } });
    case "Flow":
      return prisma.flow.count({ where: { tenantId } });
    default:
      return 0;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Describe (pure)
// ─────────────────────────────────────────────────────────────────────────────
const describeStatic = (key, meta, ent, used) => {
  if (ent.isUnlimited) {
    return {
      key, type: meta.type, usageType: "STATIC", limit: -1, used, remaining: -1,
      percentage: 0, isUnlimited: true, source: ent.source, meta,
    };
  }
  const limit = ent.value;
  return {
    key, type: meta.type, usageType: "STATIC", limit, used,
    remaining: Math.max(round2(limit - used), 0),
    percentage: percent(used, limit),
    isUnlimited: false, source: ent.source, meta,
  };
};

const describeMetered = (key, meta, ent, window, used, pool) => {
  const granted = pool?.granted ?? 0;
  const consumed = pool?.consumed ?? 0;
  const poolRemaining = Math.max(granted - consumed, 0);
  const creditPool = { granted, consumed, remaining: poolRemaining };
  const base = { key, type: meta.type, usageType: "METERED", periodStart: window.periodStart, periodEnd: window.periodEnd };

  if (ent.isUnlimited) {
    return {
      ...base, baseLimit: -1, used, creditPool, poolRemaining, totalLimit: -1, remaining: -1,
      percentage: 0, isUnlimited: true, source: ent.source, meta,
    };
  }
  const baseLimit = ent.value;
  const remaining = Math.max(baseLimit - used, 0) + poolRemaining;
  const totalLimit = baseLimit + poolRemaining;
  return {
    ...base, baseLimit, used, creditPool, poolRemaining, totalLimit, remaining,
    percentage: percent(Math.max(totalLimit - remaining, 0), totalLimit),
    isUnlimited: false, source: ent.source, meta,
  };
};

// Reads never write: a missing row simply means zero.
const readMetered = async (db, tenantId, key, window) => {
  const [usage, pool] = await Promise.all([
    db.tenantUsage.findUnique({ where: usageWhere(tenantId, window, key), select: { used: true } }),
    db.tenantCreditPool.findUnique({
      where: { tenantId_key: { tenantId, key } },
      select: { granted: true, consumed: true },
    }),
  ]);
  return { used: usage?.used ?? 0, pool };
};

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────
export const getUsage = async (tenantId, key, { ctx } = {}) => {
  const meta = getEntitlementMeta(key);
  if (!meta) throw Object.assign(new Error(`Unknown entitlement key "${key}"`), { code: "UNKNOWN_ENTITLEMENT" });

  const context = ctx ?? (await getTenantSubscriptionContext(tenantId));
  const ent = resolveEntitlementFromContext(context, key);

  if (meta.usage === "STATIC") {
    return describeStatic(key, meta, ent, await getStaticCount(tenantId, key));
  }
  if (meta.usage === "METERED") {
    const window = getUsageWindow(context.subscription);
    const { used, pool } = await readMetered(prisma, tenantId, key, window);
    return describeMetered(key, meta, ent, window, used, pool);
  }
  return {
    key, type: meta.type, usageType: meta.usage, value: ent.value,
    isUnlimited: ent.isUnlimited, source: ent.source, meta,
  };
};

export const getCreditPool = async (tenantId, key) => {
  const pool = await prisma.tenantCreditPool.findUnique({
    where: { tenantId_key: { tenantId, key } },
    select: { granted: true, consumed: true },
  });
  const granted = pool?.granted ?? 0;
  const consumed = pool?.consumed ?? 0;
  return { key, granted, consumed, remaining: Math.max(granted - consumed, 0) };
};

/** Whole-tenant snapshot: 2 context queries + 2 batched reads + one count per STATIC key. */
export const getUsageSummary = async (tenantId) => {
  const ctx = await getTenantSubscriptionContext(tenantId);
  const resolved = resolveAllEntitlementsFromContext(ctx);
  const window = getUsageWindow(ctx.subscription);

  const [usageRows, poolRows] = await Promise.all([
    prisma.tenantUsage.findMany({
      where: { tenantId, periodStart: window.periodStart, periodEnd: window.periodEnd },
      select: { key: true, used: true },
    }),
    prisma.tenantCreditPool.findMany({ where: { tenantId }, select: { key: true, granted: true, consumed: true } }),
  ]);
  const usedByKey = new Map(usageRows.map((r) => [r.key, r.used]));
  const poolByKey = new Map(poolRows.map((r) => [r.key, r]));

  const staticKeys = Object.keys(resolved).filter((k) => resolved[k].meta.usage === "STATIC");
  const staticCounts = new Map(
    await Promise.all(staticKeys.map(async (k) => [k, await getStaticCount(tenantId, k)]))
  );

  const entitlements = {};
  for (const [key, ent] of Object.entries(resolved)) {
    const { meta } = ent;
    let row;
    if (meta.usage === "STATIC") {
      row = describeStatic(key, meta, ent, staticCounts.get(key) ?? 0);
    } else if (meta.usage === "METERED") {
      row = describeMetered(key, meta, ent, window, usedByKey.get(key) ?? 0, poolByKey.get(key));
    } else {
      row = {
        key, type: meta.type, usageType: meta.usage, value: ent.value,
        isUnlimited: ent.isUnlimited, source: ent.source, meta,
      };
    }
    entitlements[key] = {
      ...row,
      label: meta.label,
      category: meta.category,
      unit: meta.unit,
      implemented: meta.implemented,
    };
  }

  return { periodStart: window.periodStart, periodEnd: window.periodEnd, entitlements };
};

// ─────────────────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Atomically consumes `count` units: monthly base first, then the credit pool. All or nothing.
 *
 * Hot path = ONE statement (conditional UPDATE ... RETURNING). It only falls back to a locked
 * transaction when the row does not exist yet, or the base cannot cover the request.
 * Unlimited entitlements are still metered (capped at INT_CEILING), never denied.
 */
export const consumeQuota = async (tenantId, key, count = 1, { ctx } = {}) => {
  if (!Number.isInteger(count) || count < 1 || count > MAX_CONSUME_BATCH) {
    throw new Error(`consumeQuota: count must be an integer between 1 and ${MAX_CONSUME_BATCH}`);
  }
  const meta = getEntitlementMeta(key);
  if (!meta || meta.usage !== "METERED") {
    throw new Error(`consumeQuota: "${key}" is not a metered entitlement`);
  }

  const context = ctx ?? (await getTenantSubscriptionContext(tenantId));
  const ent = resolveEntitlementFromContext(context, key);
  const window = getUsageWindow(context.subscription);
  const cap = ent.isUnlimited ? INT_CEILING : ent.value;
  const baseLimit = ent.isUnlimited ? -1 : ent.value;
  const { periodStart, periodEnd } = window;

  const okResult = (used, fromBase, fromPool) => ({
    success: true, key, requested: count, used, baseLimit,
    isUnlimited: ent.isUnlimited, fromBase, fromPool,
  });

  // Fast path
  const fast = await prisma.$queryRaw`
    UPDATE "tenant_usages"
    SET "used" = "used" + ${count}::int
    WHERE "tenantId" = ${tenantId} AND "periodStart" = ${periodStart}
      AND "periodEnd" = ${periodEnd} AND "key" = ${key}
      AND "used" + ${count}::int <= ${cap}::int
    RETURNING "used"
  `;
  if (fast.length === 1) return okResult(fast[0].used, count, 0);

  // Slow path: missing row, or base exhausted (spill into pool / deny)
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.tenantUsage.createMany({
        data: [{ tenantId, periodStart, periodEnd, key, used: 0 }],
        skipDuplicates: true,
      });
      const locked = await tx.$queryRaw`
        SELECT "used" FROM "tenant_usages"
        WHERE "tenantId" = ${tenantId} AND "periodStart" = ${periodStart}
          AND "periodEnd" = ${periodEnd} AND "key" = ${key}
        FOR UPDATE
      `;
      const used = locked[0].used;
      const fromBase = Math.min(Math.max(cap - used, 0), count);
      const fromPool = count - fromBase;

      if (fromPool > 0) {
        const affected = await tx.$executeRaw`
          UPDATE "tenant_credit_pools"
          SET "consumed" = "consumed" + ${fromPool}::int, "updatedAt" = NOW()
          WHERE "tenantId" = ${tenantId} AND "key" = ${key}
            AND "granted" - "consumed" >= ${fromPool}::int
        `;
        if (affected === 0) throw new QuotaExceeded();
      }
      if (fromBase > 0) {
        await tx.tenantUsage.update({
          where: usageWhere(tenantId, window, key),
          data: { used: { increment: fromBase } },
        });
      }
      return okResult(used + fromBase, fromBase, fromPool);
    });
  } catch (err) {
    if (!(err instanceof QuotaExceeded)) throw err;
    const { used, pool } = await readMetered(prisma, tenantId, key, window);
    const state = describeMetered(key, meta, ent, window, used, pool);
    return {
      success: false,
      reason: "QUOTA_EXCEEDED",
      key,
      requested: count,
      used: state.used,
      baseLimit: state.baseLimit,
      poolRemaining: state.poolRemaining,
      totalLimit: state.totalLimit,
      remaining: state.remaining,
    };
  }
};

/**
 * Adds perpetual credits (top-up purchase or admin grant) to the tenant's pool. Atomic increment.
 * Pass a transaction client as `db` to make it part of a larger unit of work.
 */
export const grantCredits = async (tenantId, key, amount, db = prisma) => {
  const meta = getEntitlementMeta(key);
  if (!meta || meta.usage !== "METERED" || meta.type !== "INT") {
    throw new Error(`grantCredits: "${key}" is not a metered numeric entitlement`);
  }
  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_GRANT) {
    throw new Error(`grantCredits: amount must be an integer between 1 and ${MAX_GRANT}`);
  }
  await db.tenantCreditPool.createMany({
    data: [{ tenantId, key, granted: 0, consumed: 0 }],
    skipDuplicates: true,
  });
  const pool = await db.tenantCreditPool.update({
    where: { tenantId_key: { tenantId, key } },
    data: { granted: { increment: amount } },
    select: { granted: true, consumed: true },
  });
  return {
    key,
    added: amount,
    granted: pool.granted,
    consumed: pool.consumed,
    remaining: Math.max(pool.granted - pool.consumed, 0),
  };
};