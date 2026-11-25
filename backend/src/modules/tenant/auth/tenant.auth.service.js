// backend/src/modules/tenant/auth/tenant.auth.service.js (do not remove this comment)

import prisma from "../../../config/prisma.js";
import { hashPassword, comparePassword } from "../../../utils/hash.js";
import { createTokenPair } from "../../../utils/tokens.js";
import {
  generateOTP,
  hashOTP,
  verifyOTP,
  getOTPExpiry,
} from "../../../utils/otp.js";
import {
  generateResetToken,
  hashResetToken,
} from "../../../utils/resetToken.js";
import { verifyRecaptcha } from "../../../utils/recaptcha.js";
import {
  validateUsernameFormat,
  isUsernameAvailable,
  generateSuggestions,
  parseEmailForName,            
} from "../../../utils/username.js";
import {
  saveRefreshToken,
  deleteRefreshToken,
  findRefreshToken,
} from "../../auth/refreshToken.service.js";
import { verifyRefreshToken } from "../../auth/jwt.service.js";
import { sendPasswordResetEmail, sendVerificationOtpEmail } from "../../email/index.js";
import { createAuditLog } from "../../audit/audit.service.js";
import { createSuperAdminNotification } from "../../superadmin-notifications/superadminNotification.service.js";
import { emitToSuperAdmin } from "../../../lib/socket.js";
import { getSetupStatus } from "./tenant.setup.service.js";

// -----------------------------------------------------------
// CUSTOM ERROR
// -----------------------------------------------------------
class AuthError extends Error {
  constructor(message, statusCode = 400, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = "AuthError";
  }
}

// -----------------------------------------------------------
// ENV GUARD
// -----------------------------------------------------------
const isDev = process.env.NODE_ENV !== "production";

// -----------------------------------------------------------
// CONSTANTS & HELPERS
// -----------------------------------------------------------
const SAFE_TENANT_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  username: true,
  tenantName: true,
  status: true,
  isActive: true,
  onboardingStep: true,
  onboardingCompleted: true,
  isEmailVerified: true,
  authProvider: true,
  createdAt: true,
};

// Include V2 subscription fields alongside tenant queries
const SUBSCRIPTION_INCLUDE = {
  subscription: {
    select: {
      planId: true,
      subscriptionStatus: true,
      billingCycle: true,
      isFreeTrial: true,
      isComplimentary: true,
      planPeriodStart: true,
      planPeriodEnd: true,
      gracePeriodEnd: true,
      cancelAtPeriodEnd: true,
      pendingPlanId: true,
      pendingBillingCycle: true,
      dataDeletionDate: true,
      plan: {
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
        },
      },
    },
  },
};

const sanitizeTenant = (tenant) => {
  if (!tenant) return null;
  const safe = {};
  for (const key of Object.keys(SAFE_TENANT_SELECT)) {
    if (key in tenant) safe[key] = tenant[key];
  }
  if (tenant.subscription) {
    safe.planId = tenant.subscription.planId || null;
    safe.planName = tenant.subscription.plan?.name || null;
    safe.planSlug = tenant.subscription.plan?.slug || null;
    safe.subscriptionStatus = tenant.subscription.subscriptionStatus || null;
    safe.billingCycle = tenant.subscription.billingCycle || null;
    safe.isFreeTrial = Boolean(tenant.subscription.isFreeTrial);
    safe.isComplimentary = Boolean(tenant.subscription.isComplimentary);
    safe.planPeriodStart = tenant.subscription.planPeriodStart || null;
    safe.planPeriodEnd = tenant.subscription.planPeriodEnd || null;
    safe.gracePeriodEnd = tenant.subscription.gracePeriodEnd || null;
    safe.cancelAtPeriodEnd = Boolean(tenant.subscription.cancelAtPeriodEnd);
    safe.pendingPlanId = tenant.subscription.pendingPlanId || null;
    safe.pendingBillingCycle = tenant.subscription.pendingBillingCycle || null;
    safe.dataDeletionDate = tenant.subscription.dataDeletionDate || null;
    safe.subscription = tenant.subscription;
  }
  safe.setup = getSetupStatus(tenant);
  return safe;
};

const buildTokenPayload = (tenant) => ({
  id: tenant.id,
  email: tenant.email,
  type: "TENANT",
});

const issueTokens = async (tenant) => {
  const payload = buildTokenPayload(tenant);
  const { accessToken, refreshToken } = await createTokenPair(payload);
  await saveRefreshToken({ token: refreshToken, tenantId: tenant.id });
  return { accessToken, refreshToken };
};

const checkEmailAcrossActors = async (email) => {
  const [tenant, user, superAdmin] = await Promise.all([
    prisma.tenant.findFirst({
      where: { email, deletedAt: null },
      select: { id: true, status: true },
    }),
    prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: { id: true },
    }),
    prisma.superAdmin.findFirst({
      where: { email },
      select: { id: true },
    }),
  ]);
  return { tenant, user, superAdmin };
};

const logAuth = (fields) =>
  createAuditLog({
    module: "AUTH",
    actorName: fields.actorName || fields.actorEmail || "unknown",
    ...fields,
  }).catch(() => {});

const notifySRAdmin = async (type, title, message, metadata) => {
  try {
    await createSuperAdminNotification({ type, title, message, metadata });
    emitToSuperAdmin("new_notification", { type, title, message });
  } catch {
    // Non-blocking
  }
};

// -----------------------------------------------------------
// 1. SIGNUP (Email + Password)
// -----------------------------------------------------------
export const signupService = async ({
  email,
  password,
  recaptchaToken,
  ip,
  userAgent,
}) => {
  // -- reCAPTCHA --
  const captchaOk = await verifyRecaptcha(recaptchaToken, "signup");
  if (!captchaOk) throw new AuthError("reCAPTCHA verification failed", 403);

  // -- Normalize --
  const normalizedEmail = email.toLowerCase().trim();

  // -- Check existence across all actor tables --
  const { tenant, user, superAdmin } =
    await checkEmailAcrossActors(normalizedEmail);

  if (tenant) {
    const fullTenant = await prisma.tenant.findFirst({
      where: { id: tenant.id, deletedAt: null },
      select: {
        ...SAFE_TENANT_SELECT,
        password: true,
        onboardingCompleted: true,
        ...SUBSCRIPTION_INCLUDE,
      },
    });

    // ── Refuse email signup on OAuth-only (no-password) accounts ──
    if (fullTenant && !fullTenant.password) {
      throw new AuthError(
        "This email is registered with a social login. Please sign in with your social provider.",
        409,
        "OAUTH_ACCOUNT_EXISTS",
      );
    }

    // ── Auto-resume incomplete onboarding ──
    if (
      fullTenant &&
      fullTenant.status === "ONBOARDING" &&
      !fullTenant.onboardingCompleted
    ) {
      // Password is guaranteed to exist here (no-password rejected above)
      const match = await comparePassword(password, fullTenant.password);
      if (!match) {
        throw new AuthError("Invalid credentials", 401);
      }

      const tokens = await issueTokens(fullTenant);

      logAuth({
        actorId: fullTenant.id,
        actorType: "TENANT",
        actorEmail: normalizedEmail,
        action: "LOGIN_SUCCESS",
        description: "Tenant resumed onboarding via signup",
        ipAddress: ip,
        userAgent,
        tenantId: fullTenant.id,
      });

      return {
        tenant: sanitizeTenant(fullTenant),
        ...tokens,
        requiresOnboarding: true,
        isResuming: true,
        onboardingStep: fullTenant.onboardingStep,
      };
    }

    throw new AuthError(
      "An account with this email already exists. Please log in.",
      409,
    );
  }
  if (user) {
    throw new AuthError(
      "This email is registered as an agent account. Please use a different email or contact your admin.",
      409,
    );
  }
  if (superAdmin) {
    throw new AuthError(
      "An account with this email already exists. Please log in.",
      409,
    );
  }

  // -- Hash password --
  const hashedPassword = await hashPassword(password);

  // -- Create tenant --
  const newTenant = await prisma.tenant.create({
    data: {
      email: normalizedEmail,
      password: hashedPassword,
      status: "ONBOARDING",
      onboardingStep: 1,
      isActive: true,
      isEmailVerified: false,
    },
    select: { ...SAFE_TENANT_SELECT, password: true, ...SUBSCRIPTION_INCLUDE },
  });

  // -- Generate and send first verification OTP --
  const plainOtp = generateOTP();
  const hashedOtp = hashOTP(plainOtp);
  const otpExpiry = getOTPExpiry();

  await prisma.tenant.update({
    where: { id: newTenant.id },
    data: { otpHash: hashedOtp, otpExpiresAt: otpExpiry, otpAttempts: 0 },
  });

  try {
    await sendVerificationOtpEmail(normalizedEmail, plainOtp);
  } catch (err) {
    if (isDev) {
      console.error("[signup] OTP email send failed:", err.message);
      console.log(`[DEV] 🔑 Signup OTP for ${normalizedEmail}: ${plainOtp}`);
    } else {
      console.error("[signup] OTP email send failed:", err.message);
    }
    // Don't throw — account is created, user can request a resend
  }

  // -- Issue tokens --
  const tokens = await issueTokens(newTenant);

  // -- Audit + Notify (non-blocking) --
  logAuth({
    actorId: newTenant.id,
    actorType: "TENANT",
    actorName: normalizedEmail,
    actorEmail: normalizedEmail,
    action: "SIGNUP",
    description: "New tenant account created via email signup",
    ipAddress: ip,
    userAgent,
    tenantId: newTenant.id,
  });

  notifySRAdmin(
    "tenant_registered",
    "New Tenant Signup",
    `${normalizedEmail} created a new account`,
    { tenantId: newTenant.id, email: normalizedEmail },
  );

  return {
    tenant: sanitizeTenant(newTenant),
    ...tokens,
    requiresOnboarding: true,
  };
};

// -----------------------------------------------------------
// 2. LOGIN (Email or Username + Password)
// -----------------------------------------------------------
export const loginService = async ({
  identifier,
  email,
  password,
  recaptchaToken,
  ip,
  userAgent,
}) => {
  // -- reCAPTCHA --
  const captchaOk = await verifyRecaptcha(recaptchaToken, "login");
  if (!captchaOk) throw new AuthError("reCAPTCHA verification failed", 403);

  const loginId = identifier || email;
  if (!loginId) throw new AuthError("Email or username is required", 400);

  // -- Detect identifier type --
  const trimmed = loginId.trim();
  const isEmail = trimmed.includes("@");

  const where = isEmail
    ? { email: trimmed.toLowerCase(), deletedAt: null }
    : { username: { equals: trimmed, mode: "insensitive" }, deletedAt: null };

  const tenant = await prisma.tenant.findFirst({
    where,
    select: {
      ...SAFE_TENANT_SELECT,
      password: true,
      ...SUBSCRIPTION_INCLUDE,
    },
  });

  // -- Not found --
  if (!tenant) {
    throw new AuthError("Invalid credentials", 401);
  }

  // -- OAuth-only account (no password set) --
  if (!tenant.password) {
    const provider = tenant.authProvider || "social";
    throw new AuthError(
      `This account uses ${provider.toLowerCase()} login. Please sign in with ${provider}.`,
      400,
    );
  }

  // -- Verify password --
  const passwordMatch = await comparePassword(password, tenant.password);
  if (!passwordMatch) {
    logAuth({
      actorId: tenant.id,
      actorType: "TENANT",
      actorName: tenant.email,
      actorEmail: tenant.email,
      action: "LOGIN_FAILED",
      description: "Invalid password attempt",
      ipAddress: ip,
      userAgent,
      tenantId: tenant.id,
    });
    throw new AuthError("Invalid credentials", 401);
  }

  // -- Status checks --
  if (tenant.status === "BLOCKED") {
    throw new AuthError(
      "Your account has been suspended. Please contact support.",
      403,
    );
  }
  if (tenant.status === "PENDING") {
    throw new AuthError(
      "Your account is pending approval. You will be notified once approved.",
      403,
    );
  }
  if (!tenant.isActive) {
    throw new AuthError(
      "Your account has been deactivated. Please contact support.",
      403,
    );
  }

  // -- Issue tokens --
  const tokens = await issueTokens(tenant);

  // -- Legacy guard: NULL username --
  const requiresUsername = !tenant.username;

  // -- Onboarding gate --
  const requiresOnboarding =
    tenant.status === "ONBOARDING" || tenant.status === "APPROVED";

  // -- Audit --
  logAuth({
    actorId: tenant.id,
    actorType: "TENANT",
    actorName:
      `${tenant.firstName || ""} ${tenant.lastName || ""}`.trim() ||
      tenant.email,
    actorEmail: tenant.email,
    action: "LOGIN_SUCCESS",
    description: `Tenant logged in via ${isEmail ? "email" : "username"}`,
    ipAddress: ip,
    userAgent,
    tenantId: tenant.id,
  });

  return {
    tenant: sanitizeTenant(tenant),
    ...tokens,
    requiresUsername,
    requiresOnboarding,
  };
};

// -----------------------------------------------------------
// 3. LOGOUT
// -----------------------------------------------------------
export const logoutService = async ({ refreshToken, tenantId }) => {
  try {
    await deleteRefreshToken(refreshToken);
  } catch {
    // Token already deleted or invalid � still return success
  }

  logAuth({
    actorId: tenantId,
    actorType: "TENANT",
    actorEmail: "unknown",
    action: "LOGOUT",
    description: "Tenant logged out",
    tenantId,
  });

  return { message: "Logged out successfully" };
};

// -----------------------------------------------------------
// 4. REFRESH TOKEN
// -----------------------------------------------------------
export const refreshTokenService = async ({ refreshToken }) => {
  // -- Find in DB --
  const tokenRecord = await findRefreshToken(refreshToken, "TENANT");
  if (!tokenRecord || tokenRecord.isRevoked) {
    throw new AuthError("Invalid or expired refresh token", 401);
  }

  // -- Verify JWT signature + expiry --
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    // JWT expired or tampered � clean up DB
    await deleteRefreshToken(refreshToken).catch(() => {});
    throw new AuthError("Invalid or expired refresh token", 401);
  }

  // -- Verify tenant still exists and is active --
  const tenant = await prisma.tenant.findFirst({
    where: { id: decoded.id, deletedAt: null },
    select: { ...SAFE_TENANT_SELECT, ...SUBSCRIPTION_INCLUDE },
  });

  if (!tenant) {
    await deleteRefreshToken(refreshToken).catch(() => {});
    throw new AuthError("Tenant account not found", 401);
  }

  if (tenant.status === "BLOCKED" || !tenant.isActive) {
    await deleteRefreshToken(refreshToken).catch(() => {});
    throw new AuthError("Account is no longer active", 403);
  }

  // -- Rotate tokens --
  await deleteRefreshToken(refreshToken).catch(() => {});
  const tokens = await issueTokens(tenant);

  return { ...tokens, tenant: sanitizeTenant(tenant) };
};

// -----------------------------------------------------------
// 5. OAUTH SIGNUP (Google / Facebook)
//    Creates account if new, auto-logins if existing
// -----------------------------------------------------------
export const oauthSignupService = async ({
  email,
  firstName,
  lastName,
  provider, // "GOOGLE" | "FACEBOOK"
  providerId,
  recaptchaToken,
  ip,
  userAgent,
}) => {
  // -- reCAPTCHA --
  const captchaOk = await verifyRecaptcha(recaptchaToken, "signup");
  if (!captchaOk) throw new AuthError("reCAPTCHA verification failed", 403);

  const normalizedEmail = email ? email.toLowerCase().trim() : null;
  const providerIdField = provider === "GOOGLE" ? "googleId" : "facebookId";

  const tenantSelect = {
    ...SAFE_TENANT_SELECT,
    password: true,
    googleId: true,
    facebookId: true,
    status: true,
    ...SUBSCRIPTION_INCLUDE,
  };

  // ── 1. Lookup by provider ID first (source of truth) ──
  let existingTenant = null;

  if (providerId) {
    existingTenant = await prisma.tenant.findFirst({
      where: { [providerIdField]: providerId, deletedAt: null },
      select: tenantSelect,
    });
  }

  // ── 2. Fallback: lookup by email ──
  if (!existingTenant && normalizedEmail) {
    existingTenant = await prisma.tenant.findFirst({
      where: { email: normalizedEmail, deletedAt: null },
      select: tenantSelect,
    });
  }

  // ── 3. No email and no provider-ID match → need email from user ──
  if (!existingTenant && !normalizedEmail) {
    throw new AuthError(
      "We couldn't get your email from Facebook. Please provide it manually.",
      422,
      "EMAIL_REQUIRED",
    );
  }

  if (existingTenant) {
    // -- Status checks --
    if (existingTenant.status === "BLOCKED") {
      throw new AuthError(
        "Your account has been suspended. Please contact support.",
        403,
      );
    }
    if (existingTenant.status === "PENDING") {
      throw new AuthError(
        "Your account is pending approval. You will be notified once approved.",
        403,
      );
    }
    if (!existingTenant.isActive) {
      throw new AuthError(
        "Your account has been deactivated. Please contact support.",
        403,
      );
    }

    // -- Link rules --
    const existingProviderId =
      provider === "GOOGLE"
        ? existingTenant.googleId
        : existingTenant.facebookId;

    // Same provider, different ID → reject
    if (existingProviderId && existingProviderId !== providerId) {
      throw new AuthError(
        `This email is already linked to a different ${provider.toLowerCase()} account.`,
        409,
        "PROVIDER_MISMATCH",
      );
    }

    const linkData = {};

    // Link provider ID if not already set
    if (!existingProviderId && providerId) {
      if (provider === "GOOGLE") linkData.googleId = providerId;
      else linkData.facebookId = providerId;
    }

    // Unverified LOCAL → provider proves email ownership
    if (
      existingTenant.authProvider === "LOCAL" &&
      !existingTenant.isEmailVerified
    ) {
      linkData.password = null;
      linkData.isEmailVerified = true;
      linkData.authProvider = provider;
    }

    if (Object.keys(linkData).length > 0) {
      await prisma.tenant.update({
        where: { id: existingTenant.id },
        data: linkData,
      });
    }

    // Re-fetch with updated fields
    const linkedTenant = await prisma.tenant.findFirst({
      where: { id: existingTenant.id, deletedAt: null },
      select: { ...SAFE_TENANT_SELECT, ...SUBSCRIPTION_INCLUDE },
    });

    const tokens = await issueTokens(linkedTenant);
    const requiresOnboarding =
      linkedTenant.status === "ONBOARDING" ||
      linkedTenant.status === "APPROVED";

    return {
      tenant: sanitizeTenant(linkedTenant),
      ...tokens,
      isNew: false,
      requiresOnboarding,
    };
  }

  // -- Check other actor tables --
  const { user, superAdmin } = await checkEmailAcrossActors(normalizedEmail);

  if (user) {
    throw new AuthError(
      "This email is registered as an agent account. Please use a different email.",
      409,
    );
  }
  if (superAdmin) {
    throw new AuthError("An account with this email already exists.", 409);
  }

  // -- Create new ONBOARDING tenant --
  const newTenant = await prisma.tenant.create({
    data: {
      email: normalizedEmail,
      firstName: firstName || null,
      lastName: lastName || null,
      password: null, // OAuth-only, no password
      authProvider: provider,
      ...(provider === "GOOGLE" ? { googleId: providerId || null } : {}),
      ...(provider === "FACEBOOK" ? { facebookId: providerId || null } : {}),
      status: "ONBOARDING",
      onboardingStep: 1,
      isActive: true,
      isEmailVerified: true, // OAuth email is pre-verified by provider
    },
    select: { ...SAFE_TENANT_SELECT, ...SUBSCRIPTION_INCLUDE },
  });

  const tokens = await issueTokens(newTenant);

  // -- Audit + Notify --
  logAuth({
    actorId: newTenant.id,
    actorType: "TENANT",
    actorName: `${firstName || ""} ${lastName || ""}`.trim() || normalizedEmail,
    actorEmail: normalizedEmail,
    action: "SIGNUP",
    description: `New tenant account created via ${provider} OAuth`,
    ipAddress: ip,
    userAgent,
    tenantId: newTenant.id,
  });

  notifySRAdmin(
    "tenant_registered",
    "New Tenant Signup (OAuth)",
    `${normalizedEmail} signed up via ${provider}`,
    { tenantId: newTenant.id, email: normalizedEmail, provider },
  );

  return {
    tenant: sanitizeTenant(newTenant),
    ...tokens,
    isNew: true,
    requiresOnboarding: true,
  };
};

// -----------------------------------------------------------
// 6. OAUTH LOGIN (Google / Facebook)
//    Provider-ID-first lookup, then email fallback.
//    Returns ACCOUNT_NOT_FOUND if no match.
// -----------------------------------------------------------
export const oauthLoginService = async ({
  email,
  provider, // "GOOGLE" | "FACEBOOK"
  providerId,
  ip,
  userAgent,
}) => {
  const normalizedEmail = email ? email.toLowerCase().trim() : null;
  const providerIdField = provider === "GOOGLE" ? "googleId" : "facebookId";

  const tenantSelect = {
    ...SAFE_TENANT_SELECT,
    password: true,
    googleId: true,
    facebookId: true,
    ...SUBSCRIPTION_INCLUDE,
  };

  let tenant = null;

  // ── 1. Lookup by provider ID (source of truth) ──
  if (providerId) {
    tenant = await prisma.tenant.findFirst({
      where: { [providerIdField]: providerId, deletedAt: null },
      select: tenantSelect,
    });
  }

  // ── 2. Fallback: lookup by email ──
  if (!tenant && normalizedEmail) {
    tenant = await prisma.tenant.findFirst({
      where: { email: normalizedEmail, deletedAt: null },
      select: tenantSelect,
    });

    // Link provider ID if found by email but not yet linked
    if (tenant && !tenant[providerIdField] && providerId) {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { [providerIdField]: providerId },
      });
      tenant[providerIdField] = providerId;
    }
  }

  // ── 3. No match ──
  if (!tenant) {
    throw new AuthError(
      "No account found. Please sign up first.",
      404,
      "ACCOUNT_NOT_FOUND",
    );
  }

  // -- Status checks --
  if (tenant.status === "BLOCKED") {
    throw new AuthError(
      "Your account has been suspended. Please contact support.",
      403,
    );
  }
  if (tenant.status === "PENDING") {
    throw new AuthError("Your account is pending approval.", 403);
  }
  if (!tenant.isActive) {
    throw new AuthError("Your account has been deactivated.", 403);
  }

  // -- Issue tokens --
  const tokens = await issueTokens(tenant);
  const requiresOnboarding =
    tenant.status === "ONBOARDING" || tenant.status === "APPROVED";

  logAuth({
    actorId: tenant.id,
    actorType: "TENANT",
    actorName:
      `${tenant.firstName || ""} ${tenant.lastName || ""}`.trim() ||
      tenant.email,
    actorEmail: tenant.email,
    action: "LOGIN_SUCCESS",
    description: `Tenant logged in via ${provider} OAuth`,
    ipAddress: ip,
    userAgent,
    tenantId: tenant.id,
  });

  return {
    tenant: sanitizeTenant(tenant),
    ...tokens,
    requiresOnboarding,
  };
};

// -----------------------------------------------------------
// 7. FORGOT PASSWORD
// -----------------------------------------------------------
export const forgotPasswordService = async ({ email, ip, userAgent }) => {
  const normalizedEmail = email.toLowerCase().trim();

  const tenant = await prisma.tenant.findFirst({
    where: { email: normalizedEmail, deletedAt: null },
    select: { id: true, email: true, status: true, isActive: true },
  });

  // -- Always return success (don't reveal if email exists) --
  if (!tenant) {
    return {
      message:
        "If an account with this email exists, a password reset link has been sent.",
    };
  }

  // -- Don't send for blocked/inactive accounts --
  if (tenant.status === "BLOCKED" || !tenant.isActive) {
    return {
      message:
        "If an account with this email exists, a password reset link has been sent.",
    };
  }

  // -- Generate token (plain for email, hash for DB) --
  const { token: plainToken, hash, expiresAt } = generateResetToken();

  // -- Store hash in DB --
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      resetToken: hash,
      resetTokenExpiry: expiresAt,
    },
  });

  // -- Send email with plain token --
  try {
    await sendPasswordResetEmail(normalizedEmail, plainToken, "TENANT");
  } catch (err) {
    console.error("[forgotPassword] Email send failed:", err.message);
    // Don't throw � don't reveal email delivery failures
  }

  logAuth({
    actorId: tenant.id,
    actorType: "TENANT",
    actorEmail: normalizedEmail,
    action: "PASSWORD_RESET_REQUESTED",
    description: "Password reset link requested",
    ipAddress: ip,
    userAgent,
    tenantId: tenant.id,
  });

  return {
    message:
      "If an account with this email exists, a password reset link has been sent.",
  };
};

// -----------------------------------------------------------
// 8. RESET PASSWORD
// -----------------------------------------------------------
export const resetPasswordService = async ({
  token,
  newPassword,
  ip,
  userAgent,
}) => {
  // -- Hash the incoming plain token --
  const hashedToken = hashResetToken(token);

  // -- Find tenant by hashed token + valid expiry --
  const tenant = await prisma.tenant.findFirst({
    where: {
      resetToken: hashedToken,
      resetTokenExpiry: { gt: new Date() },
      deletedAt: null,
    },
    select: { id: true, email: true },
  });

  if (!tenant) {
    throw new AuthError("Invalid or expired reset token", 400);
  }

  // -- Hash new password --
  const hashedPassword = await hashPassword(newPassword);

  // -- Update password + clear reset fields --
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
    },
  });

  // -- Revoke all existing refresh tokens (force re-login) --
  await prisma.refreshToken.deleteMany({
    where: { tenantId: tenant.id },
  });

  logAuth({
    actorId: tenant.id,
    actorType: "TENANT",
    actorEmail: tenant.email,
    action: "PASSWORD_RESET_COMPLETED",
    description: "Password successfully reset",
    ipAddress: ip,
    userAgent,
    tenantId: tenant.id,
  });

  return { message: "Password has been reset successfully. Please log in." };
};

// -----------------------------------------------------------
// 9. CHECK USERNAME AVAILABILITY
// -----------------------------------------------------------
export const checkUsernameService = async ({ username, email }) => {
  const formatError = validateUsernameFormat(username);
  if (formatError) {
    return { available: false, reason: formatError };
  }

  const available = await isUsernameAvailable(username);
  if (available) {
    return { available: true };
  }

  // Username taken — generate 3 alternatives for the frontend
  const suggestions = await generateSuggestions("", "", email || "");
  return { available: false, suggestions };
};

// -----------------------------------------------------------
// 10. USERNAME SUGGESTIONS
// -----------------------------------------------------------
export const usernameSuggestionsService = async ({
  firstName,
  lastName,
  email,
}) => {
  let fn = firstName;
  let ln = lastName;

  // If names are empty but email is provided, derive from email
  if ((!fn || !fn.trim()) && (!ln || !ln.trim()) && email) {
    const parsed = parseEmailForName(email);
    fn = parsed.firstName;
    ln = parsed.lastName;
  }

  const suggestions = await generateSuggestions(fn, ln, email);
  return { suggestions };
};

// -----------------------------------------------------------
// 11. UPDATE PROFILE (Onboarding Step 2)
//     firstName + lastName + username
// -----------------------------------------------------------
export const updateProfileService = async ({
  tenantId,
  firstName,
  lastName,
  username,
}) => {
  // -- Validate username --
  const formatError = validateUsernameFormat(username);
  if (formatError) {
    throw new AuthError(formatError, 422);
  }

  const available = await isUsernameAvailable(username, {
    excludeTenantId: tenantId,
  });
  if (!available) {
    throw new AuthError("This username is already taken", 409);
  }

  // -- Update tenant --
  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      username: username.toLowerCase().trim(),
      onboardingStep: 4,
    },
    select: { ...SAFE_TENANT_SELECT, ...SUBSCRIPTION_INCLUDE },
  });

  logAuth({
    actorId: tenantId,
    actorType: "TENANT",
    actorName: `${firstName} ${lastName}`.trim(),
    actorEmail: updated.email,
    action: "PROFILE_UPDATED",
    description: "Onboarding step 2: profile and username set",
    tenantId,
  });

  return { tenant: sanitizeTenant(updated) };
};

// -----------------------------------------------------------
// 12. VERIFY EMAIL OTP (Onboarding Step 3)
// -----------------------------------------------------------
export const verifyEmailOtpService = async ({ tenantId, otp }) => {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
    select: {
      id: true,
      email: true,
      otpHash: true,
      otpExpiresAt: true,
      otpAttempts: true,
      isEmailVerified: true,
    },
  });

  if (!tenant) {
    throw new AuthError("Tenant not found", 404);
  }

  if (tenant.isEmailVerified) {
    return { message: "Email already verified", alreadyVerified: true };
  }

  // -- Dev fallback: accept "0000" when SES sandbox blocks emails --
  // Must be checked BEFORE expiry/attempt/hash validation
  const isDevBypass = isDev && otp === "0000";

  if (!isDevBypass) {
    if (!tenant.otpHash || !tenant.otpExpiresAt) {
      throw new AuthError("No OTP found. Please request a new one.", 400);
    }

    if (new Date() > tenant.otpExpiresAt) {
      throw new AuthError("OTP has expired. Please request a new one.", 400);
    }

    // -- Attempt limiting --
    const MAX_OTP_ATTEMPTS = 3;
    if (tenant.otpAttempts >= MAX_OTP_ATTEMPTS) {
      throw new AuthError(
        "Too many failed attempts. Please request a new OTP.",
        429,
      );
    }

    const isValid = verifyOTP(otp, tenant.otpHash);
    if (!isValid) {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { otpAttempts: { increment: 1 } },
      });
      const remaining = MAX_OTP_ATTEMPTS - tenant.otpAttempts - 1;
      throw new AuthError(
        remaining > 0
          ? `Invalid OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
          : "Too many failed attempts. Please request a new OTP.",
        400,
      );
    }
  }

  // -- Mark verified + advance step --
  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      isEmailVerified: true,
      otpHash: null,
      otpExpiresAt: null,
      otpAttempts: 0,
      onboardingStep: 3,
    },
    select: { ...SAFE_TENANT_SELECT, ...SUBSCRIPTION_INCLUDE },
  });

  logAuth({
    actorId: tenantId,
    actorType: "TENANT",
    actorEmail: tenant.email,
    action: "EMAIL_VERIFIED",
    description: "Email verified via OTP",
    tenantId,
  });

  return { tenant: sanitizeTenant(updated) };
};

// -----------------------------------------------------------
// 13. RESEND OTP
// -----------------------------------------------------------
export const resendOtpService = async ({ tenantId }) => {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
    select: {
      id: true,
      email: true,
      isEmailVerified: true,
      otpExpiresAt: true,
    },
  });

  if (!tenant) throw new AuthError("Tenant not found", 404);
  if (tenant.isEmailVerified) {
    throw new AuthError("Email is already verified", 400);
  }

  // -- Rate limit: don't resend if last OTP is still fresh (< 60s old) --
  if (tenant.otpExpiresAt) {
    const otpAge = tenant.otpExpiresAt.getTime() - getOTPExpiry().getTime();
    // getOTPExpiry() returns now + 10min. If stored expiry is close to that,
    // the OTP was recently generated.
    if (otpAge > -60 * 1000) {
      throw new AuthError("Please wait before requesting a new OTP", 429);
    }
  }

  // -- Generate + store + send --
  const plainOtp = generateOTP();
  const hashedOtp = hashOTP(plainOtp);
  const expiry = getOTPExpiry();

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { otpHash: hashedOtp, otpExpiresAt: expiry, otpAttempts: 0 },
  });

  try {
    await sendVerificationOtpEmail(tenant.email, plainOtp);
  } catch (err) {
    if (isDev) {
      console.error("[resendOtp] Email send failed (sandbox?):", err.message);
      console.log(`[DEV] 🔑 Real OTP: ${plainOtp} | Fallback: 0000`);
      // Don't throw — user can enter 0000 or the real OTP from console
    } else {
      console.error("[resendOtp] Email send failed:", err.message);
      throw new AuthError(
        "Failed to send verification email. Please try again.",
        500,
      );
    }
  }

  return { message: "Verification OTP sent to your email" };
};

// -----------------------------------------------------------
// 14. UPDATE ONBOARDING STEP (Generic, Steps 4�7)
// -----------------------------------------------------------
export const updateOnboardingStepService = async ({ tenantId, step, data = {} }) => {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
    select: { id: true, email: true, onboardingStep: true, status: true },
  });

  if (!tenant) throw new AuthError("Tenant not found", 404);

  // -- Validate step progression --
  const targetStep = Number(step);
  if (targetStep < 1 || targetStep > 7 || !Number.isInteger(targetStep)) {
    throw new AuthError("Invalid onboarding step", 422);
  }

  // Allow advancing by up to 2 steps (OAuth flow skips email verify step)
  if (targetStep > tenant.onboardingStep + 2) {
    throw new AuthError(
      `Cannot skip steps. Current step: ${tenant.onboardingStep}, requested: ${targetStep}`,
      422,
    );
  }

  // -- Whitelist of allowed Tenant fields per step --
  const ALLOWED_FIELDS = {
    4: ["tenantName", "websiteUrl"],
    5: ["phone", "companySize", "useCase", "industry", "country", "address"],
    6: ["industry", "country", "address"],
    7: [],
  };

  const updateData = { onboardingStep: targetStep };

  // Save step-specific data fields
  const allowed = ALLOWED_FIELDS[targetStep] || [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      updateData[key] = data[key];
    }
  }

  // Final step (5+) → complete onboarding and transition to ACTIVE
  if (targetStep >= 5 && tenant.status === "ONBOARDING") {
    updateData.status = "ACTIVE";
    updateData.onboardingCompleted = true;
  }

  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: updateData,
    select: { ...SAFE_TENANT_SELECT, ...SUBSCRIPTION_INCLUDE },
  });

  logAuth({
    actorId: tenantId,
    actorType: "TENANT",
    actorEmail: tenant.email,
    action: "ONBOARDING_STEP_UPDATED",
    description: `Onboarding advanced to step ${targetStep}${targetStep >= 5 ? " (COMPLETE → ACTIVE)" : ""}`,
    tenantId,
  });

  return { tenant: sanitizeTenant(updated) };
};

// -----------------------------------------------------------
// 15. SET PASSWORD (OAuth users setting password for first time)
// -----------------------------------------------------------
export const setPasswordService = async ({ tenantId, newPassword }) => {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
    select: { id: true, email: true, password: true, onboardingCompleted: true },
  });

  if (!tenant) throw new AuthError("Tenant not found", 404);

  // Only block after onboarding is complete — during onboarding,
  // retries are expected (e.g. after a failed profile step)
  if (tenant.password && tenant.onboardingCompleted) {
    throw new AuthError(
      "Password is already set. Use forgot password to change it.",
      400,
    );
  }

  const hashedPassword = await hashPassword(newPassword);

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { password: hashedPassword },
  });

  logAuth({
    actorId: tenantId,
    actorType: "TENANT",
    actorEmail: tenant.email,
    action: "PASSWORD_SET",
    description: "Password set for OAuth account",
    tenantId,
  });

  return { message: "Password set successfully" };
};

// -----------------------------------------------------------
// 16. SET USERNAME (Legacy guard � NULL username users)
// -----------------------------------------------------------
export const setUsernameService = async ({ tenantId, username }) => {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
    select: { id: true, email: true, username: true },
  });

  if (!tenant) throw new AuthError("Tenant not found", 404);

  // -- Only for tenants with NULL username --
  if (tenant.username) {
    throw new AuthError("Username is already set and cannot be changed", 400);
  }

  // -- Validate --
  const formatError = validateUsernameFormat(username);
  if (formatError) throw new AuthError(formatError, 422);

  const available = await isUsernameAvailable(username, {
    excludeTenantId: tenantId,
  });
  if (!available) {
    throw new AuthError("This username is already taken", 409);
  }

  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: { username: username.toLowerCase().trim() },
    select: SAFE_TENANT_SELECT,
  });

  logAuth({
    actorId: tenantId,
    actorType: "TENANT",
    actorEmail: tenant.email,
    action: "USERNAME_SET",
    description: `Legacy username set: ${username}`,
    tenantId,
  });

  return { tenant: sanitizeTenant(updated) };
};
