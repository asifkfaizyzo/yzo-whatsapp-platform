// backend/src/middleware/rateLimiter.js (do not remove this comment)

/**
 * Centralized rate limiter configurations.
 *
 * Uses express-rate-limit (already installed).
 * Apply these to specific routes in the route files.
 *
 * Old config was 100 requests per 15 minutes on auth routes — way too
 * generous. New config is tighter and differentiated by endpoint type.
 */

import rateLimit from "express-rate-limit";

/**
 * Auth endpoints (login, signup, OAuth, forgot/reset password).
 * 20 requests per 15 minutes per IP.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many attempts. Please try again in 15 minutes.",
  },
});

/**
 * Signup endpoint specifically.
 * 5 signups per hour per IP — prevents mass account creation.
 */
export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many signup attempts. Please try again in an hour.",
  },
});

/**
 * OTP verification endpoint.
 * 10 attempts per 15 minutes per IP — prevents brute-forcing OTP codes.
 */
export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many verification attempts. Please try again later.",
  },
});

/**
 * Password reset endpoint.
 * 3 requests per hour per IP — prevents email bombing.
 */
export const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many reset requests. Please try again in an hour.",
  },
});

/**
 * Username check endpoint.
 * 30 requests per minute per IP — allows real-time typing checks
 * but prevents abuse.
 */
export const usernameCheckLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many username checks. Please slow down.",
  },
});

/**
 * General API rate limiter for protected routes.
 * 200 requests per 15 minutes per IP.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});