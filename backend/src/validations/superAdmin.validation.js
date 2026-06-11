import { z } from 'zod';
import { emailRule, passwordRule } from './auth.validation.js';

// Validate general parameter IDs (e.g. tenantId, userId)
export const superAdminIdParamSchema = z.object({
  params: z.object({
    id: z.string().cuid('Invalid ID format'),
  }),
});

// Creation of SuperAdmin
export const createSuperAdminSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'Name is required' }).min(2),
    email: emailRule,
    password: passwordRule,
  }),
});

// Tenant updates by SuperAdmin
export const updateTenantByAdminSchema = z.object({
  params: z.object({
    id: z.string().cuid('Invalid Tenant ID format'),
  }),
  body: z.object({
    tenantName: z.string().min(2).optional(),
    email: emailRule.optional(),
    phone: z.string().min(10).optional(),
    address: z.string().optional(),
    password: passwordRule.optional(),
  }),
});
