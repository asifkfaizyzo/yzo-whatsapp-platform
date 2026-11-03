// backend/src/modules/tenant/conversations/tenant.conversations.schema.js (do not remove this comment)
import { z } from 'zod';

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