// backend/src/modules/superadmin/plans/sradmin.plans.schema.js (do not remove this comment)

import { z } from "zod";
import {
  ENTITLEMENT_REGISTRY,
  INTEGRATION_CATALOG,
  CHANNEL_CATALOG,
} from "../../../lib/entitlements/registry.js";

export const PLAN_TYPES = ["REGULAR", "CUSTOM", "PROMO"];
export const PLAN_VISIBILITIES = ["PUBLIC", "HIDDEN_LINK_ONLY", "ADMIN_ONLY"];
export const PLAN_STATUSES = ["ACTIVE", "INACTIVE"];

const INT32_MAX = 2147483647;

/**
 * Which STRING_ARRAY entitlements are restricted to a code-defined catalog.
 * Any new STRING_ARRAY registry key MUST be mapped here (or boot fails — see below).
 */
export const ENTITLEMENT_CATALOGS = Object.freeze({
  allowedIntegrations: INTEGRATION_CATALOG,
  allowedChannels: CHANNEL_CATALOG,
});

/**
 * Builds a strict zod schema straight from the registry.
 * - Unknown keys are rejected (typos can't silently pass).
 * - Every key is optional (absent key => registry default at resolve time).
 * - INT: integer, -1 (unlimited) .. INT32_MAX
 */
function buildEntitlementsSchema() {
  const shape = {};

  for (const [key, meta] of Object.entries(ENTITLEMENT_REGISTRY)) {
    if (meta.type === "INT") {
      shape[key] = z.number().int().min(-1).max(INT32_MAX).optional();
    } else if (meta.type === "BOOLEAN") {
      shape[key] = z.boolean().optional();
    } else if (meta.type === "STRING_ARRAY") {
      const catalog = ENTITLEMENT_CATALOGS[key];
      if (!catalog) {
        throw new Error(
          `[plans.schema] STRING_ARRAY entitlement '${key}' has no catalog mapping in ENTITLEMENT_CATALOGS`
        );
      }
      shape[key] = z
        .array(z.enum([...catalog]))
        .transform((arr) => [...new Set(arr)].sort())
        .optional();
    } else {
      throw new Error(`[plans.schema] Unsupported entitlement type '${meta.type}' for '${key}'`);
    }
  }

  return z.object(shape).strict();
}

export const entitlementsSchema = buildEntitlementsSchema();

// ── Field primitives ──
const price = z
  .number()
  .min(0)
  .max(10_000_000)
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, {
    message: "Maximum 2 decimal places allowed",
  });

const isoDate = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value));

const planFields = {
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(2000).nullable(),
  visibility: z.enum(PLAN_VISIBILITIES),
  sortOrder: z.number().int().min(0).max(100000),
  badgeText: z.string().trim().min(1).max(40).nullable(),
  monthlyPrice: price,
  quarterlyPrice: price.nullable(),
  annualPrice: price.nullable(),
  originalPrice: price.nullable(),
  offerValidUntil: isoDate.nullable(),
  hasTrial: z.boolean(),
  trialDays: z.number().int().min(1).max(365),
  entitlements: entitlementsSchema,
};

// ── Create ──
// planType + customTenantId are only settable here (immutable afterwards).
export const createPlanSchema = z
  .object({
    name: planFields.name,
    planType: z.enum(PLAN_TYPES).optional(),
    customTenantId: z.string().trim().min(1).nullable().optional(),
    monthlyPrice: planFields.monthlyPrice,
    description: planFields.description.optional(),
    visibility: planFields.visibility.optional(),
    sortOrder: planFields.sortOrder.optional(),
    badgeText: planFields.badgeText.optional(),
    quarterlyPrice: planFields.quarterlyPrice.optional(),
    annualPrice: planFields.annualPrice.optional(),
    originalPrice: planFields.originalPrice.optional(),
    offerValidUntil: planFields.offerValidUntil.optional(),
    hasTrial: planFields.hasTrial.optional(),
    trialDays: planFields.trialDays.optional(),
    entitlements: planFields.entitlements.optional(),
  })
  .strict();

// ── Update (PUT with partial body; planType/customTenantId rejected by .strict()) ──
export const updatePlanSchema = z
  .object(
    Object.fromEntries(
      Object.entries(planFields).map(([key, schema]) => [key, schema.optional()])
    )
  )
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field is required",
  });

export const reorderPlansSchema = z
  .object({
    orderedIds: z.array(z.string().trim().min(1)).min(1).max(500),
  })
  .strict()
  .refine((obj) => new Set(obj.orderedIds).size === obj.orderedIds.length, {
    message: "orderedIds must not contain duplicates",
  });

export const idParamSchema = z.object({
  id: z.string().trim().min(1).max(64),
});

export const listPlansQuerySchema = z.object({
  status: z.enum(PLAN_STATUSES).optional(),
  planType: z.enum(PLAN_TYPES).optional(),
  visibility: z.enum(PLAN_VISIBILITIES).optional(),
  customTenantId: z.string().trim().min(1).optional(),
  search: z.string().trim().max(100).optional(),
});