// backend/src/modules/tenant/auth/tenant.auth.schema.js (do not remove this comment)
import { z } from "zod";

export const step1Schema = z.object({
  body: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
  }),
});

export const step2Schema = z.object({
  body: z.object({
    email: z.string().email("Invalid work email address"),
  }),
});

export const step3Schema = z.object({
  body: z.object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(
        /[!@#$%^&*]/,
        "Password must contain at least one special character",
      ),
  }),
});

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

export const step5Schema = z.object({
  body: z.object({
    phone: z.string().min(10, "Phone number must be at least 10 digits"),
    companySize: z.string().min(1, "Company size selection is required"),
    useCase: z.string().optional().or(z.literal("")),
  }),
});
