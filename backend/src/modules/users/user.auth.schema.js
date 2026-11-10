// backend/src/modules/users/user.auth.schema.js (do not remove this comment)

import { z } from "zod";

const passwordRule = z
  .string({ required_error: "Password is required" })
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[0-9]/, "Must contain at least one number")
  .regex(/[!@#$%^&*]/, "Must contain at least one special character");

const recaptchaRule = z.string().optional();

// ═══════════════════════════════════════════════════════════
// LOGIN (Email or Username)
// ═══════════════════════════════════════════════════════════
export const loginSchema = z.object({
  body: z.object({
    identifier: z
      .string({ required_error: "Email or username is required" })
      .min(1, "Email or username is required"),
    password: z
      .string({ required_error: "Password is required" })
      .min(1, "Password is required"),
    recaptchaToken: recaptchaRule,
  }),
});

// ═══════════════════════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════════════════════
export const logoutSchema = z.object({
  body: z.object({
    refreshToken: z.string().optional(),
  }),
});

// ═══════════════════════════════════════════════════════════
// REFRESH TOKEN
// ═══════════════════════════════════════════════════════════
export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().optional(),
  }),
});

// ═══════════════════════════════════════════════════════════
// FORGOT PASSWORD
// ═══════════════════════════════════════════════════════════
export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: "Email is required" })
      .email("Invalid email address"),
  }),
});

// ═══════════════════════════════════════════════════════════
// RESET PASSWORD
// ═══════════════════════════════════════════════════════════
export const resetPasswordSchema = z.object({
  body: z
    .object({
      token: z.string({ required_error: "Reset token is required" }),
      newPassword: passwordRule,
      confirmPassword: z.string({
        required_error: "Confirm password is required",
      }),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    }),
});

// ═══════════════════════════════════════════════════════════
// GOOGLE LOGIN (existing agents only)
// ═══════════════════════════════════════════════════════════
export const googleLoginSchema = z.object({
  body: z.object({
    credential: z.string({ required_error: "Google ID token is required" }),
  }),
});

// ═══════════════════════════════════════════════════════════
// SET USERNAME (Legacy guard)
// ═══════════════════════════════════════════════════════════
export const setUsernameSchema = z.object({
  body: z.object({
    username: z
      .string({ required_error: "Username is required" })
      .min(4, "Username must be at least 4 characters")
      .regex(
        /^[a-z0-9_]+$/,
        "Username can only contain lowercase letters, numbers, and underscores",
      ),
  }),
});