// backend/src/modules/superadmin/addons/sradmin.addons.schema.js (do not remove this comment)
import { z } from "zod";

export const ADDON_TYPES = ["RECURRING", "ONE_TIME_TOPUP"];
export const RECURRING_CYCLES = ["MONTHLY", "QUARTERLY", "ANNUAL"];
export const ADDON_BILLING_CYCLES = [...RECURRING_CYCLES, "ONE_TIME"];

const hasMax2Decimals = (v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6;

const priceSchema = z
  .number()
  .positive("Price must be greater than 0")
  .max(10_000_000, "Price is too large")
  .refine(hasMax2Decimals, { message: "Price can have at most 2 decimal places" });

const keySchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(50)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Key must be a lowercase slug (letters, digits, single hyphens)",
  );

const nameSchema = z.string().trim().min(2).max(60);
const descriptionSchema = z.string().trim().max(2000);
const entitlementKeySchema = z.string().trim().min(1).max(60);

// Shape only — semantic validation against the registry happens in the service.
const entitlementValueSchema = z.union([
  z.boolean(),
  z.number(),
  z.array(z.string().trim().min(1)).max(50),
]);

export const createAddOnSchema = z
  .object({
    name: nameSchema,
    key: keySchema,
    description: descriptionSchema.optional(),
    type: z.enum(ADDON_TYPES),
    billingCycle: z.enum(ADDON_BILLING_CYCLES).optional(),
    price: priceSchema,
    entitlementKey: entitlementKeySchema,
    entitlementValue: entitlementValueSchema,
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(100000).optional(),
  })
  .strict();

// key, type, isActive, sortOrder are NOT updatable here (immutable / dedicated endpoints).
export const updateAddOnSchema = z
  .object({
    name: nameSchema.optional(),
    description: descriptionSchema.optional(),
    billingCycle: z.enum(RECURRING_CYCLES).optional(),
    price: priceSchema.optional(),
    entitlementKey: entitlementKeySchema.optional(),
    entitlementValue: entitlementValueSchema.optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field is required",
  });

export const reorderAddOnsSchema = z
  .object({
    orderedIds: z.array(z.string().min(1)).min(1).max(500),
  })
  .strict()
  .refine((o) => new Set(o.orderedIds).size === o.orderedIds.length, {
    message: "orderedIds must not contain duplicates",
  });

export const addOnIdParamSchema = z.object({
  id: z.string().trim().min(1).max(64),
});

export const listAddOnsQuerySchema = z.object({
  type: z.enum(ADDON_TYPES).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  search: z.string().trim().max(100).optional(),
});