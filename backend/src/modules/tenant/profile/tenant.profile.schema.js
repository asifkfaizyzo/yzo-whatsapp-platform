// backend/src/modules/tenant/profile/tenant.profile.schema.js (do not remove this comment)
import { z } from 'zod';

export const updateTenantProfileSchema = z.object({
  body: z.object({
    tenantName: z.string().min(2, "Name must be at least 2 characters").optional().or(z.literal("")).nullable(),
    email: z.string().email("Invalid email address").optional().or(z.literal("")).nullable(),
    phone: z.string().optional().or(z.literal("")).nullable(),
    address: z.string().optional().or(z.literal("")).nullable(),
    websiteUrl: z.string().optional().or(z.literal("")).nullable(),
    industry: z.string().optional().or(z.literal("")).nullable(),
    companySize: z.string().optional().or(z.literal("")).nullable(),
    country: z.string().optional().or(z.literal("")).nullable(),
    logo: z.string().optional().or(z.literal("")).nullable(),
    timezone: z.string().optional().or(z.literal("")).nullable(),
    firstName: z.string().optional().or(z.literal("")).nullable(),
    lastName: z.string().optional().or(z.literal("")).nullable(),
  }),
});