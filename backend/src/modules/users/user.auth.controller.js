// backend/src/modules/users/user.auth.controller.js (do not remove this comment)

import { OAuth2Client } from "google-auth-library";
import { success, error } from "../../utils/response.js";
import {
  loginService,
  logoutService,
  refreshTokenService,
  forgotPasswordService,
  resetPasswordService,
  googleLoginService,
  setUsernameService,
} from "./user.auth.service.js";

// -----------------------------------------------------------
// HELPERS
// -----------------------------------------------------------
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

const setRefreshCookie = (res, token) => {
  res.cookie("user_refreshToken", token, COOKIE_OPTIONS);
};

const clearAuthCookies = (res) => {
  const clearOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  };
  res.clearCookie("user_refreshToken", clearOpts);
};

const getIp = (req) =>
  req.ip ||
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
  req.connection?.remoteAddress ||
  null;

const getUserAgent = (req) => req.get("user-agent") || null;

// -- Google Verification --
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const verifyGoogleCredential = async (credential) => {
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: [
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_ID_MOBILE,
    ].filter(Boolean),
  });
  const payload = ticket.getPayload();
  if (!payload?.email) {
    throw new Error("Google account does not have an email address");
  }
  return { email: payload.email };
};

// -----------------------------------------------------------
// ERROR HANDLER WRAPPER
// -----------------------------------------------------------
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (err.name === "AuthError") {
      return error(res, err.message, err.statusCode);
    }
    console.error(`[UserAuth] ${err.message}`, err.stack);
    return error(res, "Internal server error", 500);
  }
};

// -----------------------------------------------------------
// 1. LOGIN
// -----------------------------------------------------------
export const login = handle(async (req, res) => {
  const { identifier, password, recaptchaToken } = req.body;

  const result = await loginService({
    identifier,
    password,
    recaptchaToken,
    ip: getIp(req),
    userAgent: getUserAgent(req),
  });

  setRefreshCookie(res, result.refreshToken);

  return success(res, {
    user: result.user,
    accessToken: result.accessToken,
    requiresUsername: result.requiresUsername,
  });
});

// -----------------------------------------------------------
// 2. LOGOUT
// -----------------------------------------------------------
export const logout = handle(async (req, res) => {
  const refreshToken =
    req.cookies?.user_refreshToken || req.body?.refreshToken;

  if (refreshToken) {
    await logoutService({
      refreshToken,
      userId: req.actorId || null,
      tenantId: req.actorTenantId || null,
    });
  }

  clearAuthCookies(res);

  return success(res, null, "Logged out successfully");
});

// -----------------------------------------------------------
// 3. REFRESH TOKEN
// -----------------------------------------------------------
export const refresh = handle(async (req, res) => {
  const refreshToken =
    req.cookies?.user_refreshToken || req.body?.refreshToken;

  if (!refreshToken) {
    return error(res, "Refresh token not found", 401);
  }

  const result = await refreshTokenService({ refreshToken });

  setRefreshCookie(res, result.refreshToken);

  return success(res, {
    accessToken: result.accessToken,
  });
});

// -----------------------------------------------------------
// 4. FORGOT PASSWORD
// -----------------------------------------------------------
export const forgotPassword = handle(async (req, res) => {
  const { email } = req.body;

  const result = await forgotPasswordService({
    email,
    ip: getIp(req),
    userAgent: getUserAgent(req),
  });

  return success(res, null, result.message);
});

// -----------------------------------------------------------
// 5. RESET PASSWORD
// -----------------------------------------------------------
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

// -----------------------------------------------------------
// 6. GOOGLE LOGIN
// -----------------------------------------------------------
export const googleLogin = handle(async (req, res) => {
  const { credential } = req.body;

  const oauthData = await verifyGoogleCredential(credential);

  const result = await googleLoginService({
    email: oauthData.email,
    ip: getIp(req),
    userAgent: getUserAgent(req),
  });

  setRefreshCookie(res, result.refreshToken);

  return success(res, {
    user: result.user,
    accessToken: result.accessToken,
  });
});

// -----------------------------------------------------------
// 7. SET USERNAME (Legacy guard)
// -----------------------------------------------------------
export const setUsername = handle(async (req, res) => {
  const { username } = req.body;
  const userId = req.actorId;

  const result = await setUsernameService({ userId, username });

  return success(res, {
    ...result,
    tenant: buildUserPayload(result.tenant),
  }, "Username set successfully");
});