import { z } from 'zod';

export const RESERVED_SHORTCUTS = new Set([
  'help',
  'menu',
  'start',
  'stop',
  'list',
  'cancel',
  'optout',
]);

/**
 * Normalizes shortcut to a clean, lowercase, URL/command-safe slug
 * e.g. "/  My Pricing! " -> "my-pricing"
 */
export const normalizeShortcut = (input) => {
  if (!input || typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/^\/+/, '')                   // Strip leading slash(es)
    .toLowerCase()                         // Lowercase
    .replace(/\s+/g, '-')                  // Spaces to hyphens
    .replace(/[^a-z0-9_-]/g, '')           // Strip illegal characters
    .substring(0, 30);                     // Limit to 30 chars
};

export const createQuickReplySchema = z
  .object({
    shortcut: z
      .string({ required_error: 'Shortcut is required' })
      .min(2, 'Shortcut must be at least 2 characters')
      .max(30, 'Shortcut cannot exceed 30 characters')
      .transform(normalizeShortcut)
      .refine((val) => val.length >= 2, {
        message: 'Shortcut must contain at least 2 valid alphanumeric characters',
      })
      .refine((val) => !RESERVED_SHORTCUTS.has(val), {
        message: 'This shortcut is a reserved platform keyword',
      }),
    title: z
      .string({ required_error: 'Title is required' })
      .trim()
      .min(1, 'Title is required')
      .max(100, 'Title cannot exceed 100 characters'),
    content: z
      .string({ required_error: 'Content is required' })
      .trim()
      .min(1, 'Content is required'),
    category: z
      .string()
      .trim()
      .max(50, 'Category cannot exceed 50 characters')
      .optional()
      .default('General'),
    scope: z.enum(['GLOBAL', 'PERSONAL']).default('GLOBAL'),
    hasAttachment: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.hasAttachment) {
      if (data.content.length > 1024) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Content cannot exceed 1,024 characters when an attachment is included (WhatsApp caption limit).',
          path: ['content'],
        });
      }
    } else {
      if (data.content.length > 4096) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Content cannot exceed 4,096 characters.',
          path: ['content'],
        });
      }
    }
  });

export const updateQuickReplySchema = z
  .object({
    shortcut: z
      .string()
      .min(2, 'Shortcut must be at least 2 characters')
      .max(30, 'Shortcut cannot exceed 30 characters')
      .transform(normalizeShortcut)
      .refine((val) => val.length >= 2, {
        message: 'Shortcut must contain at least 2 valid alphanumeric characters',
      })
      .refine((val) => !RESERVED_SHORTCUTS.has(val), {
        message: 'This shortcut is a reserved platform keyword',
      })
      .optional(),
    title: z
      .string()
      .trim()
      .min(1, 'Title cannot be empty')
      .max(100, 'Title cannot exceed 100 characters')
      .optional(),
    content: z
      .string()
      .trim()
      .min(1, 'Content cannot be empty')
      .optional(),
    category: z
      .string()
      .trim()
      .max(50, 'Category cannot exceed 50 characters')
      .optional(),
    scope: z.enum(['GLOBAL', 'PERSONAL']).optional(),
    isActive: z
      .union([z.boolean(), z.string().transform((v) => v === 'true')])
      .optional(),
    removeMedia: z
      .union([z.boolean(), z.string().transform((v) => v === 'true')])
      .optional(),
    hasAttachment: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.hasAttachment && data.content && data.content.length > 1024) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Content cannot exceed 1,024 characters when an attachment is included (WhatsApp caption limit).',
        path: ['content'],
      });
    } else if (data.content && data.content.length > 4096) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Content cannot exceed 4,096 characters.',
        path: ['content'],
      });
    }
  });

export const queryQuickRepliesSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  scope: z.enum(['GLOBAL', 'PERSONAL', 'ALL']).optional().default('ALL'),
  agentId: z.string().optional(),
  sortBy: z.enum(['newest', 'oldest', 'usage', 'shortcut']).optional().default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  includeInactive: z.coerce.boolean().optional().default(false),
});
