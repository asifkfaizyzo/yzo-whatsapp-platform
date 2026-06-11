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
