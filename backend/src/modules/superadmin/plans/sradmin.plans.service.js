// backend/src/modules/superadmin/plans/sradmin.plans.service.js (do not remove this comment)

import prisma from "../../../config/prisma.js";
import {
  ENTITLEMENT_REGISTRY,
  INTEGRATION_CATALOG,
  CHANNEL_CATALOG,
  getDefaultEntitlements,
} from "../../../lib/entitlements/registry.js";
import { HttpError } from "../../../lib/utils/http.error.js";
import {
  PLAN_TYPES,
  PLAN_VISIBILITIES,
  PLAN_STATUSES,
  ENTITLEMENT_CATALOGS,
} from "./sradmin.plans.schema.js";

// A subscription "uses" a plan unless it is fully expired.
const NOT_EXPIRED = { NOT: { subscriptionStatus: "expired" } };

const COUNT_INCLUDE = { _count: { select: { tenantSubscriptions: true } } };

// ─────────────────────────── helpers ───────────────────────────

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function rethrowPrisma(error) {
  if (error?.code === "P2002") {
    throw new HttpError(409, "A plan with this name already exists");
  }
  throw error;
}
// Scalar fields recorded in the audit trail on update.
const AUDITED_PLAN_FIELDS = [
  "name",
  "description",
  "planType",
  "visibility",
  "sortOrder",
  "badgeText",
  "customTenantId",
  "monthlyPrice",
  "quarterlyPrice",
  "annualPrice",
  "originalPrice",
  "offerValidUntil",
  "hasTrial",
  "trialDays",
  "trialRequiresCard",
];

// Date-safe normalisation (isPlainObject() treats Date as an object, so it can't be compared directly)
const comparable = (v) => (v instanceof Date ? v.toISOString() : v ?? null);

function buildPlanChangeSet(before, after) {
  const changes = {};

  for (const field of AUDITED_PLAN_FIELDS) {
    const from = comparable(before[field]);
    const to = comparable(after[field]);
    if (stableStringify(from) !== stableStringify(to)) {
      changes[field] = { from, to };
    }
  }

  const beforeEnt = isPlainObject(before.entitlements) ? before.entitlements : {};
  const afterEnt = isPlainObject(after.entitlements) ? after.entitlements : {};
  const entitlementChanges = {};
  for (const key of new Set([...Object.keys(beforeEnt), ...Object.keys(afterEnt)])) {
    const from = beforeEnt[key] ?? null;
    const to = afterEnt[key] ?? null;
    if (stableStringify(from) !== stableStringify(to)) {
      entitlementChanges[key] = { from, to };
    }
  }
  if (Object.keys(entitlementChanges).length) changes.entitlements = entitlementChanges;

  return changes;
}

function serializePlan(plan, activeSubscribers = 0) {
  const { _count, ...rest } = plan;
  const stored = isPlainObject(plan.entitlements) ? plan.entitlements : {};
  return {
    ...rest,
    // What the engine will actually resolve for this plan (stored values over registry defaults)
    resolvedEntitlements: { ...getDefaultEntitlements(), ...stored },
    isOfferExpired: Boolean(plan.offerValidUntil && plan.offerValidUntil <= new Date()),
    totalSubscribers: _count?.tenantSubscriptions ?? 0,
    activeSubscribers,
  };
}

async function countActiveSubscribers(planId, db = prisma) {
  return db.tenantSubscription.count({ where: { planId, ...NOT_EXPIRED } });
}

async function assertTenantExists(tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true },
  });
  if (!tenant) {
    throw new HttpError(404, "Tenant not found for customTenantId");
  }
}

/**
 * Cross-field business rules. Runs against the FINAL (merged) plan state.
 */
function assertPlanRules(p) {
  if (p.planType === "CUSTOM") {
    if (!p.customTenantId) {
      throw new HttpError(400, "customTenantId is required for CUSTOM plans");
    }
    if (p.visibility !== "ADMIN_ONLY") {
      throw new HttpError(400, "CUSTOM plans must have visibility ADMIN_ONLY");
    }
    if (p.hasTrial) {
      throw new HttpError(400, "CUSTOM plans cannot offer a trial (they are admin-assigned)");
    }
  } else {
    if (p.customTenantId) {
      throw new HttpError(400, "customTenantId is only allowed for CUSTOM plans");
    }
    if (!(p.monthlyPrice > 0)) {
      throw new HttpError(400, "monthlyPrice must be greater than 0 for REGULAR/PROMO plans");
    }
    if (p.quarterlyPrice != null && !(p.quarterlyPrice > 0)) {
      throw new HttpError(400, "quarterlyPrice must be greater than 0 when set");
    }
    if (p.annualPrice != null && !(p.annualPrice > 0)) {
      throw new HttpError(400, "annualPrice must be greater than 0 when set");
    }
  }

  if (p.originalPrice != null && !(p.originalPrice > p.monthlyPrice)) {
    throw new HttpError(
      400,
      "originalPrice (strikethrough) must be greater than monthlyPrice"
    );
  }
}

function assertOfferInFuture(offerValidUntil) {
  if (offerValidUntil && offerValidUntil <= new Date()) {
    throw new HttpError(400, "offerValidUntil must be a future date/time");
  }
}

// ─────────────────────────── services ───────────────────────────

export const getRegistryMetadataService = () => {
  const entitlements = Object.entries(ENTITLEMENT_REGISTRY).map(([key, meta]) => {
    // counterModel is an internal implementation detail — not exposed to forms
    const { counterModel, ...publicMeta } = meta;
    return { key, ...publicMeta, catalog: ENTITLEMENT_CATALOGS[key] ?? null };
  });

  return {
    unlimitedValue: -1,
    categories: [...new Set(entitlements.map((e) => e.category))],
    entitlements,
    catalogs: {
      integrations: [...INTEGRATION_CATALOG],
      channels: [...CHANNEL_CATALOG],
    },
    enums: {
      planTypes: PLAN_TYPES,
      visibilities: PLAN_VISIBILITIES,
      statuses: PLAN_STATUSES,
    },
  };
};

export const listPlansService = async (filters = {}) => {
  const where = {};
  if (filters.status) where.status = filters.status;
  if (filters.planType) where.planType = filters.planType;
  if (filters.visibility) where.visibility = filters.visibility;
  if (filters.customTenantId) where.customTenantId = filters.customTenantId;
  if (filters.search) where.name = { contains: filters.search, mode: "insensitive" };

  const plans = await prisma.subscriptionPlan.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: COUNT_INCLUDE,
  });

  const grouped = plans.length
    ? await prisma.tenantSubscription.groupBy({
        by: ["planId"],
        where: { planId: { in: plans.map((p) => p.id) }, ...NOT_EXPIRED },
        _count: { _all: true },
      })
    : [];

  const activeByPlan = new Map(grouped.map((g) => [g.planId, g._count._all]));

  return plans.map((plan) => serializePlan(plan, activeByPlan.get(plan.id) ?? 0));
};

export const getPlanByIdService = async (id) => {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id },
    include: COUNT_INCLUDE,
  });
  if (!plan) throw new HttpError(404, "Plan not found");

  const active = await countActiveSubscribers(id);
  return serializePlan(plan, active);
};

export const createPlanService = async (input) => {
  const planType = input.planType ?? "REGULAR";

  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const agg = await prisma.subscriptionPlan.aggregate({ _max: { sortOrder: true } });
    sortOrder = (agg._max.sortOrder ?? -1) + 1; // append at the end
  }

  const data = {
    name: input.name,
    description: input.description ?? null,
    planType,
    visibility: input.visibility ?? (planType === "CUSTOM" ? "ADMIN_ONLY" : "PUBLIC"),
    sortOrder,
    badgeText: input.badgeText ?? null,
    customTenantId: input.customTenantId ?? null,
    monthlyPrice: input.monthlyPrice,
    quarterlyPrice: input.quarterlyPrice ?? null,
    annualPrice: input.annualPrice ?? null,
    originalPrice: input.originalPrice ?? null,
    offerValidUntil: input.offerValidUntil ?? null,
    hasTrial: input.hasTrial ?? false,
    entitlements: input.entitlements ?? {},
  };
  if (input.trialDays !== undefined) data.trialDays = input.trialDays; // else DB default

  assertPlanRules(data);
  assertOfferInFuture(data.offerValidUntil);
  if (planType === "CUSTOM") await assertTenantExists(data.customTenantId);

  try {
    const plan = await prisma.subscriptionPlan.create({ data, include: COUNT_INCLUDE });
    return serializePlan(plan, 0);
  } catch (error) {
    return rethrowPrisma(error);
  }
};

export const updatePlanService = async (id, input) => {
  const existing = await prisma.subscriptionPlan.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Plan not found");

  assertPlanRules({ ...existing, ...input });
  if (input.offerValidUntil !== undefined) assertOfferInFuture(input.offerValidUntil);

  const data = { ...input };

  // Razorpay plans are immutable: when a cycle's price changes, drop that cycle's
  // Razorpay plan ID so it is lazily re-created at next subscribe (V1 bug fix).
  const razorpayPlanIdsReset = [];
  const priceChanged = (key) => input[key] !== undefined && input[key] !== existing[key];

  if (priceChanged("monthlyPrice")) {
    data.razorpayMonthlyPlanId = null;
    razorpayPlanIdsReset.push("MONTHLY");
  }
  if (priceChanged("quarterlyPrice")) {
    data.razorpayQuarterlyPlanId = null;
    razorpayPlanIdsReset.push("QUARTERLY");
  }
  if (priceChanged("annualPrice")) {
    data.razorpayAnnualPlanId = null;
    razorpayPlanIdsReset.push("ANNUAL");
  }

  const entitlementsChanged =
    input.entitlements !== undefined &&
    stableStringify(input.entitlements) !== stableStringify(existing.entitlements ?? {});

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const plan = await tx.subscriptionPlan.update({
        where: { id },
        data,
        include: COUNT_INCLUDE,
      });

      // Keep the display snapshot on subscriptions in sync with a rename
      if (input.name !== undefined && input.name !== existing.name) {
        await tx.tenantSubscription.updateMany({
          where: { planId: id },
          data: { currentPlan: plan.name },
        });
      }
      return plan;
    });

    const active = await countActiveSubscribers(id);

    return {
      plan: serializePlan(updated, active),
      impact: {
        activeSubscribers: active,
        entitlementsChanged, // applies LIVE to all current subscribers
        razorpayPlanIdsReset, // price changes apply to NEW subscriptions only
      },
      changes: buildPlanChangeSet(existing, updated), // consumed by the controller for the audit log
    };
  } catch (error) {
    return rethrowPrisma(error);
  }
};

export const togglePlanStatusService = async (id) => {
  const existing = await prisma.subscriptionPlan.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Plan not found");

  const nextStatus = existing.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

  const updated = await prisma.subscriptionPlan.update({
    where: { id },
    data: { status: nextStatus },
    include: COUNT_INCLUDE,
  });

  const active = await countActiveSubscribers(id);
  return serializePlan(updated, active);
};

/**
 * orderedIds must be the COMPLETE list of plans in desired order.
 * sortOrder = index. A stale list (plans added/removed meanwhile) is rejected.
 */
export const reorderPlansService = async (orderedIds) => {
  const total = await prisma.subscriptionPlan.count();
  const found = await prisma.subscriptionPlan.count({ where: { id: { in: orderedIds } } });

  if (found !== orderedIds.length) {
    throw new HttpError(404, "One or more plan IDs do not exist");
  }
  if (orderedIds.length !== total) {
    throw new HttpError(
      409,
      "orderedIds must contain every plan. The plan list has changed — refresh and retry."
    );
  }

  await prisma.$transaction(
    orderedIds.map((planId, index) =>
      prisma.subscriptionPlan.update({ where: { id: planId }, data: { sortOrder: index } })
    )
  );

  return listPlansService({});
};

export const deletePlanService = async (id) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.subscriptionPlan.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Plan not found");

    const active = await countActiveSubscribers(id, tx);
    if (active > 0) {
      throw new HttpError(
        409,
        `Cannot delete: ${active} tenant(s) are currently on this plan. Deactivate it instead (toggle-status) to stop new sign-ups.`
      );
    }
        // A scheduled (pending) plan change targeting this plan also blocks deletion.
    const pendingRefs = await tx.tenantSubscription.count({
      where: { pendingPlanId: id, NOT: { subscriptionStatus: "expired" } },
    });
    if (pendingRefs > 0) {
      throw new HttpError(
        409,
        `Cannot delete: ${pendingRefs} tenant(s) have a scheduled plan change to this plan. Clear those changes (change-plan mode CLEAR_PENDING) or deactivate the plan instead.`
      );
    }


    // Expired subscriptions keep their name snapshot + grace-debt price snapshot;
    // only the live plan link is cleared.
    await tx.tenantSubscription.updateMany({
      where: { planId: id },
      data: { planId: null },
    });
    await tx.subscriptionPlan.delete({ where: { id } });

    return { id: existing.id, name: existing.name };
  });
};