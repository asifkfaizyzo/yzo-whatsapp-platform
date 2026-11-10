// backend/src/modules/users/user.auth.service.new.js (do not remove this comment)

import prisma from "../../config/prisma.js";
import { hashPassword, comparePassword } from "../../utils/hash.js";
import { createTokenPair } from "../../utils/tokens.js";
import { verifyRecaptcha } from "../../utils/recaptcha.js";
import {
  validateUsernameFormat,
  isUsernameAvailable,
} from "../../utils/username.js";
import {
  generateResetToken,
  hashResetToken,
} from "../../utils/resetToken.js";
import {
  saveRefreshToken,
  deleteRefreshToken,
  findRefreshToken,
} from "../auth/refreshToken.service.js";
import { verifyRefreshToken } from "../auth/jwt.service.js";
import { sendPasswordResetEmail } from "../auth/email.service.js";
import { createAuditLog } from "../audit/audit.service.js";

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
const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  username: true,
  isActive: true,
  tenantId: true,
  availabilityStatus: true,
  createdAt: true,
};

const sanitizeUser = (user) => {
  if (!user) return null;
  const safe = {};
  for (const key of Object.keys(SAFE_USER_SELECT)) {
    if (key in user) safe[key] = user[key];
  }
  return safe;
};

const buildTokenPayload = (user) => ({
  id: user.id,
  email: user.email,
  tenantId: user.tenantId,
  type: "USER",
});

const issueTokens = async (user) => {
  const payload = buildTokenPayload(user);
  const { accessToken, refreshToken } = await createTokenPair(payload);
  await saveRefreshToken({ token: refreshToken, userId: user.id });
  return { accessToken, refreshToken };
};

const logAuth = (fields) =>
  createAuditLog({ module: "AUTH", ...fields }).catch(() => {});

// ── Tenant status check helper ──
const checkParentTenant = async (tenantId) => {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
    select: { id: true, status: true, isActive: true },
  });

  if (!tenant) {
    throw new AuthError(
      "Your organization account no longer exists.",
      403,
    );
  }
  if (tenant.status === "BLOCKED") {
    throw new AuthError(
      "Your organization has been suspended. Please contact your admin.",
      403,
    );
  }
  if (tenant.status === "PENDING") {
    throw new AuthError(
      "Your organization account is pending approval.",
      403,
    );
  }
  if (tenant.status === "ONBOARDING") {
    throw new AuthError(
      "Your organization is still setting up. Please wait for your admin to complete onboarding.",
      403,
    );
  }
  if (!tenant.isActive) {
    throw new AuthError(
      "Your organization account has been deactivated.",
      403,
    );
  }

  return tenant;
};

// ═══════════════════════════════════════════════════════════
// 1. LOGIN (Email or Username + Password)
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

  const user = await prisma.user.findFirst({
    where,
    select: {
      ...SAFE_USER_SELECT,
      password: true,
    },
  });

  // ── Not found ──
  if (!user) {
    logAuth({
      actorId: "UNKNOWN",
      actorType: "USER",
      actorName: "Unknown",
      actorEmail: isEmail ? trimmed : "N/A",
      action: "LOGIN_FAILED",
      description: `Failed agent login — ${isEmail ? "email" : "username"} not found`,
      ipAddress: ip,
      userAgent,
    });
    throw new AuthError("Invalid credentials", 401);
  }

  // ── Deactivated user ──
  if (!user.isActive) {
    logAuth({
      actorId: user.id,
      actorType: "USER",
      actorName: user.name,
      actorEmail: user.email,
      action: "LOGIN_FAILED",
      description: "Deactivated agent tried to login",
      ipAddress: ip,
      userAgent,
      tenantId: user.tenantId,
    });
    throw new AuthError(
      "Your account has been deactivated. Please contact your admin.",
      403,
    );
  }

  // ── Parent tenant check ──
  await checkParentTenant(user.tenantId);

  // ── Verify password ──
  const passwordMatch = await comparePassword(password, user.password);
  if (!passwordMatch) {
    logAuth({
      actorId: user.id,
      actorType: "USER",
      actorName: user.name,
      actorEmail: user.email,
      action: "LOGIN_FAILED",
      description: "Invalid password attempt",
      ipAddress: ip,
      userAgent,
      tenantId: user.tenantId,
    });
    throw new AuthError("Invalid credentials", 401);
  }

  // ── Issue tokens ──
  const tokens = await issueTokens(user);

  // ── Legacy guard ──
  const requiresUsername = !user.username;

  // ── Audit ──
  logAuth({
    actorId: user.id,
    actorType: "USER",
    actorName: user.name,
    actorEmail: user.email,
    action: "LOGIN_SUCCESS",
    description: `Agent logged in via ${isEmail ? "email" : "username"}`,
    ipAddress: ip,
    userAgent,
    tenantId: user.tenantId,
  });

  return {
    user: sanitizeUser(user),
    ...tokens,
    requiresUsername,
  };
};

// ═══════════════════════════════════════════════════════════
// 2. LOGOUT
// ═══════════════════════════════════════════════════════════
export const logoutService = async ({ refreshToken, userId, tenantId }) => {
  try {
    await deleteRefreshToken(refreshToken);
  } catch {
    // Token already deleted or invalid
  }

  logAuth({
    actorId: userId || "UNKNOWN",
    actorType: "USER",
    actorEmail: "unknown",
    action: "LOGOUT",
    description: "Agent logged out",
    tenantId,
  });

  return { message: "Logged out successfully" };
};

// ═══════════════════════════════════════════════════════════
// 3. REFRESH TOKEN
// ═══════════════════════════════════════════════════════════
export const refreshTokenService = async ({ refreshToken }) => {
  // ── Find in DB ──
  const tokenRecord = await findRefreshToken(refreshToken, "USER");
  if (!tokenRecord || tokenRecord.isRevoked) {
    throw new AuthError("Invalid or expired refresh token", 401);
  }

  // ── Verify JWT ──
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    await deleteRefreshToken(refreshToken).catch(() => {});
    throw new AuthError("Invalid or expired refresh token", 401);
  }

  // ── Verify user still exists and active ──
  const user = await prisma.user.findFirst({
    where: { id: decoded.id, deletedAt: null },
    select: { ...SAFE_USER_SELECT, tenantId: true },
  });

  if (!user) {
    await deleteRefreshToken(refreshToken).catch(() => {});
    throw new AuthError("Agent account not found", 401);
  }

  if (!user.isActive) {
    await deleteRefreshToken(refreshToken).catch(() => {});
    throw new AuthError("Agent account is deactivated", 403);
  }

  // ── Verify parent tenant ──
  try {
    await checkParentTenant(user.tenantId);
  } catch (err) {
    await deleteRefreshToken(refreshToken).catch(() => {});
    throw err;
  }

  // ── Rotate tokens ──
  await deleteRefreshToken(refreshToken).catch(() => {});
  const tokens = await issueTokens(user);

  return tokens;
};

// ═══════════════════════════════════════════════════════════
// 4. FORGOT PASSWORD
// ═══════════════════════════════════════════════════════════
export const forgotPasswordService = async ({ email, ip, userAgent }) => {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findFirst({
    where: { email: normalizedEmail, deletedAt: null },
    select: { id: true, email: true, isActive: true, tenantId: true },
  });

  // ── Always return same message ──
  const genericMessage =
    "If an account with this email exists, a password reset link has been sent.";

  if (!user) return { message: genericMessage };
  if (!user.isActive) return { message: genericMessage };

  // ── Generate token ──
  const { token: plainToken, hash, expiresAt } = generateResetToken();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken: hash,
      resetTokenExpiry: expiresAt,
    },
  });

  try {
    await sendPasswordResetEmail(normalizedEmail, plainToken, "USER");
  } catch (err) {
    console.error("[forgotPassword:User] Email send failed:", err.message);
  }

  logAuth({
    actorId: user.id,
    actorType: "USER",
    actorEmail: normalizedEmail,
    action: "PASSWORD_RESET_REQUESTED",
    description: "Password reset link requested",
    ipAddress: ip,
    userAgent,
    tenantId: user.tenantId,
  });

  return { message: genericMessage };
};

// ═══════════════════════════════════════════════════════════
// 5. RESET PASSWORD
// ═══════════════════════════════════════════════════════════
export const resetPasswordService = async ({
  token,
  newPassword,
  ip,
  userAgent,
}) => {
  const hashedToken = hashResetToken(token);

  const user = await prisma.user.findFirst({
    where: {
      resetToken: hashedToken,
      resetTokenExpiry: { gt: new Date() },
      deletedAt: null,
    },
    select: { id: true, email: true, tenantId: true },
  });

  if (!user) {
    throw new AuthError("Invalid or expired reset token", 400);
  }

  const hashedPassword = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
    },
  });

  // ── Revoke all sessions ──
  await prisma.refreshToken.deleteMany({
    where: { userId: user.id },
  });

  logAuth({
    actorId: user.id,
    actorType: "USER",
    actorEmail: user.email,
    action: "PASSWORD_RESET_COMPLETED",
    description: "Password successfully reset",
    ipAddress: ip,
    userAgent,
    tenantId: user.tenantId,
  });

  return { message: "Password has been reset successfully. Please log in." };
};

// ═══════════════════════════════════════════════════════════
// 6. GOOGLE LOGIN (existing agents only)
// ═══════════════════════════════════════════════════════════
export const googleLoginService = async ({
  email,
  ip,
  userAgent,
}) => {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findFirst({
    where: { email: normalizedEmail, deletedAt: null },
    select: { ...SAFE_USER_SELECT },
  });

  if (!user) {
    throw new AuthError(
      "No agent account found with this email. Please contact your admin to create an account first.",
      404,
    );
  }

  if (!user.isActive) {
    throw new AuthError(
      "Your account has been deactivated. Contact your admin.",
      403,
    );
  }

  // ── Parent tenant check ──
  await checkParentTenant(user.tenantId);

  // ── Issue tokens ──
  const tokens = await issueTokens(user);

  logAuth({
    actorId: user.id,
    actorType: "USER",
    actorName: user.name,
    actorEmail: user.email,
    action: "LOGIN_SUCCESS",
    description: "Agent logged in via Google OAuth",
    ipAddress: ip,
    userAgent,
    tenantId: user.tenantId,
  });

  return {
    user: sanitizeUser(user),
    ...tokens,
  };
};

// ═══════════════════════════════════════════════════════════
// 7. SET USERNAME (Legacy guard)
// ═══════════════════════════════════════════════════════════
export const setUsernameService = async ({ userId, username }) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, email: true, username: true },
  });

  if (!user) throw new AuthError("User not found", 404);

  if (user.username) {
    throw new AuthError(
      "Username is already set and cannot be changed",
      400,
    );
  }

  const formatError = validateUsernameFormat(username);
  if (formatError) throw new AuthError(formatError, 422);

  const available = await isUsernameAvailable(username, {
    excludeUserId: userId,
  });
  if (!available) {
    throw new AuthError("This username is already taken", 409);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { username: username.toLowerCase().trim() },
    select: SAFE_USER_SELECT,
  });

  logAuth({
    actorId: userId,
    actorType: "USER",
    actorEmail: user.email,
    action: "USERNAME_SET",
    description: `Legacy username set: ${username}`,
  });

  return { user: sanitizeUser(updated) };
};