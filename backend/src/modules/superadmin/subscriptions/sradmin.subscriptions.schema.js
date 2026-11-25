// backend/src/modules/superadmin/subscriptions/sradmin.subscriptions.schema.js (do not remove this comment)
import { z } from "zod";
import {
  ENTITLEMENT_REGISTRY,
  INTEGRATION_CATALOG,
  CHANNEL_CATALOG,
} from "../../../lib/entitlements/registry.js";

const idString = z.string().trim().min(1).max(64);
const optionalReason = z.string().trim().max(500).optional();
const requiredReason = z.string().trim().min(3).max(500);
const isoDate = z.iso.datetime({ offset: true });

export const BILLING_CYCLES = ["MONTHLY", "QUARTERLY", "ANNUAL"];
export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "cancel_at_period_end",
  "payment_failed",
  "expired",
  "paused",
];
export const OFFLINE_PAYMENT_METHODS = [
  "offline_bank_transfer",
  "cash",
  "direct_upi",
  "cheque",
  "imps",
  "neft",
  "rtgs",
];

const cycle = z.enum(BILLING_CYCLES);

const twoDecimals = (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;

// ── Params / query ───────────────────────────────────────────────────────────
export const tenantParamSchema = z.object({ tenantId: idString });
export const tenantAddOnParamSchema = z.object({
  tenantId: idString,
  tenantAddOnId: idString,
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(SUBSCRIPTION_STATUSES).optional(),
  planId: idString.optional(),
  search: z.string().trim().max(100).optional(),
  expiringWithinDays: z.coerce.number().int().min(1).max(365).optional(),
  sortBy: z.enum(["updatedAt", "planPeriodEnd"]).default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ── Lifecycle bodies ─────────────────────────────────────────────────────────
export const extendSchema = z.strictObject({
  days: z.number().int().min(1).max(3650),
  reason: optionalReason,
});

export const extendTrialSchema = z.strictObject({
  days: z.number().int().min(1).max(365),
  reason: optionalReason,
});

export const changePlanSchema = z.discriminatedUnion("mode", [
  z.strictObject({
    mode: z.literal("IMMEDIATE"),
    planId: idString,
    billingCycle: cycle.optional(),
    detachAutopay: z.boolean().default(false),
    reason: optionalReason,
  }),
  z.strictObject({
    mode: z.literal("AT_PERIOD_END"),
    planId: idString,
    billingCycle: cycle.optional(),
    reason: optionalReason,
  }),
  z.strictObject({
    mode: z.literal("CLEAR_PENDING"),
    reason: optionalReason,
  }),
]);

export const manualActivateSchema = z.strictObject({
  planId: idString,
  billingCycle: cycle.default("MONTHLY"),
  amount: z
    .number()
    .positive()
    .max(10_000_000)
    .refine(twoDecimals, "amount supports at most 2 decimal places"),
  durationDays: z.number().int().min(1).max(3650).optional(),
  paymentMethod: z.enum(OFFLINE_PAYMENT_METHODS),
  paymentRef: z.string().trim().min(3).max(64),
  paidAt: isoDate
    .refine((v) => new Date(v).getTime() <= Date.now() + 60_000, "paidAt cannot be in the future")
    .optional(),
  carryOverRemainingDays: z.boolean().default(true),
  notes: optionalReason,
});

export const pauseSchema = z.strictObject({ reason: optionalReason });

export const reactivateSchema = z.strictObject({
  days: z.number().int().min(1).max(3650).optional(),
  planId: idString.optional(),
  billingCycle: cycle.optional(),
  activateAs: z.enum(["TRIAL", "ACTIVE"]).optional(),
  reason: optionalReason,
});

export const expireSchema = z.strictObject({ reason: requiredReason });

// ── Overrides ────────────────────────────────────────────────────────────────
const CATALOG_BY_KEY = {
  allowedChannels: CHANNEL_CATALOG,
  allowedIntegrations: INTEGRATION_CATALOG,
};

const valueSchemaFor = (key, meta) => {
  switch (meta.type) {
    case "INT":
      return z.number().int().min(-1).max(2_000_000_000); // -1 = unlimited
    case "BOOLEAN":
      return z.boolean();
    case "STRING_ARRAY": {
      const catalog = CATALOG_BY_KEY[key];
      if (!catalog) {
        // Fail fast at boot, same policy as the plans schema.
        throw new Error(`No catalog mapped for STRING_ARRAY entitlement "${key}"`);
      }
      return z
        .array(z.enum(catalog))
        .refine((a) => new Set(a).size === a.length, "duplicate values");
    }
    default:
      throw new Error(`Unsupported entitlement type "${meta.type}" for "${key}"`);
  }
};

const limitsShape = Object.fromEntries(
  Object.entries(ENTITLEMENT_REGISTRY).map(([key, meta]) => [
    key,
    valueSchemaFor(key, meta).optional(),
  ])
);

export const updateLimitsSchema = z.strictObject({
  limits: z.strictObject(limitsShape), // {} clears every override
  reason: optionalReason,
});

export const updateGraceSchema = z.strictObject({
  gracePeriodDays: z.number().int().min(0).max(90).nullable(), // null = platform default
  reason: optionalReason,
});

export const updateFreeUntilSchema = z.strictObject({
  freeUntilDate: isoDate.nullable(), // null clears
  reason: optionalReason,
});

// ── Add-on grants ────────────────────────────────────────────────────────────
export const grantAddOnSchema = z.strictObject({
  addOnId: idString,
  quantity: z.number().int().min(1).max(1000).default(1),
  expiresAt: isoDate.nullable().optional(), // null/omitted = until revoked
  reason: optionalReason,
});

export const revokeAddOnSchema = z.strictObject({ reason: optionalReason });
