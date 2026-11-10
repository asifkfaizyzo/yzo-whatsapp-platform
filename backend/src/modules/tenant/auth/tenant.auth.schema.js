// backend/src/modules/tenant/auth/tenant.auth.schema.js (do not remove this comment)

import { z } from "zod";

// ═══════════════════════════════════════════════════════════
// SHARED RULES
// ═══════════════════════════════════════════════════════════
const passwordRule = z
  .string({ required_error: "Password is required" })
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[0-9]/, "Must contain at least one number")
  .regex(/[!@#$%^&*]/, "Must contain at least one special character");

const recaptchaRule = z.string().optional(); // enforced in production by service

// ═══════════════════════════════════════════════════════════
// SIGNUP
// ═══════════════════════════════════════════════════════════
export const signupSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: "Email is required" })
      .email("Invalid email address"),
    password: passwordRule,
    recaptchaToken: recaptchaRule,
  }),
});

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
// OAUTH SIGNUP (Google / Facebook)
// ═══════════════════════════════════════════════════════════
export const googleSignupSchema = z.object({
  body: z.object({
    credential: z.string({ required_error: "Google ID token is required" }),
    recaptchaToken: recaptchaRule,
  }),
});

export const facebookSignupSchema = z.object({
  body: z.object({
    accessToken: z.string({
      required_error: "Facebook access token is required",
    }),
    recaptchaToken: recaptchaRule,
  }),
});

// ═══════════════════════════════════════════════════════════
// OAUTH LOGIN (Google / Facebook) — existing accounts only
// ═══════════════════════════════════════════════════════════
export const googleLoginSchema = z.object({
  body: z.object({
    credential: z.string({ required_error: "Google ID token is required" }),
  }),
});

export const facebookLoginSchema = z.object({
  body: z.object({
    accessToken: z.string({
      required_error: "Facebook access token is required",
    }),
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
// USERNAME
// ═══════════════════════════════════════════════════════════
export const checkUsernameSchema = z.object({
  query: z.object({
    username: z.string().min(1, "Username query is required"),
  }),
});

export const usernameSuggestionsSchema = z.object({
  query: z.object({
    firstName: z.string().optional().default(""),
    lastName: z.string().optional().default(""),
  }),
});

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

// ═══════════════════════════════════════════════════════════
// ONBOARDING
// ═══════════════════════════════════════════════════════════
export const profileSchema = z.object({
  body: z.object({
    firstName: z
      .string({ required_error: "First name is required" })
      .min(1, "First name is required")
      .max(50, "First name too long"),
    lastName: z
      .string({ required_error: "Last name is required" })
      .min(1, "Last name is required")
      .max(50, "Last name too long"),
    username: z
      .string({ required_error: "Username is required" })
      .min(4, "Username must be at least 4 characters")
      .regex(
        /^[a-z0-9_]+$/,
        "Username can only contain lowercase letters, numbers, and underscores",
      ),
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    otp: z
      .string({ required_error: "OTP is required" })
      .length(6, "OTP must be 6 digits")
      .regex(/^\d{6}$/, "OTP must be numeric"),
  }),
});

export const onboardingStepSchema = z.object({
  body: z.object({
    step: z
      .number({ required_error: "Step number is required" })
      .int("Step must be an integer")
      .min(1, "Invalid step")
      .max(7, "Invalid step"),
  }),
});

export const setPasswordSchema = z.object({
  body: z.object({
    newPassword: passwordRule,
  }),
});