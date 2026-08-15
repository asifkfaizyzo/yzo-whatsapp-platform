import { z } from 'zod';

// Step 1: First name + Last name
export const step1Schema = z.object({
  body: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
  }),
});

// Step 2: Email
export const step2Schema = z.object({
  body: z.object({
    email: z.string().email("Invalid work email address"),
  }),
});

// Step 3: Password
export const step3Schema = z.object({
  body: z.object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(/[!@#$%^&*]/, "Password must contain at least one special character"),
  }),
});

// Step 4: Company name + Website
export const step4Schema = z.object({
  body: z.object({
    tenantName: z.string().min(2, "Company name must be at least 2 characters"),
    websiteUrl: z
      .string()
      .optional()
      .or(z.literal(""))
      .refine((val) => {
        if (!val) return true;
        try {
          const urlStr = val.startsWith("http") ? val : `https://${val}`;
          new URL(urlStr);
          return true;
        } catch {
          return false;
        }
      }, "Please enter a valid website URL"),
  }),
});

// Step 5: Business phone + Team size + Use case
export const step5Schema = z.object({
  body: z.object({
    phone: z.string().min(10, "Phone number must be at least 10 digits"),
    companySize: z.string().min(1, "Company size selection is required"),
    useCase: z.string().optional().or(z.literal("")),
  }),
});

// Update Tenant (Used by superadmin)
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
  // ✅ REPLACE WITH ENTIRE BLOCK
body: z.object({
  tenantName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .optional()
    .or(z.literal(""))
    .nullable(),
  email: z
    .string()
    .email("Invalid email address")
    .optional()
    .or(z.literal(""))
    .nullable(),
  phone: z
    .string()
    .optional()
    .or(z.literal(""))
    .nullable(),
  address: z
    .string()
    .optional()
    .or(z.literal(""))
    .nullable(),
  websiteUrl: z
    .string()
    .optional()
    .or(z.literal(""))
    .nullable(),
  industry: z
    .string()
    .optional()
    .or(z.literal(""))
    .nullable(),
  companySize: z
    .string()
    .optional()
    .or(z.literal(""))
    .nullable(),
  country: z
    .string()
    .optional()
    .or(z.literal(""))
    .nullable(),
  logo: z
    .string()
    .optional()
    .or(z.literal(""))
    .nullable(),
  timezone: z
    .string()
    .optional()
    .or(z.literal(""))
    .nullable(),
  firstName: z
    .string()
    .optional()
    .or(z.literal(""))
    .nullable(),
  lastName: z
    .string()
    .optional()
    .or(z.literal(""))
    .nullable(),
}),
});

export const setupWhatsAppSchema = z.object({
  body: z.object({
    phoneNumberId: z.string({ required_error: "phoneNumberId is required" }).min(1),
    wabaId: z.string({ required_error: "wabaId is required" }).min(1),
  }),
});
