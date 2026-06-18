import { z } from 'zod';

// Create Tenant
export const createTenantSchema = z.object({
  body: z.object({
    tenantName: z
      .string({ required_error: "Tenant name is required" })
      .min(2, "Name must be at least 2 characters"),
    email: z
      .string({ required_error: "Email is required" })
      .email("Invalid email address"),
    phone: z
      .string()
      .min(10, "Phone must be at least 10 digits")
      .optional()
      .or(z.literal("")),
    address: z
      .string()
      .optional()
      .or(z.literal("")),
    password: z
      .string({ required_error: "Password is required" })
      .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/,       "Password must contain at least one uppercase letter")
        .regex(/[0-9]/,       "Password must contain at least one number")
        .regex(/[!@#$%^&*]/, "Password must contain at least one special character"),
  }),
});

// Update Tenant
const updateTenantSchema = z.object({
  params: z.object({
    id: z.string({ required_error: "Tenant ID is required" }),
  }),
  body: z.object({
    tenantName: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .optional(),
    email: z
      .string()
      .email("Invalid email address")
      .optional(),
    phone: z
      .string()
      .min(10, "Phone must be at least 10 digits")
      .optional()
      .or(z.literal("")),
    address: z
      .string()
      .optional()
      .or(z.literal("")),
    password: z
      .string({ required_error: "Password is required" })
      .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/,       "Password must contain at least one uppercase letter")
        .regex(/[0-9]/,       "Password must contain at least one number")
        .regex(/[!@#$%^&*]/, "Password must contain at least one special character"),
  }),
});

// Delete Tenant
const deleteTenantSchema = z.object({
  params: z.object({
    id: z.string({ required_error: "Tenant ID is required" }),
  }),
});

// Get Tenant by ID
const getTenantSchema = z.object({
  params: z.object({
    id: z.string({ required_error: "Tenant ID is required" }),
  }),
});

// Update Auto-Reopen Configuration Validation
export const updateAutoReopenSchema = z.object({
  body: z.object({
    enabled: z.boolean().optional(),
    reopenWindowHours: z
      .number({ invalid_type_error: "Reopen window hours must be a number" })
      .int()
      .min(1, "Reopen window must be at least 1 hour")
      .max(720, "Reopen window cannot exceed 720 hours (30 days)")
      .optional(),
    maxReopenCount: z
      .number({ invalid_type_error: "Max reopen count must be a number" })
      .int()
      .min(1, "Max reopen count must be at least 1")
      .max(100, "Max reopen count cannot exceed 100")
      .optional(),
    smartFilterEnabled: z.boolean().optional(),
    assignmentStrategy: z
      .enum(['original_agent', 'unassigned_pool'], {
        errorMap: () => ({ message: "Strategy must be 'original_agent' or 'unassigned_pool'" }),
      })
      .optional(),
  }),
});

// Validate Tenant Profile Update Payload
export const updateTenantProfileSchema = z.object({
  body: z.object({
    tenantName: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .optional(),
    email: z
      .string()
      .email("Invalid email address")
      .optional(),
    phone: z
      .string()
      .min(10, "Phone must be at least 10 digits")
      .optional()
      .or(z.literal("")),
    address: z
      .string()
      .optional()
      .or(z.literal("")),
  }),
});
