// backend/src/modules/superadmin/addons/sradmin.addons.service.js (do not remove this comment)
import prisma from "../../../config/prisma.js";
import { HttpError } from "../../../lib/utils/http.error.js";
import { logAdminAction, buildChangeSet } from "../../../lib/utils/admin.audit.js";
import { ENTITLEMENT_REGISTRY } from "../../../lib/entitlements/registry.js";
import { ENTITLEMENT_CATALOGS } from "../plans/sradmin.plans.schema.js";

const MAX_INT = 2147483647;
const AUDITED_FIELDS = [
  "name",
  "description",
  "billingCycle",
  "price",
  "entitlementKey",
  "entitlementValue",
  "razorpayPlanId",
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Semantic validation against the entitlement registry.
 * Returns the normalized { billingCycle, entitlementValue }.
 */
const normalizeAddOnRules = ({ type, billingCycle, entitlementKey, entitlementValue }) => {
  const meta = ENTITLEMENT_REGISTRY[entitlementKey];
  if (!meta) {
    throw new HttpError(400, `Unknown entitlementKey "${entitlementKey}"`);
  }

  let normalizedValue;
  switch (meta.type) {
    case "INT": {
      if (
        !Number.isInteger(entitlementValue) ||
        entitlementValue < 1 ||
        entitlementValue > MAX_INT
      ) {
        throw new HttpError(
          400,
          `entitlementValue for "${entitlementKey}" must be a whole number between 1 and ${MAX_INT} (unlimited is not sellable as an add-on)`,
        );
      }
      normalizedValue = entitlementValue;
      break;
    }
    case "BOOLEAN": {
      if (entitlementValue !== true) {
        throw new HttpError(
          400,
          `entitlementValue for "${entitlementKey}" must be true (an add-on can only enable a feature)`,
        );
      }
      normalizedValue = true;
      break;
    }
    case "STRING_ARRAY": {
      const catalog = ENTITLEMENT_CATALOGS[entitlementKey];
      if (!catalog) {
        throw new HttpError(
          500,
          `No catalog is registered for "${entitlementKey}" — update ENTITLEMENT_CATALOGS`,
        );
      }
      if (!Array.isArray(entitlementValue) || entitlementValue.length === 0) {
        throw new HttpError(
          400,
          `entitlementValue for "${entitlementKey}" must be a non-empty array`,
        );
      }
      const invalid = entitlementValue.filter((v) => !catalog.includes(v));
      if (invalid.length) {
        throw new HttpError(
          400,
          `Invalid value(s) for "${entitlementKey}": ${invalid.join(", ")}. Allowed: ${catalog.join(", ")}`,
        );
      }
      normalizedValue = [...new Set(entitlementValue)].sort();
      break;
    }
    default:
      throw new HttpError(500, `Unsupported entitlement type "${meta.type}"`);
  }

  let cycle;
  if (type === "ONE_TIME_TOPUP") {
    if (meta.type !== "INT" || meta.usage !== "METERED") {
      throw new HttpError(
        400,
        `Top-up packs can only target metered numeric entitlements (credits / quotas). "${entitlementKey}" is not one.`,
      );
    }
    if (billingCycle && billingCycle !== "ONE_TIME") {
      throw new HttpError(400, "Top-up packs must use billingCycle ONE_TIME");
    }
    cycle = "ONE_TIME";
  } else {
    if (billingCycle === "ONE_TIME") {
      throw new HttpError(400, "Recurring add-ons cannot use billingCycle ONE_TIME");
    }
    cycle = billingCycle ?? "MONTHLY";
  }

  return { billingCycle: cycle, entitlementValue: normalizedValue };
};

const getCountsByAddOn = async (ids) => {
  if (!ids.length) return {};
  const rows = await prisma.tenantAddOn.groupBy({
    by: ["addOnId", "status"],
    where: { addOnId: { in: ids } },
    _count: { _all: true },
  });
  const map = {};
  for (const r of rows) {
    const entry = (map[r.addOnId] ||= { active: 0, total: 0 });
    entry.total += r._count._all;
    if (r.status === "active" || r.status === "cancel_at_period_end") {
      entry.active += r._count._all;
    }
  }
  return map;
};

const serializeAddOn = (addOn, counts = {}) => {
  const meta = ENTITLEMENT_REGISTRY[addOn.entitlementKey];
  return {
    ...addOn,
    entitlementLabel: meta?.label ?? addOn.entitlementKey,
    entitlementUnit: meta?.unit ?? null,
    entitlementImplemented: meta?.implemented ?? false,
    activeSubscribers: counts.active ?? 0,
    totalPurchases: counts.total ?? 0,
  };
};

const findAddOnOrThrow = async (id) => {
  const addOn = await prisma.planAddOn.findUnique({ where: { id } });
  if (!addOn) throw new HttpError(404, "Add-on not found");
  return addOn;
};

const countActiveHolders = (addOnId) =>
  prisma.tenantAddOn.count({
    where: { addOnId, status: { in: ["active", "cancel_at_period_end"] } },
  });

const auditTarget = (addOn) => ({
  targetId: addOn.id,
  targetType: "PlanAddOn",
  targetName: addOn.name,
});

// ─────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────
export const listAddOnsService = async ({ type, isActive, search } = {}) => {
  const where = {};
  if (type) where.type = type;
  if (isActive !== undefined) where.isActive = isActive;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { key: { contains: search, mode: "insensitive" } },
    ];
  }

  const addOns = await prisma.planAddOn.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  const counts = await getCountsByAddOn(addOns.map((a) => a.id));

  return {
    addOns: addOns.map((a) => serializeAddOn(a, counts[a.id])),
    total: addOns.length,
  };
};

export const getAddOnByIdService = async (id) => {
  const addOn = await findAddOnOrThrow(id);
  const counts = await getCountsByAddOn([id]);
  return serializeAddOn(addOn, counts[id]);
};

// ─────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────
export const createAddOnService = async (data, actor, meta) => {
  const rules = normalizeAddOnRules(data);

  let sortOrder = data.sortOrder;
  if (sortOrder === undefined) {
    const agg = await prisma.planAddOn.aggregate({ _max: { sortOrder: true } });
    sortOrder = (agg._max.sortOrder ?? -1) + 1;
  }

  let created;
  try {
    created = await prisma.planAddOn.create({
      data: {
        name: data.name,
        key: data.key,
        description: data.description ?? "",
        type: data.type,
        billingCycle: rules.billingCycle,
        price: data.price,
        isActive: data.isActive ?? true,
        sortOrder,
        entitlementKey: data.entitlementKey,
        entitlementValue: rules.entitlementValue,
      },
    });
  } catch (err) {
    if (err.code === "P2002") {
      throw new HttpError(409, `An add-on with key "${data.key}" already exists`);
    }
    throw err;
  }

  await logAdminAction(actor, meta, {
    action: "ADDON_CREATED",
    module: "BILLING",
    description: `SuperAdmin "${actor?.name}" created add-on "${created.name}" (${created.key}) — ${created.type}, ₹${created.price}`,
    ...auditTarget(created),
    metadata: {
      key: created.key,
      type: created.type,
      billingCycle: created.billingCycle,
      price: created.price,
      entitlementKey: created.entitlementKey,
      entitlementValue: created.entitlementValue,
      isActive: created.isActive,
    },
  });

  return serializeAddOn(created);
};

export const updateAddOnService = async (id, data, actor, meta) => {
  const existing = await findAddOnOrThrow(id);

  const rules = normalizeAddOnRules({
    type: existing.type,
    billingCycle: data.billingCycle ?? existing.billingCycle,
    entitlementKey: data.entitlementKey ?? existing.entitlementKey,
    entitlementValue:
      data.entitlementValue !== undefined ? data.entitlementValue : existing.entitlementValue,
  });

  const keyChanged =
    data.entitlementKey !== undefined && data.entitlementKey !== existing.entitlementKey;
  const cycleChanged = rules.billingCycle !== existing.billingCycle;
  const priceChanged = data.price !== undefined && data.price !== existing.price;
  const valueChanged =
    JSON.stringify(rules.entitlementValue) !== JSON.stringify(existing.entitlementValue);

  const activeSubscribers = await countActiveHolders(id);

  if ((keyChanged || cycleChanged) && activeSubscribers > 0) {
    throw new HttpError(
      409,
      `${activeSubscribers} tenant(s) currently hold this add-on, so its entitlement key and billing cycle cannot change. Create a new add-on and deactivate this one instead.`,
    );
  }

  const updateData = {};
  if (data.name !== undefined && data.name !== existing.name) updateData.name = data.name;
  if (data.description !== undefined && data.description !== existing.description) {
    updateData.description = data.description;
  }
  if (priceChanged) updateData.price = data.price;
  if (cycleChanged) updateData.billingCycle = rules.billingCycle;
  if (keyChanged) updateData.entitlementKey = data.entitlementKey;
  if (valueChanged) updateData.entitlementValue = rules.entitlementValue;

  const razorpayPlanIdReset =
    (priceChanged || cycleChanged) && existing.razorpayPlanId !== null;
  if (razorpayPlanIdReset) updateData.razorpayPlanId = null;

  if (Object.keys(updateData).length === 0) {
    return {
      addOn: serializeAddOn(existing, { active: activeSubscribers }),
      impact: {
        activeSubscribers,
        changed: false,
        entitlementChanged: false,
        razorpayPlanIdReset: false,
      },
    };
  }

  const updated = await prisma.planAddOn.update({ where: { id }, data: updateData });

  await logAdminAction(actor, meta, {
    action: "ADDON_UPDATED",
    module: "BILLING",
    description: `SuperAdmin "${actor?.name}" updated add-on "${updated.name}" (${updated.key})`,
    ...auditTarget(updated),
    metadata: {
      changes: buildChangeSet(existing, updated, AUDITED_FIELDS),
      activeSubscribers,
    },
  });

  return {
    addOn: serializeAddOn(updated, { active: activeSubscribers }),
    impact: {
      activeSubscribers,
      changed: true,
      entitlementChanged: valueChanged || keyChanged,
      razorpayPlanIdReset,
    },
  };
};

export const toggleAddOnStatusService = async (id, actor, meta) => {
  const existing = await findAddOnOrThrow(id);
  const updated = await prisma.planAddOn.update({
    where: { id },
    data: { isActive: !existing.isActive },
  });
  const activeSubscribers = await countActiveHolders(id);

  await logAdminAction(actor, meta, {
    action: "ADDON_STATUS_CHANGED",
    module: "BILLING",
    description: `SuperAdmin "${actor?.name}" ${updated.isActive ? "activated" : "deactivated"} add-on "${updated.name}" (${updated.key})`,
    ...auditTarget(updated),
    metadata: {
      from: existing.isActive,
      to: updated.isActive,
      activeSubscribers,
    },
  });

  return {
    addOn: serializeAddOn(updated, { active: activeSubscribers }),
    impact: { activeSubscribers },
  };
};

export const reorderAddOnsService = async (orderedIds, actor, meta) => {
  const all = await prisma.planAddOn.findMany({ select: { id: true } });
  const known = new Set(all.map((a) => a.id));

  const unknown = orderedIds.filter((id) => !known.has(id));
  if (unknown.length) {
    throw new HttpError(404, `Unknown add-on id(s): ${unknown.join(", ")}`);
  }
  if (orderedIds.length !== all.length) {
    throw new HttpError(
      409,
      "The submitted order is stale or incomplete — reload the add-on list and try again",
    );
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.planAddOn.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );

  await logAdminAction(actor, meta, {
    action: "ADDON_REORDERED",
    module: "BILLING",
    description: `SuperAdmin "${actor?.name}" reordered ${orderedIds.length} add-on(s)`,
    metadata: { orderedIds },
  });

  return listAddOnsService();
};

export const deleteAddOnService = async (id, actor, meta) => {
  const existing = await findAddOnOrThrow(id);

  const [holders, payments, invoices] = await Promise.all([
    prisma.tenantAddOn.count({ where: { addOnId: id } }),
    prisma.payment.count({ where: { addOnId: id } }),
    prisma.invoice.count({ where: { addOnId: id } }),
  ]);

  if (holders + payments + invoices > 0) {
    throw new HttpError(
      409,
      `This add-on has billing history (${holders} subscription record(s), ${payments} payment(s), ${invoices} invoice(s)) and cannot be deleted. Deactivate it instead.`,
    );
  }

  await prisma.planAddOn.delete({ where: { id } });

  await logAdminAction(actor, meta, {
    action: "ADDON_DELETED",
    module: "BILLING",
    description: `SuperAdmin "${actor?.name}" deleted add-on "${existing.name}" (${existing.key})`,
    ...auditTarget(existing),
    metadata: {
      key: existing.key,
      type: existing.type,
      price: existing.price,
      entitlementKey: existing.entitlementKey,
      entitlementValue: existing.entitlementValue,
    },
  });

  return { id: existing.id, name: existing.name, key: existing.key };
};
