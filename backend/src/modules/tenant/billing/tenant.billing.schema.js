// backend/src/modules/tenant/billing/tenant.billing.schema.js (do not remove this comment)
import { z } from "zod";

export const cancelSubscriptionSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Cancellation reason is required")
    .max(200, "Reason must not exceed 200 characters"),
  feedback: z.string().trim().max(1000).optional().nullable(),
  wouldReturn: z.boolean().optional().nullable(),
  missingFeature: z.string().trim().max(300).optional().nullable(),
  switchedTo: z.string().trim().max(200).optional().nullable(),
  priceFeedback: z.string().trim().max(200).optional().nullable(),
  rating: z.coerce.number().int().min(1).max(5).optional().nullable(),
});

export const listBillingInvoicesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["paid", "failed", "refunded"]).optional(),
  purchaseType: z.enum(["PLAN", "ADDON", "TOPUP"]).optional(),
});

export const listBillingPaymentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["PENDING", "SUCCESS", "FAILED"]).optional(),
  purchaseType: z.enum(["PLAN", "ADDON", "TOPUP"]).optional(),
});

export const invoiceDownloadParamSchema = z.object({
  invoiceId: z.string().trim().min(1, "invoiceId is required"),
});

export const paymentInvoiceParamSchema = z.object({
  paymentId: z.string().trim().min(1, "paymentId is required"),
});
