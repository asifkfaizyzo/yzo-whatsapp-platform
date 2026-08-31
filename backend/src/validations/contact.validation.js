// src/validations/contact.validation.js
import { z } from 'zod';

// ID parameter validation
export const contactIdParamSchema = z.object({
  params: z.object({
    id: z.string().cuid('Invalid Contact ID format'),
  }),
});

// Contact Creation
export const createContactSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'Contact name is required' }).min(2, 'Name must be at least 2 characters'),
    phone: z.string({ required_error: 'Phone number is required' }).min(10, 'Phone must be at least 10 digits'),
    email: z.string().email('Invalid email address').optional().nullable(),
    company: z.string().optional().nullable(),
    tags: z.array(z.string()).optional(),
    countryCode: z.string().optional(),
    whatsappId: z.string().optional().nullable(),
  }),
});

// Contact Update
export const updateContactSchema = z.object({
  params: z.object({
    id: z.string().cuid('Invalid Contact ID format'),
  }),
  body: z.object({
    name: z.string().min(2).optional(),
    phone: z.string().min(10).optional(),
    email: z.string().email().optional().nullable(),
    company: z.string().optional().nullable(),
    tags: z.array(z.string()).optional(),
    countryCode: z.string().optional(),
    whatsappId: z.string().optional().nullable(),
  }),
});


// Bulk Delete Contacts Validation
// ===================== BULK DELETE (selected | filter | all) =====================
export const bulkDeleteContactsSchema = z.object({
  body: z
    .object({
      mode: z.enum(['selected', 'filter', 'all'], {
        required_error: "mode is required: 'selected' | 'filter' | 'all'",
      }),
      contactIds: z.array(z.string()).optional(),
      confirmation: z.string().optional(),
      filters: z
        .object({
          startDate: z.string().optional(),       
          endDate: z.string().optional(),         
          tagId: z.string().optional(),
          assignedFilter: z.enum(['all', 'assigned', 'unassigned']).optional(),
          search: z.string().optional(),
          invalidOnly: z.boolean().optional(),
        })
        .optional(),
    })
    .superRefine((data, ctx) => {
      if (data.mode === 'selected' && (!data.contactIds || data.contactIds.length === 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "contactIds required for 'selected' mode", path: ['contactIds'] });
      }
      if (data.mode === 'all' && data.confirmation !== 'DELETE ALL') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "confirmation must be exactly 'DELETE ALL'", path: ['confirmation'] });
      }
    }),
});