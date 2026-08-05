import { z } from "zod";

export const createPlanSchema = z.object({
  name: z
    .string()
    .min(1, "Plan name is required")
    .max(50, "Plan name too long"),

  description: z.string().optional(),

  monthlyPrice: z
    .number({ invalid_type_error: "Monthly price must be a number" })
    .positive("Monthly price must be positive"),

  annualPrice: z
    .number({ invalid_type_error: "Annual price must be a number" })
    .positive()
    .optional()
    .nullable(),

  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  isPopular: z.boolean().optional().default(false),

  maxAgents: z
    .number({ invalid_type_error: "Max agents must be a number" })
    .int()
    .positive("Must have at least 1 agent"),

  maxBroadcasts: z.number().int().positive().optional().nullable(),
  maxAutomations: z.number().int().positive().optional().nullable(),
  maxCampaigns: z.number().int().positive().optional().nullable(),
  maxApiCalls: z.number().int().positive().optional().nullable(),
  maxAiCredits: z.number().int().positive().optional().nullable(),

  featureIds: z
    .array(z.string())
    .min(1, "Select at least one feature"),

  integrations: z
    .array(z.string())
    .default([]),
});

export const updatePlanSchema = createPlanSchema.partial().extend({
  featureIds: z.array(z.string()).optional(),
  integrations: z.array(z.string()).optional(),
});

export const createFeatureSchema = z.object({
  name: z
    .string()
    .min(1, "Feature name is required")
    .max(100, "Feature name too long"),
});