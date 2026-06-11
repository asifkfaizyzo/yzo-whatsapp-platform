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
