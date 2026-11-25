// backend/src/modules/tenant/plans/tenant.plans.schema.js (do not remove this comment)
import { z } from "zod";

export const billingCycleEnum = z.enum(["MONTHLY", "QUARTERLY", "ANNUAL"]);

export const publicPlanParamSchema = z.object({
  id: z.string().trim().min(1, "Plan ID or slug is required"),
});

export const startTrialSchema = z.object({
  planId: z.string().trim().min(1, "planId is required"),
});

export const schedulePlanChangeSchema = z.object({
  planId: z.string().trim().min(1, "planId is required"),
  billingCycle: billingCycleEnum,
});

export const bundledAddOnItemSchema = z.object({
  addOnId: z.string().trim().min(1, "addOnId is required"),
  quantity: z.coerce.number().int().min(1).max(100).default(1),
});

export const createPlanOrderSchema = z.object({
  planId: z.string().trim().min(1, "planId is required"),
  billingCycle: billingCycleEnum.default("MONTHLY"),
  addOns: z.array(bundledAddOnItemSchema).max(20).optional().default([]),
});

export const verifyPlanOrderSchema = z.object({
  razorpay_order_id: z.string().trim().min(1, "razorpay_order_id is required"),
  razorpay_payment_id: z.string().trim().min(1, "razorpay_payment_id is required"),
  razorpay_signature: z.string().trim().min(1, "razorpay_signature is required"),
  planId: z.string().trim().optional(),
  billingCycle: billingCycleEnum.optional(),
  address: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(30).optional(),
});

export const createPlanSubscriptionSchema = z.object({
  planId: z.string().trim().min(1, "planId is required"),
  billingCycle: billingCycleEnum.default("MONTHLY"),
});

export const verifyPlanSubscriptionSchema = z.object({
  razorpay_payment_id: z.string().trim().min(1, "razorpay_payment_id is required"),
  razorpay_subscription_id: z
    .string()
    .trim()
    .min(1, "razorpay_subscription_id is required"),
  razorpay_signature: z.string().trim().min(1, "razorpay_signature is required"),
  planId: z.string().trim().min(1, "planId is required"),
  billingCycle: billingCycleEnum.default("MONTHLY"),
  address: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(30).optional(),
});