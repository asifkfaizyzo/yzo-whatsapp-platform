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
} from "../../../utils/username.js";
import {
  saveRefreshToken,
  deleteRefreshToken,
  findRefreshToken,
} from "../../auth/refreshToken.service.js";
import { verifyRefreshToken } from "../../auth/jwt.service.js";
import {
  sendPasswordResetEmail,
  sendVerificationOtpEmail,
} from "../../auth/email.service.js";
import { createAuditLog } from "../../audit/audit.service.js";
import { createSuperAdminNotification } from "../../superadmin-notifications/superAdminNotificationService.js";
import { emitToSuperAdmin } from "../../../lib/socket.js";

// ═══════════════════════════════════════════════════════════
// CUSTOM ERROR
// ═══════════════════════════════════════════════════════════
class AuthError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = "AuthError";
  }
}

// ═══════════════════════════════════════════════════════════
// CONSTANTS & HELPERS
// ═══════════════════════════════════════════════════════════
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
  isEmailVerified: true,
  authProvider: true,
  createdAt: true,
};

const sanitizeTenant = (tenant) => {
  if (!tenant) return null;
  const safe = {};
  for (const key of Object.keys(SAFE_TENANT_SELECT)) {
    if (key in tenant) safe[key] = tenant[key];
  }
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
  createAuditLog({ module: "AUTH", ...fields }).catch(() => {});

const notifySRAdmin = async (type, title, message, metadata) => {
  try {
    await createSuperAdminNotification({ type, title, message, metadata });
    emitToSuperAdmin("new_notification", { type, title, message });
  } catch {
    // Non-blocking
  }
};

// ═══════════════════════════════════════════════════════════
// 1. SIGNUP (Email + Password)
// ═══════════════════════════════════════════════════════════
export const signupService = async ({
  email,
  password,
  recaptchaToken,
  ip,
  userAgent,
}) => {
  // ── reCAPTCHA ──
  const captchaOk = await verifyRecaptcha(recaptchaToken, "signup");
  if (!captchaOk) throw new AuthError("reCAPTCHA verification failed", 403);

  // ── Normalize ──
  const normalizedEmail = email.toLowerCase().trim();

  // ── Check existence across all actor tables ──
  const { tenant, user, superAdmin } =
    await checkEmailAcrossActors(normalizedEmail);

  if (tenant) {
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

  // ── Hash password ──
  const hashedPassword = await hashPassword(password);

  // ── Create tenant ──
  const newTenant = await prisma.tenant.create({
    data: {
      email: normalizedEmail,
      password: hashedPassword,
      status: "ONBOARDING",
      onboardingStep: 1,
      isActive: true,
      isEmailVerified: false,
    },
    select: { ...SAFE_TENANT_SELECT, password: true },
  });

  // ── Issue tokens ──
  const tokens = await issueTokens(newTenant);

  // ── Audit + Notify (non-blocking) ──
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

// ═══════════════════════════════════════════════════════════
// 2. LOGIN (Email or Username + Password)
// ═══════════════════════════════════════════════════════════
export const loginService = async ({
  identifier,
  password,
  recaptchaToken,
  ip,
  userAgent,
}) => {
  // ── reCAPTCHA ──
  const captchaOk = await verifyRecaptcha(recaptchaToken, "login");
  if (!captchaOk) throw new AuthError("reCAPTCHA verification failed", 403);

  // ── Detect identifier type ──
  const trimmed = identifier.trim();
  const isEmail = trimmed.includes("@");

  const where = isEmail
    ? { email: trimmed.toLowerCase(), deletedAt: null }
    : { username: { equals: trimmed, mode: "insensitive" }, deletedAt: null };

  const tenant = await prisma.tenant.findFirst({
    where,
    select: {
      ...SAFE_TENANT_SELECT,
      password: true,
    },
  });

  // ── Not found ──
  if (!tenant) {
    throw new AuthError("Invalid credentials", 401);
  }

  // ── OAuth-only account (no password set) ──
  if (!tenant.password) {
    const provider = tenant.authProvider || "social";
    throw new AuthError(
      `This account uses ${provider.toLowerCase()} login. Please sign in with ${provider}.`,
      400,
    );
  }

  // ── Verify password ──
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

  // ── Status checks ──
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

  // ── Issue tokens ──
  const tokens = await issueTokens(tenant);

  // ── Legacy guard: NULL username ──
  const requiresUsername = !tenant.username;

  // ── Onboarding gate ──
  const requiresOnboarding =
    tenant.status === "ONBOARDING" || tenant.status === "APPROVED";

  // ── Audit ──
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

// ═══════════════════════════════════════════════════════════
// 3. LOGOUT
// ═══════════════════════════════════════════════════════════
export const logoutService = async ({ refreshToken, tenantId }) => {
  try {
    await deleteRefreshToken(refreshToken);
  } catch {
    // Token already deleted or invalid — still return success
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

// ═══════════════════════════════════════════════════════════
// 4. REFRESH TOKEN
// ═══════════════════════════════════════════════════════════
export const refreshTokenService = async ({ refreshToken }) => {
  // ── Find in DB ──
  const tokenRecord = await findRefreshToken(refreshToken, "TENANT");
  if (!tokenRecord || tokenRecord.isRevoked) {
    throw new AuthError("Invalid or expired refresh token", 401);
  }

  // ── Verify JWT signature + expiry ──
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    // JWT expired or tampered — clean up DB
    await deleteRefreshToken(refreshToken).catch(() => {});
    throw new AuthError("Invalid or expired refresh token", 401);
  }

  // ── Verify tenant still exists and is active ──
  const tenant = await prisma.tenant.findFirst({
    where: { id: decoded.id, deletedAt: null },
    select: { ...SAFE_TENANT_SELECT },
  });

  if (!tenant) {
    await deleteRefreshToken(refreshToken).catch(() => {});
    throw new AuthError("Tenant account not found", 401);
  }

  if (tenant.status === "BLOCKED" || !tenant.isActive) {
    await deleteRefreshToken(refreshToken).catch(() => {});
    throw new AuthError("Account is no longer active", 403);
  }

  // ── Rotate tokens ──
  await deleteRefreshToken(refreshToken).catch(() => {});
  const tokens = await issueTokens(tenant);

  return tokens;
};

// ═══════════════════════════════════════════════════════════
// 5. OAUTH SIGNUP (Google / Facebook)
//    Creates account if new, auto-logins if existing
// ═══════════════════════════════════════════════════════════
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
  // ── reCAPTCHA ──
  const captchaOk = await verifyRecaptcha(recaptchaToken, "signup");
  if (!captchaOk) throw new AuthError("reCAPTCHA verification failed", 403);

  const normalizedEmail = email.toLowerCase().trim();

  // ── Check if tenant already exists ──
  const existingTenant = await prisma.tenant.findFirst({
    where: { email: normalizedEmail, deletedAt: null },
    select: { ...SAFE_TENANT_SELECT, status: true },
  });

  if (existingTenant) {
    // ── Auto-login existing tenant ──
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

    const tokens = await issueTokens(existingTenant);
    const requiresOnboarding =
      existingTenant.status === "ONBOARDING" ||
      existingTenant.status === "APPROVED";

    return {
      tenant: sanitizeTenant(existingTenant),
      ...tokens,
      isNew: false,
      requiresOnboarding,
    };
  }

  // ── Check other actor tables ──
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

  // ── Create new ONBOARDING tenant ──
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
    select: { ...SAFE_TENANT_SELECT },
  });

  const tokens = await issueTokens(newTenant);

  // ── Audit + Notify ──
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

// ═══════════════════════════════════════════════════════════
// 6. OAUTH LOGIN (Google / Facebook)
//    Existing accounts only — 404 if not found
// ═══════════════════════════════════════════════════════════
export const oauthLoginService = async ({
  email,
  provider, // "GOOGLE" | "FACEBOOK"
  providerId,
  ip,
  userAgent,
}) => {
  const normalizedEmail = email.toLowerCase().trim();

  const tenant = await prisma.tenant.findFirst({
    where: { email: normalizedEmail, deletedAt: null },
    select: { ...SAFE_TENANT_SELECT },
  });

  if (!tenant) {
    throw new AuthError(
      "No account found with this email. Please sign up first.",
      404,
    );
  }

  // ── Status checks ──
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

  // ── Issue tokens ──
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

// ═══════════════════════════════════════════════════════════
// 7. FORGOT PASSWORD
// ═══════════════════════════════════════════════════════════
export const forgotPasswordService = async ({ email, ip, userAgent }) => {
  const normalizedEmail = email.toLowerCase().trim();

  const tenant = await prisma.tenant.findFirst({
    where: { email: normalizedEmail, deletedAt: null },
    select: { id: true, email: true, status: true, isActive: true },
  });

  // ── Always return success (don't reveal if email exists) ──
  if (!tenant) {
    return {
      message:
        "If an account with this email exists, a password reset link has been sent.",
    };
  }

  // ── Don't send for blocked/inactive accounts ──
  if (tenant.status === "BLOCKED" || !tenant.isActive) {
    return {
      message:
        "If an account with this email exists, a password reset link has been sent.",
    };
  }

  // ── Generate token (plain for email, hash for DB) ──
  const { token: plainToken, hash, expiresAt } = generateResetToken();

  // ── Store hash in DB ──
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      resetToken: hash,
      resetTokenExpiry: expiresAt,
    },
  });

  // ── Send email with plain token ──
  try {
    await sendPasswordResetEmail(normalizedEmail, plainToken, "TENANT");
  } catch (err) {
    console.error("[forgotPassword] Email send failed:", err.message);
    // Don't throw — don't reveal email delivery failures
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

// ═══════════════════════════════════════════════════════════
// 8. RESET PASSWORD
// ═══════════════════════════════════════════════════════════
export const resetPasswordService = async ({
  token,
  newPassword,
  ip,
  userAgent,
}) => {
  // ── Hash the incoming plain token ──
  const hashedToken = hashResetToken(token);

  // ── Find tenant by hashed token + valid expiry ──
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

  // ── Hash new password ──
  const hashedPassword = await hashPassword(newPassword);

  // ── Update password + clear reset fields ──
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
    },
  });

  // ── Revoke all existing refresh tokens (force re-login) ──
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

// ═══════════════════════════════════════════════════════════
// 9. CHECK USERNAME AVAILABILITY
// ═══════════════════════════════════════════════════════════
export const checkUsernameService = async ({ username }) => {
  const formatError = validateUsernameFormat(username);
  if (formatError) {
    return { available: false, reason: formatError };
  }

  const available = await isUsernameAvailable(username);
  return { available };
};

// ═══════════════════════════════════════════════════════════
// 10. USERNAME SUGGESTIONS
// ═══════════════════════════════════════════════════════════
export const usernameSuggestionsService = async ({ firstName, lastName }) => {
  const suggestions = await generateSuggestions(firstName, lastName);
  return { suggestions };
};

// ═══════════════════════════════════════════════════════════
// 11. UPDATE PROFILE (Onboarding Step 2)
//     firstName + lastName + username
// ═══════════════════════════════════════════════════════════
export const updateProfileService = async ({
  tenantId,
  firstName,
  lastName,
  username,
}) => {
  // ── Validate username ──
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

  // ── Update tenant ──
  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      username: username.toLowerCase().trim(),
      onboardingStep: 2,
    },
    select: SAFE_TENANT_SELECT,
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

// ═══════════════════════════════════════════════════════════
// 12. VERIFY EMAIL OTP (Onboarding Step 3)
// ═══════════════════════════════════════════════════════════
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

  if (!tenant.otpHash || !tenant.otpExpiresAt) {
    throw new AuthError("No OTP found. Please request a new one.", 400);
  }

  if (new Date() > tenant.otpExpiresAt) {
    throw new AuthError("OTP has expired. Please request a new one.", 400);
  }

  // ── Attempt limiting ──
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

  // ── Mark verified + advance step ──
  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      isEmailVerified: true,
      otpHash: null,
      otpExpiresAt: null,
      otpAttempts: 0,
      onboardingStep: 3,
    },
    select: SAFE_TENANT_SELECT,
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

// ═══════════════════════════════════════════════════════════
// 13. RESEND OTP
// ═══════════════════════════════════════════════════════════
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

  // ── Rate limit: don't resend if last OTP is still fresh (< 60s old) ──
  if (tenant.otpExpiresAt) {
    const otpAge = tenant.otpExpiresAt.getTime() - getOTPExpiry().getTime();
    // getOTPExpiry() returns now + 10min. If stored expiry is close to that,
    // the OTP was recently generated.
    if (otpAge > -60 * 1000) {
      throw new AuthError("Please wait before requesting a new OTP", 429);
    }
  }

  // ── Generate + store + send ──
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
    console.error("[resendOtp] Email send failed:", err.message);
    throw new AuthError(
      "Failed to send verification email. Please try again.",
      500,
    );
  }

  return { message: "Verification OTP sent to your email" };
};

// ═══════════════════════════════════════════════════════════
// 14. UPDATE ONBOARDING STEP (Generic, Steps 4–7)
// ═══════════════════════════════════════════════════════════
export const updateOnboardingStepService = async ({ tenantId, step }) => {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
    select: { id: true, email: true, onboardingStep: true, status: true },
  });

  if (!tenant) throw new AuthError("Tenant not found", 404);

  // ── Validate step progression ──
  const targetStep = Number(step);
  if (targetStep < 1 || targetStep > 7 || !Number.isInteger(targetStep)) {
    throw new AuthError("Invalid onboarding step", 422);
  }

  // Allow advancing by 1 or re-submitting current step
  if (targetStep > tenant.onboardingStep + 1) {
    throw new AuthError(
      `Cannot skip steps. Current step: ${tenant.onboardingStep}, requested: ${targetStep}`,
      422,
    );
  }

  // ── Determine new status ──
  const updateData = { onboardingStep: targetStep };

  // Final step → transition to ACTIVE
  if (targetStep >= 7 && tenant.status === "ONBOARDING") {
    updateData.status = "ACTIVE";
  }

  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: updateData,
    select: SAFE_TENANT_SELECT,
  });

  logAuth({
    actorId: tenantId,
    actorType: "TENANT",
    actorEmail: tenant.email,
    action: "ONBOARDING_STEP_UPDATED",
    description: `Onboarding advanced to step ${targetStep}${targetStep >= 7 ? " (ACTIVE)" : ""}`,
    tenantId,
  });

  return { tenant: sanitizeTenant(updated) };
};

// ═══════════════════════════════════════════════════════════
// 15. SET PASSWORD (OAuth users setting password for first time)
// ═══════════════════════════════════════════════════════════
export const setPasswordService = async ({ tenantId, newPassword }) => {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
    select: { id: true, email: true, password: true },
  });

  if (!tenant) throw new AuthError("Tenant not found", 404);

  if (tenant.password) {
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

// ═══════════════════════════════════════════════════════════
// 16. SET USERNAME (Legacy guard — NULL username users)
// ═══════════════════════════════════════════════════════════
export const setUsernameService = async ({ tenantId, username }) => {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
    select: { id: true, email: true, username: true },
  });

  if (!tenant) throw new AuthError("Tenant not found", 404);

  // ── Only for tenants with NULL username ──
  if (tenant.username) {
    throw new AuthError("Username is already set and cannot be changed", 400);
  }

  // ── Validate ──
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
