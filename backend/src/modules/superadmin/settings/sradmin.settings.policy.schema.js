// backend/src/modules/superadmin/settings/sradmin.settings.policy.schema.js (do not remove this comment)
import { z } from "zod";

export const updateSubscriptionPolicySchema = z
  .object({
    // Days of access after a failed renewal. 0 = no grace.
    defaultGraceDays: z.number().int().min(0).max(90).optional(),
    // Days config data is kept after expiry — tenants who NEVER paid.
    trialRetentionDays: z.number().int().min(1).max(365).optional(),
    // Days config data is kept after expiry — tenants who EVER paid.
    paidRetentionDays: z.number().int().min(1).max(3650).optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, {
    message: "At least one field is required",
  });