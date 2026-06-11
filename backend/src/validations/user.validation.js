import { z } from 'zod';
import { emailRule, passwordRule } from './auth.validation.js';

// Validate ID route parameters (e.g. /get-user/:id)
export const userIdParamSchema = z.object({
  params: z.object({
    id: z.string().cuid('Invalid User ID format'),
  }),
});

// User registration / creation by Tenant
export const createUserSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'Name is required' }).min(2, 'Name must be at least 2 characters'),
    email: emailRule,
    password: passwordRule,
  }),
});

// User Update
export const updateUserSchema = z.object({
  params: z.object({
    id: z.string().cuid('Invalid User ID format'),
  }),
  body: z.object({
    name: z.string().min(2).optional(),
    email: emailRule.optional(),
    password: passwordRule.optional(),
  }),
});
