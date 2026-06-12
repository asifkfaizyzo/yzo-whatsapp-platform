import { z } from 'zod';

// At the top of src/validations/auth.validation.js (or export them):
export const emailRule = z
  .string({ required_error: 'Email is required' })
  .email('Invalid email address');

export const passwordRule = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[!@#$%^&*]/, 'Password must contain at least one special character');

// =========== Login Schema ===========
export const loginSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email address'),
    password: z
      .string({ required_error: 'Password is required' })
      .min(1, 'Password is required'),
  }),
});

// =========== Forgot Password Schema ===========
export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email address'),
  }),
});

// =========== Reset Password Schema ===========
export const resetPasswordSchema = z.object({
  body: z.object({
    token: z
      .string({ required_error: 'Token is required' }),
    newPassword: z
      .string({ required_error: 'Password is required' })
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/,       'Must contain at least one uppercase letter')
      .regex(/[0-9]/,       'Must contain at least one number')
      .regex(/[!@#$%^&*]/, 'Must contain at least one special character'),
    confirmPassword: z
      .string({ required_error: 'Confirm password is required' }),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path:    ['confirmPassword'],
  }),
});

// =========== Refresh Token Schema ===========
export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().optional(),
  }),
  cookies: z.object({
    refreshToken: z.string().optional(),
  }).optional(),
}).refine((data) => data.body?.refreshToken || data.cookies?.refreshToken, {
  message: 'Refresh token is required in body or cookies',
  path: ['refreshToken'],
});

// =========== Logout Schema ===========
export const logoutSchema = z.object({
  body: z.object({
    refreshToken: z.string().optional(),
  }),
  cookies: z.object({
    refreshToken: z.string().optional(),
  }).optional(),
}).refine((data) => data.body?.refreshToken || data.cookies?.refreshToken, {
  message: 'Refresh token is required in body or cookies',
  path: ['refreshToken'],
});