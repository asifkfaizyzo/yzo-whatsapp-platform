// backend/src/modules/tenant/auth/tenant.auth.controller.js (do not remove this comment)

import { OAuth2Client } from "google-auth-library";
import axios from "axios";
import { success, error } from "../../../utils/response.js";
import {
  signupService,
  loginService,
  logoutService,
  refreshTokenService,
  oauthSignupService,
  oauthLoginService,
  forgotPasswordService,
  resetPasswordService,
  checkUsernameService,
  usernameSuggestionsService,
  updateProfileService,
  verifyEmailOtpService,
  resendOtpService,
  updateOnboardingStepService,
  setPasswordService,
  setUsernameService,
} from "./tenant.auth.service.js";

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
  res.cookie("tenant_refreshToken", token, COOKIE_OPTIONS);
};

const clearAuthCookies = (res) => {
  const clearOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  };
  res.clearCookie("tenant_refreshToken", clearOpts);
  res.clearCookie("onboarding_token", clearOpts);
};

const getIp = (req) =>
  req.ip ||
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
  req.connection?.remoteAddress ||
  null;

const getUserAgent = (req) => req.get("user-agent") || null;

// -- OAuth Verification --
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const verifyGoogleCredential = async (credential) => {
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload.email) {
    throw new Error("Google account does not have an email address");
  }
  return {
    email: payload.email,
    firstName: payload.given_name || "",
    lastName: payload.family_name || "",
    providerId: payload.sub,
  };
};

const verifyFacebookToken = async (accessToken) => {
  const { data } = await axios.get("https://graph.facebook.com/me", {
    params: {
      access_token: accessToken,
      fields: "id,email,first_name,last_name",
    },
  });
  if (!data.email) {
    throw new Error("Facebook account does not have an email address");
  }
  return {
    email: data.email,
    firstName: data.first_name || "",
    lastName: data.last_name || "",
    providerId: data.id,
  };
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
    console.error(`[TenantAuth] ${err.message}`, err.stack);
    return error(res, "Internal server error", 500);
  }
};

// -----------------------------------------------------------
// 1. SIGNUP
// -----------------------------------------------------------
export const signup = handle(async (req, res) => {
  const { email, password, recaptchaToken } = req.body;

  const result = await signupService({
    email,
    password,
    recaptchaToken,
    ip: getIp(req),
    userAgent: getUserAgent(req),
  });

  setRefreshCookie(res, result.refreshToken);

  return success(
    res,
    {
      tenant: result.tenant,
      accessToken: result.accessToken,
      requiresOnboarding: result.requiresOnboarding,
    },
    "Account created successfully",
    201,
  );
});

// -----------------------------------------------------------
// 2. LOGIN
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
    tenant: result.tenant,
    accessToken: result.accessToken,
    requiresUsername: result.requiresUsername,
    requiresOnboarding: result.requiresOnboarding,
  });
});

// -----------------------------------------------------------
// 3. LOGOUT
// -----------------------------------------------------------
export const logout = handle(async (req, res) => {
  const refreshToken =
    req.cookies?.tenant_refreshToken || req.body?.refreshToken;

  const tenantId = req.actorId || null;

  if (refreshToken) {
    await logoutService({ refreshToken, tenantId });
  }

  clearAuthCookies(res);

  return success(res, null, "Logged out successfully");
});

// -----------------------------------------------------------
// 4. REFRESH TOKEN
// -----------------------------------------------------------
export const refresh = handle(async (req, res) => {
  const refreshToken =
    req.cookies?.tenant_refreshToken || req.body?.refreshToken;

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
// 5. GOOGLE SIGNUP
// -----------------------------------------------------------
export const googleSignup = handle(async (req, res) => {
  const { credential, recaptchaToken } = req.body;

  // Verify Google ID token
  const oauthData = await verifyGoogleCredential(credential);

  const result = await oauthSignupService({
    email: oauthData.email,
    firstName: oauthData.firstName,
    lastName: oauthData.lastName,
    provider: "GOOGLE",
    providerId: oauthData.providerId,
    recaptchaToken,
    ip: getIp(req),
    userAgent: getUserAgent(req),
  });

  setRefreshCookie(res, result.refreshToken);

  return success(
    res,
    {
      tenant: result.tenant,
      accessToken: result.accessToken,
      isNew: result.isNew,
      requiresOnboarding: result.requiresOnboarding,
    },
    result.isNew ? "Account created via Google" : "Logged in via Google",
    result.isNew ? 201 : 200,
  );
});

// -----------------------------------------------------------
// 6. FACEBOOK SIGNUP
// -----------------------------------------------------------
export const facebookSignup = handle(async (req, res) => {
  const { accessToken, recaptchaToken } = req.body;

  const oauthData = await verifyFacebookToken(accessToken);

  const result = await oauthSignupService({
    email: oauthData.email,
    firstName: oauthData.firstName,
    lastName: oauthData.lastName,
    provider: "FACEBOOK",
    providerId: oauthData.providerId,
    recaptchaToken,
    ip: getIp(req),
    userAgent: getUserAgent(req),
  });

  setRefreshCookie(res, result.refreshToken);

  return success(
    res,
    {
      tenant: result.tenant,
      accessToken: result.accessToken,
      isNew: result.isNew,
      requiresOnboarding: result.requiresOnboarding,
    },
    result.isNew ? "Account created via Facebook" : "Logged in via Facebook",
    result.isNew ? 201 : 200,
  );
});

// -----------------------------------------------------------
// 7. GOOGLE LOGIN (existing only)
// -----------------------------------------------------------
export const googleLogin = handle(async (req, res) => {
  const { credential } = req.body;

  const oauthData = await verifyGoogleCredential(credential);

  const result = await oauthLoginService({
    email: oauthData.email,
    provider: "GOOGLE",
    providerId: oauthData.providerId,
    ip: getIp(req),
    userAgent: getUserAgent(req),
  });

  setRefreshCookie(res, result.refreshToken);

  return success(res, {
    tenant: result.tenant,
    accessToken: result.accessToken,
    requiresOnboarding: result.requiresOnboarding,
  });
});

// -----------------------------------------------------------
// 8. FACEBOOK LOGIN (existing only)
// -----------------------------------------------------------
export const facebookLogin = handle(async (req, res) => {
  const { accessToken } = req.body;

  const oauthData = await verifyFacebookToken(accessToken);

  const result = await oauthLoginService({
    email: oauthData.email,
    provider: "FACEBOOK",
    providerId: oauthData.providerId,
    ip: getIp(req),
    userAgent: getUserAgent(req),
  });

  setRefreshCookie(res, result.refreshToken);

  return success(res, {
    tenant: result.tenant,
    accessToken: result.accessToken,
    requiresOnboarding: result.requiresOnboarding,
  });
});

// -----------------------------------------------------------
// 9. FORGOT PASSWORD
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
// 10. RESET PASSWORD
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
// 11. CHECK USERNAME
// -----------------------------------------------------------
export const checkUsername = handle(async (req, res) => {
  const { username } = req.query;

  const result = await checkUsernameService({ username });

  return success(res, result);
});

// -----------------------------------------------------------
// 12. USERNAME SUGGESTIONS
// -----------------------------------------------------------
export const usernameSuggestions = handle(async (req, res) => {
  const { firstName, lastName } = req.query;

  const result = await usernameSuggestionsService({ firstName, lastName });

  return success(res, result);
});

// -----------------------------------------------------------
// 13. UPDATE PROFILE (Onboarding Step 2)
// -----------------------------------------------------------
export const updateProfile = handle(async (req, res) => {
  const { firstName, lastName, username } = req.body;
  const tenantId = req.actorId;

  const result = await updateProfileService({
    tenantId,
    firstName,
    lastName,
    username,
  });

  return success(res, result, "Profile updated");
});

// -----------------------------------------------------------
// 14. VERIFY EMAIL OTP (Onboarding Step 3)
// -----------------------------------------------------------
export const verifyEmailOtp = handle(async (req, res) => {
  const { otp } = req.body;
  const tenantId = req.actorId;

  const result = await verifyEmailOtpService({ tenantId, otp });

  return success(
    res,
    result,
    result.alreadyVerified ? "Email already verified" : "Email verified",
  );
});

// -----------------------------------------------------------
// 15. RESEND OTP
// -----------------------------------------------------------
export const resendOtp = handle(async (req, res) => {
  const tenantId = req.actorId;

  const result = await resendOtpService({ tenantId });

  return success(res, null, result.message);
});

// -----------------------------------------------------------
// 16. UPDATE ONBOARDING STEP (Generic, Steps 4�7)
// -----------------------------------------------------------
export const updateOnboardingStep = handle(async (req, res) => {
  const { step } = req.body;
  const tenantId = req.actorId;

  const result = await updateOnboardingStepService({ tenantId, step });

  return success(res, result, `Onboarding step ${step} complete`);
});

// -----------------------------------------------------------
// 17. SET PASSWORD (OAuth users)
// -----------------------------------------------------------
export const setPassword = handle(async (req, res) => {
  const { newPassword } = req.body;
  const tenantId = req.actorId;

  const result = await setPasswordService({ tenantId, newPassword });

  return success(res, null, result.message);
});

// -----------------------------------------------------------
// 18. SET USERNAME (Legacy guard)
// -----------------------------------------------------------
export const setUsername = handle(async (req, res) => {
  const { username } = req.body;
  const tenantId = req.actorId;

  const result = await setUsernameService({ tenantId, username });

  return success(res, result, "Username set successfully");
});