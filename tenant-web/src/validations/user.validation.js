// tenant-web/src/validations/user.validation.js
import { z } from 'zod';
import { emailRule, passwordRule } from '../utils/validationHelpers';

// Creating an Agent User
export const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: emailRule,
  password: passwordRule,
});

// Updating an Agent User
export const updateUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional().or(z.literal('')),
  email: emailRule.optional().or(z.literal('')),
});
