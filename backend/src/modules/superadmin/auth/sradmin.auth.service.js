// backend/src/modules/superadmin/auth/sradmin.auth.service.js (do not remove this comment)

import prisma from "../../config/prisma.js";
import { hashPassword, comparePassword } from "../../utils/hash.js";
import { createTokenPair } from "../../utils/tokens.js";
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
const SAFE_SRADMIN_SELECT = {
  id: true,
  name: true,
  email: true,
  username: true,
  createdAt: true,
};

const sanitizeSRAdmin = (admin) => {
  if (!admin) return null;
  const safe = {};
  for (const key of Object.keys(SAFE_SRADMIN_SELECT)) {
    if (key in admin) safe[key] = admin[key];
  }
  return safe;
};

// NOTE: JWT type stays "SUPERADMIN" for DB/JWT backward compat.
// Variable names use srAdmin per project convention.
const buildTokenPayload = (admin) => ({
  id: admin.id,
  email: admin.email,
  type: "SUPERADMIN",
});

const issueTokens = async (admin) => {
  const payload = buildTokenPayload(admin);
  const { accessToken, refreshToken } = await createTokenPair(payload);
  await saveRefreshToken({ token: refreshToken, superAdminId: admin.id });
  return { accessToken, refreshToken };
};

const logAuth = (fields) =>
  createAuditLog({ module: "AUTH", ...fields }).catch(() => {});

// ═══════════════════════════════════════════════════════════
// 1. CREATE SRADMIN (by existing SRAdmin)
// ═══════════════════════════════════════════════════════════
export const createSRAdminService = async ({
  name,
  email,
  password,
  createdBy,
}) => {
  const normalizedEmail = email.toLowerCase().trim();

  // ── Check across all actor tables ──
  const [tenant, user, existingAdmin] = await Promise.all([
    prisma.tenant.findFirst({
      where: { email: normalizedEmail, deletedAt: null },
      select: { id: true },
    }),
    prisma.user.findFirst({
      where: { email: normalizedEmail, deletedAt: null },
      select: { id: true },
    }),
    prisma.superAdmin.findFirst({
      where: { email: normalizedEmail },
      select: { id: true },
    }),
  ]);

  if (tenant || user || existingAdmin) {
    throw new AuthError(
      "An account with this email already exists on the platform",
      409,
    );
  }

  const hashedPassword = await hashPassword(password);

  const newAdmin = await prisma.superAdmin.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    },
    select: SAFE_SRADMIN_SELECT,
  });

  logAuth({
    actorId: createdBy,
    actorType: "SUPER_ADMIN",
    actorEmail: "system",
    action: "SRADMIN_CREATED",
    description: `New SRAdmin created: ${normalizedEmail}`,
    targetId: newAdmin.id,
    targetType: "SUPER_ADMIN",
    targetName: newAdmin.name,
  });

  return { srAdmin: sanitizeSRAdmin(newAdmin) };
};

// ═══════════════════════════════════════════════════════════
// 2. LOGIN (Email or Username + Password)
// ═══════════════════════════════════════════════════════════
export const loginService = async ({ identifier, password, ip, userAgent }) => {
  const trimmed = identifier.trim();
  const isEmail = trimmed.includes("@");

  const where = isEmail
    ? { email: trimmed.toLowerCase() }
    : { username: { equals: trimmed, mode: "insensitive" } };

  const admin = await prisma.superAdmin.findFirst({
    where,
    select: {
      ...SAFE_SRADMIN_SELECT,
      password: true,
    },
  });

  if (!admin) {
    logAuth({
      actorId: "UNKNOWN",
      actorType: "SUPER_ADMIN",
      actorName: "Unknown",
      actorEmail: isEmail ? trimmed : "N/A",
      action: "LOGIN_FAILED",
      description: `Failed SRAdmin login — ${isEmail ? "email" : "username"} not found`,
      ipAddress: ip,
      userAgent,
    });
    throw new AuthError("Invalid credentials", 401);
  }

  const passwordMatch = await comparePassword(password, admin.password);
  if (!passwordMatch) {
    logAuth({
      actorId: admin.id,
      actorType: "SUPER_ADMIN",
      actorName: admin.name,
      actorEmail: admin.email,
      action: "LOGIN_FAILED",
      description: "Invalid password attempt",
      ipAddress: ip,
      userAgent,
    });
    throw new AuthError("Invalid credentials", 401);
  }

  const tokens = await issueTokens(admin);

  logAuth({
    actorId: admin.id,
    actorType: "SUPER_ADMIN",
    actorName: admin.name,
    actorEmail: admin.email,
    action: "LOGIN_SUCCESS",
    description: `SRAdmin logged in via ${isEmail ? "email" : "username"}`,
    ipAddress: ip,
    userAgent,
  });

  return {
    srAdmin: sanitizeSRAdmin(admin),
    ...tokens,
  };
};

// ═══════════════════════════════════════════════════════════
// 3. LOGOUT
// ═══════════════════════════════════════════════════════════
export const logoutService = async ({ refreshToken, adminId }) => {
  try {
    await deleteRefreshToken(refreshToken);
  } catch {
    // Already deleted or invalid
  }

  logAuth({
    actorId: adminId || "UNKNOWN",
    actorType: "SUPER_ADMIN",
    actorEmail: "unknown",
    action: "LOGOUT",
    description: "SRAdmin logged out",
  });

  return { message: "Logged out successfully" };
};

// ═══════════════════════════════════════════════════════════
// 4. REFRESH TOKEN
//    Bug #19 FIX: Uses createTokenPair() not raw jwt.sign()
// ═══════════════════════════════════════════════════════════
export const refreshTokenService = async ({ refreshToken }) => {
  const tokenRecord = await findRefreshToken(refreshToken, "SUPERADMIN");
  if (!tokenRecord || tokenRecord.isRevoked) {
    throw new AuthError("Invalid or expired refresh token", 401);
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    await deleteRefreshToken(refreshToken).catch(() => {});
    throw new AuthError("Invalid or expired refresh token", 401);
  }

  const admin = await prisma.superAdmin.findFirst({
    where: { id: decoded.id },
    select: SAFE_SRADMIN_SELECT,
  });

  if (!admin) {
    await deleteRefreshToken(refreshToken).catch(() => {});
    throw new AuthError("SRAdmin account not found", 401);
  }

  // ── Rotate tokens ──
  await deleteRefreshToken(refreshToken).catch(() => {});
  const tokens = await issueTokens(admin);

  return tokens;
};

// ═══════════════════════════════════════════════════════════
// 5. FORGOT PASSWORD
// ═══════════════════════════════════════════════════════════
export const forgotPasswordService = async ({ email, ip, userAgent }) => {
  const normalizedEmail = email.toLowerCase().trim();

  const admin = await prisma.superAdmin.findFirst({
    where: { email: normalizedEmail },
    select: { id: true, email: true },
  });

  const genericMessage =
    "If an account with this email exists, a password reset link has been sent.";

  if (!admin) return { message: genericMessage };

  const { token: plainToken, hash, expiresAt } = generateResetToken();

  await prisma.superAdmin.update({
    where: { id: admin.id },
    data: {
      resetToken: hash,
      resetTokenExpiry: expiresAt,
    },
  });

  try {
    await sendPasswordResetEmail(normalizedEmail, plainToken, "SUPERADMIN");
  } catch (err) {
    console.error("[forgotPassword:SRAdmin] Email send failed:", err.message);
  }

  logAuth({
    actorId: admin.id,
    actorType: "SUPER_ADMIN",
    actorEmail: normalizedEmail,
    action: "PASSWORD_RESET_REQUESTED",
    description: "Password reset link requested",
    ipAddress: ip,
    userAgent,
  });

  return { message: genericMessage };
};

// ═══════════════════════════════════════════════════════════
// 6. RESET PASSWORD
// ═══════════════════════════════════════════════════════════
export const resetPasswordService = async ({
  token,
  newPassword,
  ip,
  userAgent,
}) => {
  const hashedToken = hashResetToken(token);

  const admin = await prisma.superAdmin.findFirst({
    where: {
      resetToken: hashedToken,
      resetTokenExpiry: { gt: new Date() },
    },
    select: { id: true, email: true },
  });

  if (!admin) {
    throw new AuthError("Invalid or expired reset token", 400);
  }

  const hashedPassword = await hashPassword(newPassword);

  await prisma.superAdmin.update({
    where: { id: admin.id },
    data: {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
    },
  });

  // ── Revoke all sessions ──
  await prisma.refreshToken.deleteMany({
    where: { superAdminId: admin.id },
  });

  logAuth({
    actorId: admin.id,
    actorType: "SUPER_ADMIN",
    actorEmail: admin.email,
    action: "PASSWORD_RESET_COMPLETED",
    description: "Password successfully reset",
    ipAddress: ip,
    userAgent,
  });

  return { message: "Password has been reset successfully. Please log in." };
};