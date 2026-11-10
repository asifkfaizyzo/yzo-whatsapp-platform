// backend/src/modules/superadmin/auth/sradmin.auth.controller.new.js (do not remove this comment)

import { success, error } from "../../utils/response.js";
import {
  createSRAdminService,
  loginService,
  logoutService,
  refreshTokenService,
  forgotPasswordService,
  resetPasswordService,
} from "./sradmin.auth.service.new.js";

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

const setRefreshCookie = (res, token) => {
  res.cookie("admin_refreshToken", token, COOKIE_OPTIONS);
};

const clearAuthCookies = (res) => {
  const clearOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  };
  res.clearCookie("admin_refreshToken", clearOpts);
};

const getIp = (req) =>
  req.ip ||
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
  req.connection?.remoteAddress ||
  null;

const getUserAgent = (req) => req.get("user-agent") || null;

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (err.name === "AuthError") {
      return error(res, err.message, err.statusCode);
    }
    console.error(`[SRAdminAuth] ${err.message}`, err.stack);
    return error(res, "Internal server error", 500);
  }
};

// ═══════════════════════════════════════════════════════════
// 1. CREATE SRADMIN
// ═══════════════════════════════════════════════════════════
export const createSRAdmin = handle(async (req, res) => {
  const { name, email, password } = req.body;
  const createdBy = req.actorId;

  const result = await createSRAdminService({
    name,
    email,
    password,
    createdBy,
  });

  return success(res, result, "SRAdmin created successfully", 201);
});

// ═══════════════════════════════════════════════════════════
// 2. LOGIN
// ═══════════════════════════════════════════════════════════
export const login = handle(async (req, res) => {
  const { identifier, password } = req.body;

  const result = await loginService({
    identifier,
    password,
    ip: getIp(req),
    userAgent: getUserAgent(req),
  });

  setRefreshCookie(res, result.refreshToken);

  return success(res, {
    srAdmin: result.srAdmin,
    accessToken: result.accessToken,
  });
});

// ═══════════════════════════════════════════════════════════
// 3. LOGOUT
// ═══════════════════════════════════════════════════════════
export const logout = handle(async (req, res) => {
  const refreshToken =
    req.cookies?.admin_refreshToken || req.body?.refreshToken;

  if (refreshToken) {
    await logoutService({
      refreshToken,
      adminId: req.actorId || null,
    });
  }

  clearAuthCookies(res);

  return success(res, null, "Logged out successfully");
});

// ═══════════════════════════════════════════════════════════
// 4. REFRESH TOKEN
// ═══════════════════════════════════════════════════════════
export const refresh = handle(async (req, res) => {
  const refreshToken =
    req.cookies?.admin_refreshToken || req.body?.refreshToken;

  if (!refreshToken) {
    return error(res, "Refresh token not found", 401);
  }

  const result = await refreshTokenService({ refreshToken });

  setRefreshCookie(res, result.refreshToken);

  return success(res, {
    accessToken: result.accessToken,
  });
});

// ═══════════════════════════════════════════════════════════
// 5. FORGOT PASSWORD
// ═══════════════════════════════════════════════════════════
export const forgotPassword = handle(async (req, res) => {
  const { email } = req.body;

  const result = await forgotPasswordService({
    email,
    ip: getIp(req),
    userAgent: getUserAgent(req),
  });

  return success(res, null, result.message);
});

// ═══════════════════════════════════════════════════════════
// 6. RESET PASSWORD
// ═══════════════════════════════════════════════════════════
export const resetPassword = handle(async (req, res) => {
  const { token, newPassword } = req.body;

  const result = await resetPasswordService({
    token,
    newPassword,
    ip: getIp(req),
    userAgent: getUserAgent(req),
  });

  return success(res, null, result.message);
});