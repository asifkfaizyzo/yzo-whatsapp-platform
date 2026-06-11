// tenant-web/src/utils/validationHelpers.js
import { z } from 'zod';

export const emailRule = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email address');

export const passwordRule = z
  .string()
  .min(1, 'Password is required')
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Must contain at least one number')
  .regex(/[!@#$%^&*]/, 'Must contain at least one special character');