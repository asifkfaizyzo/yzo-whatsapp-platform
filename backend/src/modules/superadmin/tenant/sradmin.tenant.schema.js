// backend/src/modules/superadmin/tenant/sradmin.tenant.schema.js (do not remove this comment)

import { z } from "zod";

// ── List tenants (query params) ──
export const listTenantsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  status: z
    .enum(["PENDING", "ONBOARDING", "ACTIVE", "APPROVED", "BLOCKED"])
    .optional(),
  isActive: z.coerce.boolean().optional(),
});

// ── Single tenant by ID (params) ──
export const tenantIdParamSchema = z.object({
  id: z.string().cuid("Invalid tenant ID"),
});

// ── Update tenant fields ──
export const updateTenantSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().trim().max(20).optional(),
  businessName: z.string().trim().max(200).optional(),
  address: z.string().trim().max(500).optional(),
  planId: z.string().cuid().optional(),
  isActive: z.boolean().optional(),
  status: z
    .enum(["PENDING", "ONBOARDING", "ACTIVE", "APPROVED", "BLOCKED"])
    .optional(),
  onboardingStep: z.coerce.number().int().min(0).max(10).optional(),
  username: z
    .string()
    .min(4)
    .regex(/^[a-z0-9_]+$/)
    .optional(),
});

// ── Block tenant (requires reason) ──
export const blockTenantSchema = z.object({
  reason: z.string().trim().min(5, "Block reason is required").max(500),
});

// ── Change status (approve / unblock / deactivate / reactivate) ──
export const changeStatusSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

// ── User management (deactivate / reactivate agent) ──
export const userIdParamSchema = z.object({
  id: z.string().cuid("Invalid user ID"),
});