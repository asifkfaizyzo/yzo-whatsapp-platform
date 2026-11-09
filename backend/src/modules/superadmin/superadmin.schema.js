// backend/src/validations/superadmin.schema.js (do not remove this comment)
import { z } from "zod";
import { emailRule, passwordRule } from "../auth/auth.schema.js";

// Validate general parameter IDs (e.g. tenantId, userId)
export const superAdminIdParamSchema = z.object({
  params: z.object({
    id: z.string().cuid("Invalid ID format"),
  }),
});

// Creation of SuperAdmin
export const createSuperAdminSchema = z.object({
  body: z.object({
    name: z.string({ required_error: "Name is required" }).min(2),
    email: emailRule,
    password: passwordRule,
  }),
});

export const registerTenantSchema = z.object({
  body: z.object({
    tenantName: z.string().trim().min(2, "Tenant name must be at least 2 characters"),
    firstName: z.string().trim().min(1, "First name is required"),
    lastName: z.string().trim().min(1, "Last name is required"),
    email: emailRule,
    password: passwordRule,
    phone: z.string().min(10, "Phone must be at least 10 digits"),
    address: z.string().optional().or(z.literal("")),
    websiteUrl: z
      .string()
      .optional()
      .or(z.literal(""))
      .refine((value) => {
        if (!value) return true;
        try {
          new URL(value.startsWith("http") ? value : `https://${value}`);
          return true;
        } catch {
          return false;
        }
      }, "Please enter a valid website URL"),
    industry: z.string().optional().or(z.literal("")),
    companySize: z.string().min(1, "Company size is required"),
    country: z.string().optional().or(z.literal("")),
    useCase: z.string().optional().or(z.literal("")),
    timezone: z.string().optional().or(z.literal("")),
  }),
});

// Tenant updates by SuperAdmin
export const updateTenantByAdminSchema = z.object({
  params: z.object({
    id: z.string().cuid("Invalid Tenant ID format"),
  }),
  body: z.object({
    tenantName: z.string().min(2).optional(),
    email: emailRule.optional(),
    phone: z.string().min(10).optional().or(z.literal("")),
    address: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    websiteUrl: z.string().optional().or(z.literal("")),
    industry: z.string().optional().or(z.literal("")),
    companySize: z.string().optional().or(z.literal("")),
    country: z.string().optional().or(z.literal("")),
    useCase: z.string().optional().or(z.literal("")),
    timezone: z.string().optional().or(z.literal("")),
    password: passwordRule.optional(),
  }),
});
