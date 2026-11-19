// backend/src/modules/tenant/addons/tenant.addons.schema.js (do not remove this comment)
import { z } from "zod";

export const tenantAddOnIdParamSchema = z.object({
  tenantAddOnId: z.string().trim().min(1, "tenantAddOnId is required"),
});

export const createAddOnOrderSchema = z.object({
  addOnId: z.string().trim().min(1, "addOnId is required"),
  quantity: z.coerce.number().int().min(1).max(100).default(1),
});

export const verifyAddOnOrderSchema = z.object({
  razorpay_order_id: z.string().trim().min(1, "razorpay_order_id is required"),
  razorpay_payment_id: z
    .string()
    .trim()
    .min(1, "razorpay_payment_id is required"),
  razorpay_signature: z
    .string()
    .trim()
    .min(1, "razorpay_signature is required"),
});

export const createAddOnSubscriptionSchema = z.object({
  addOnId: z.string().trim().min(1, "addOnId is required"),
  quantity: z.coerce.number().int().min(1).max(100).default(1),
});

export const verifyAddOnSubscriptionSchema = z.object({
  razorpay_payment_id: z
    .string()
    .trim()
    .min(1, "razorpay_payment_id is required"),
  razorpay_subscription_id: z
    .string()
    .trim()
    .min(1, "razorpay_subscription_id is required"),
  razorpay_signature: z
    .string()
    .trim()
    .min(1, "razorpay_signature is required"),
  addOnId: z.string().trim().min(1, "addOnId is required"),
  quantity: z.coerce.number().int().min(1).max(100).default(1),
});

export const cancelTenantAddOnSchema = z.object({
  reason: z.string().trim().max(250).optional(),
});
