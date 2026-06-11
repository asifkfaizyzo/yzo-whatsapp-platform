import { z } from 'zod';
import { emailRule, passwordRule } from '../utils/validationHelpers';

// Login Validation Schema
export const loginSchema = z.object({
  email: emailRule,
  password: z.string().min(1, 'Password is required'),
});

// Forgot Password Schema
export const forgotPasswordSchema = z.object({
  email: emailRule,
});

// Reset Password Schema
export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Token is required'),
    newPassword: passwordRule,
    confirmPassword: z.string().min(1, 'Confirm password is required'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });