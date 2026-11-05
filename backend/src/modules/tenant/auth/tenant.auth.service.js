// backend/src/modules/tenant/auth/tenant.auth.service.js (do not remove this comment)
import bcrypt from "bcrypt";
import prisma from "../../../config/prisma.js";
import { OAuth2Client } from "google-auth-library";
import axios from "axios";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../auth/jwt.service.js";
import {
  saveRefreshToken,
  deleteRefreshToken,
  findRefreshToken,
} from "../../auth/refreshToken.service.js";
import {
  forgotPasswordService,
  resetPasswordService,
} from "../../auth/password.service.js";
import { emitToSuperAdmin } from "../../../lib/socket.js";
import { createSuperAdminNotification } from "../../superadmin-notifications/superadminNotification.service.js";
import { createAuditLog } from "../../audit/audit.service.js";

// ===========Tenant Registration Service (with Auto-Login)===========
export const registerTenantService = async (data) => {
  const {
    tenantName,
    email,
    password,
    phone,
    address,
    firstName,
    lastName,
    websiteUrl,
    industry,
    companySize,
    country,
  } = data;

  const resolvedTenantName =
    tenantName ||
    (firstName
      ? `${firstName}'s Workspace`
      : (email ? email.split("@")[0] : "My") + "'s Workspace");
  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  const [emailExistsInTenant, emailExistsInUser, emailExistsInSuperAdmin] =
    await Promise.all([
      prisma.tenant.findUnique({ where: { email } }),
      prisma.user.findUnique({ where: { email } }),
      prisma.superAdmin.findUnique({ where: { email } }),
    ]);

  if (emailExistsInTenant || emailExistsInUser || emailExistsInSuperAdmin) {
    throw new Error("Email is already registered on the platform");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const tenant = await prisma.tenant.create({
    data: {
      tenantName: resolvedTenantName,
      email,
      password: hashedPassword,
      phone,
      address,
      firstName,
      lastName,
      websiteUrl,
      industry,
      companySize,
      country,
      status: "PENDING",
    },
    include: { subscription: true },
  });
  Object.assign(tenant, tenant?.subscription);

  try {
    const superAdminNotif = await createSuperAdminNotification({
      type: "tenant_registered",
      title: "🆕 New Tenant Registered",
      message: `${resolvedTenantName} (${email}) just signed up`,
      metadata: {
        tenantId: tenant.id,
        tenantName: resolvedTenantName,
        email: tenant.email,
      },
    });

    emitToSuperAdmin("superadmin_notification", {
      notification: {
        id: superAdminNotif.id,
        type: superAdminNotif.type,
        title: superAdminNotif.title,
        message: superAdminNotif.message,
        isRead: superAdminNotif.isRead,
        createdAt: superAdminNotif.createdAt,
        metadata: superAdminNotif.metadata,
      },
    });
    console.log(`📤 SuperAdmin notified: new tenant ${resolvedTenantName}`);
  } catch (err) {
    console.error("❌ SuperAdmin notification failed:", err.message);
  }

  const accessToken = generateAccessToken({
    id: tenant.id,
    email: tenant.email,
    type: "TENANT",
  });

  const refreshToken = generateRefreshToken({
    id: tenant.id,
    type: "TENANT",
  });

  await saveRefreshToken({
    token: refreshToken,
    tenantId: tenant.id,
  });

  const { password: _, ...safeTenant } = tenant;

  return {
    message: "Tenant registered successfully",
    data: {
      user: {
        id: safeTenant.id,
        name: safeTenant.tenantName,
        email: safeTenant.email,
        type: "TENANT",
        status: safeTenant.status,
        planId: safeTenant.planId,
        planStatus: safeTenant.planStatus,
        billingType: safeTenant.billingType,
        tenantName: safeTenant.tenantName,
        firstName: safeTenant.firstName,
        lastName: safeTenant.lastName,
        onboardingStep: safeTenant.onboardingStep,
        onboardingCompleted: safeTenant.onboardingCompleted,
      },
      accessToken,
      refreshToken,
    },
  };
};

// ===========Tenant Login Service===========
export const loginTenantService = async (data, meta = {}) => {
  const { email, password } = data;
  const { ipAddress, userAgent } = meta;

  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { email },
    include: { subscription: true },
  });

  if (!tenant) {
    await createAuditLog({
      actorId: "UNKNOWN",
      actorType: "TENANT",
      actorName: "Unknown",
      actorEmail: email,
      action: "LOGIN_FAILED",
      module: "AUTH",
      description: `Failed tenant login — email not found: ${email}`,
      ipAddress,
      userAgent,
    });
    throw new Error("Invalid credentials");
  }

  if (tenant.status === "BLOCKED") {
    await createAuditLog({
      actorId: tenant.id,
      actorType: "TENANT",
      actorName: tenant.tenantName || tenant.email,
      actorEmail: tenant.email,
      action: "LOGIN_FAILED",
      module: "AUTH",
      description: `Blocked tenant tried to login`,
      ipAddress,
      userAgent,
      tenantId: tenant.id,
    });
    throw new Error("Your account is blocked. Contact support.");
  }

  if (!tenant.isActive) {
    await createAuditLog({
      actorId: tenant.id,
      actorType: "TENANT",
      actorName: tenant.tenantName || tenant.email,
      actorEmail: tenant.email,
      action: "LOGIN_FAILED",
      module: "AUTH",
      description: `Deactivated tenant tried to login`,
      ipAddress,
      userAgent,
      tenantId: tenant.id,
    });
    throw new Error("Your account has been deactivated");
  }

  if (!tenant.password) {
    throw new Error(
      "This account uses Google Sign-In. Please log in with Google.",
    );
  }

  const isPasswordMatch = await bcrypt.compare(password, tenant.password);

  console.log("Password match result:", isPasswordMatch);
  console.log("Password received:", password);
  console.log("Tenant password hash:", tenant.password);

  if (!isPasswordMatch) {
    await createAuditLog({
      actorId: tenant.id,
      actorType: "TENANT",
      actorName: tenant.tenantName || tenant.email,
      actorEmail: tenant.email,
      action: "LOGIN_FAILED",
      module: "AUTH",
      description: `Failed tenant login — wrong password`,
      ipAddress,
      userAgent,
      tenantId: tenant.id,
    });
    throw new Error("Invalid credentials");
  }

  const accessToken = generateAccessToken({
    id: tenant.id,
    email: tenant.email,
    name: tenant.tenantName,
    type: "TENANT",
  });

  const refreshToken = generateRefreshToken({
    id: tenant.id,
    type: "TENANT",
  });

  await saveRefreshToken({ token: refreshToken, tenantId: tenant.id });

  await createAuditLog({
    actorId: tenant.id,
    actorType: "TENANT",
    actorName: tenant.tenantName || tenant.email,
    actorEmail: tenant.email,
    action: "LOGIN",
    module: "AUTH",
    description: `Tenant "${tenant.tenantName}" logged in successfully`,
    ipAddress,
    userAgent,
    tenantId: tenant.id,
  });

  Object.assign(tenant, tenant?.subscription);
  const { password: _, ...safeTenant } = tenant;
  return {
    message: "Login successful",
    accessToken,
    refreshToken,
    user: {
      id: safeTenant.id,
      name: safeTenant.tenantName,
      email: safeTenant.email,
      phone: safeTenant.phone,
      address: safeTenant.address,
      type: "TENANT",
      status: safeTenant.status,
      planId: safeTenant.planId,
      planStatus: safeTenant.planStatus,
      billingType: safeTenant.billingType,
      onboardingStep: safeTenant.onboardingStep,
      onboardingCompleted: safeTenant.onboardingCompleted,
      firstName: safeTenant.firstName,
      lastName: safeTenant.lastName,
    },
  };
};

//=========== Tenant Logout Service===========
export const logoutTenantService = async (refreshToken, meta = {}) => {
  if (!refreshToken) {
    throw new Error("Refresh token required");
  }

  const tokenRecord = await prisma.refreshToken.findFirst({
    where: { token: refreshToken },
    include: {
      tenant: { select: { id: true, tenantName: true, email: true } },
      user: { select: { id: true, name: true, email: true, tenantId: true } },
    },
  });

  await deleteRefreshToken(refreshToken);

  if (tokenRecord?.tenant) {
    await createAuditLog({
      actorId: tokenRecord.tenant.id,
      actorType: "TENANT",
      actorName: tokenRecord.tenant.tenantName || tokenRecord.tenant.email,
      actorEmail: tokenRecord.tenant.email,
      action: "LOGOUT",
      module: "AUTH",
      description: `Tenant "${tokenRecord.tenant.tenantName}" logged out`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      tenantId: tokenRecord.tenant.id,
    });
  } else if (tokenRecord?.user) {
    await createAuditLog({
      actorId: tokenRecord.user.id,
      actorType: "USER",
      actorName: tokenRecord.user.name,
      actorEmail: tokenRecord.user.email,
      action: "LOGOUT",
      module: "AUTH",
      description: `User "${tokenRecord.user.name}" logged out`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      tenantId: tokenRecord.user.tenantId,
    });
  }

  return { message: "Logout successful" };
};

//=========== Tenant Refresh Access Token Service===========
export const refreshTenantAccessTokenService = async (refreshToken) => {
  if (!refreshToken) {
    throw new Error("Refresh token required");
  }

  const tokenRecord = await findRefreshToken(refreshToken, "TENANT");

  if (!tokenRecord) {
    throw new Error("Invalid refresh token");
  }

  if (tokenRecord.expiresAt < new Date()) {
    throw new Error("Refresh token expired, please login again");
  }

  try {
    verifyRefreshToken(refreshToken);
  } catch (error) {
    throw new Error("Invalid refresh token");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tokenRecord.tenantId },
    include: { subscription: true },
  });

  if (!tenant) {
    throw new Error("Tenant not found");
  }
  Object.assign(tenant, tenant?.subscription);

  const newAccessToken = generateAccessToken({
    id: tenant.id,
    email: tenant.email,
    type: "TENANT",
  });

  return {
    message: "Token refreshed successfully",
    accessToken: newAccessToken,
    user: {
      id: tenant.id,
      name: tenant.tenantName,
      tenantName: tenant.tenantName,
      firstName: tenant.firstName,
      lastName: tenant.lastName,
      email: tenant.email,
      phone: tenant.phone,
      address: tenant.address,
      onboardingStep: tenant.onboardingStep,
      onboardingCompleted: tenant.onboardingCompleted,
      planId: tenant.planId,
      planStatus: tenant.planStatus,
      isActive: tenant.isActive,
      type: "TENANT",
    },
  };
};

// ===================== FORGOT PASSWORD =====================
export const forgotPasswordTenantService = async (email) => {
  return await forgotPasswordService(email, "TENANT");
};

// ===================== RESET PASSWORD =====================
export const resetPasswordTenantService = async (
  token,
  newPassword,
  confirmPassword,
) => {
  return await resetPasswordService(
    token,
    newPassword,
    confirmPassword,
    "TENANT",
  );
};

// =========== Google Sign-In & On-the-Fly Registration Service ===========
const googleClient = new OAuth2Client();

export const loginOrRegisterWithGoogleService = async (credential) => {
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: [
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_ID_MOBILE,
    ].filter(Boolean),
  });

  const payload = ticket.getPayload();
  if (!payload) {
    throw new Error("Invalid Google Token payload");
  }

  const {
    email,
    name,
    given_name: firstName,
    family_name: lastName,
    sub: googleId,
  } = payload;

  let tenant = await prisma.tenant.findUnique({
    where: { email },
    include: { auth: true, subscription: true },
  });
  let user = await prisma.user.findUnique({ where: { email } });

  if (!tenant) {
    tenant = await prisma.tenant.findUnique({
      where: { auth: { googleId } },
      include: { auth: true, subscription: true },
    });
  }
  if (tenant) Object.assign(tenant, tenant?.auth, tenant?.subscription);

  if (user) {
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      type: "USER",
    });
    const refreshToken = generateRefreshToken({ id: user.id, type: "USER" });
    await saveRefreshToken({ token: refreshToken, userId: user.id });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        type: "USER",
        status: "APPROVED",
      },
      accessToken,
      refreshToken,
    };
  }

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        tenantName: name ? `${name}'s Workspace` : "Google Workspace",
        email,
        firstName,
        lastName,
        status: "APPROVED",
        onboardingStep: 5,
        onboardingCompleted: true,
        auth: {
          create: { googleId, authProvider: "GOOGLE" },
        },
      },
      include: { auth: true, subscription: true },
    });
    tenant = { ...tenant, ...tenant.auth, ...tenant.subscription };
  } else {
    if (tenant.authProvider !== "GOOGLE" || !tenant.googleId) {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          ...(tenant.email ? {} : { email }),
          onboardingStep: 5,
          onboardingCompleted: true,
        },
      });
      await prisma.tenantAuth.upsert({
        where: { tenantId: tenant.id },
        update: { googleId, authProvider: "GOOGLE" },
        create: { tenantId: tenant.id, googleId, authProvider: "GOOGLE" },
      });
      tenant = await prisma.tenant.findUnique({
        where: { id: tenant.id },
        include: { auth: true, subscription: true },
      });
      tenant = { ...tenant, ...tenant.auth, ...tenant.subscription };
    }
  }

  const accessToken = generateAccessToken({
    id: tenant.id,
    email: tenant.email,
    type: "TENANT",
  });
  const refreshToken = generateRefreshToken({ id: tenant.id, type: "TENANT" });
  await saveRefreshToken({ token: refreshToken, tenantId: tenant.id });

  return {
    user: {
      id: tenant.id,
      name: tenant.tenantName,
      email: tenant.email,
      type: "TENANT",
      status: tenant.status,
      planId: tenant.planId,
      planStatus: tenant.planStatus,
      billingType: tenant.billingType,
      onboardingStep: tenant.onboardingStep,
      onboardingCompleted: tenant.onboardingCompleted,
      firstName: tenant.firstName,
      lastName: tenant.lastName,
    },
    accessToken,
    refreshToken,
  };
};

// =========== Facebook Sign-In & On-the-Fly Registration Service ===========
export const loginOrRegisterWithFacebookService = async (accessToken) => {
  let fbData;
  try {
    const response = await axios.get(
      `https://graph.facebook.com/me?fields=id,name,email,first_name,last_name&access_token=${accessToken}`,
    );
    fbData = response.data;
  } catch (error) {
    throw new Error("Invalid Facebook Access Token or Meta API failure");
  }

  const {
    id: facebookId,
    name,
    email: fbEmail,
    first_name: firstName,
    last_name: lastName,
  } = fbData;
  const email = fbEmail || `fb_${facebookId}@sudoreply.local`;

  let tenant = await prisma.tenant.findUnique({
    where: { email },
    include: { auth: true, subscription: true },
  });
  let user = await prisma.user.findUnique({ where: { email } });

  if (!tenant) {
    tenant = await prisma.tenant.findUnique({
      where: { auth: { facebookId } },
      include: { auth: true, subscription: true },
    });
  }
  if (tenant) Object.assign(tenant, tenant?.auth, tenant?.subscription);

  if (user) {
    const jwtAccessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      type: "USER",
    });
    const jwtRefreshToken = generateRefreshToken({ id: user.id, type: "USER" });
    await saveRefreshToken({ token: jwtRefreshToken, userId: user.id });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        type: "USER",
        status: "APPROVED",
      },
      accessToken: jwtAccessToken,
      refreshToken: jwtRefreshToken,
    };
  }

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        tenantName: name ? `${name}'s Workspace` : "Facebook Workspace",
        email,
        firstName,
        lastName,
        status: "APPROVED",
        onboardingStep: 5,
        onboardingCompleted: true,
        auth: {
          create: { facebookId, authProvider: "FACEBOOK" },
        },
      },
      include: { auth: true, subscription: true },
    });
    tenant = { ...tenant, ...tenant.auth, ...tenant.subscription };
  } else {
    if (tenant.authProvider !== "FACEBOOK" || !tenant.facebookId) {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          ...(tenant.email ? {} : { email }),
          onboardingStep: 5,
          onboardingCompleted: true,
        },
      });
      await prisma.tenantAuth.upsert({
        where: { tenantId: tenant.id },
        update: { facebookId, authProvider: "FACEBOOK" },
        create: { tenantId: tenant.id, facebookId, authProvider: "FACEBOOK" },
      });
      tenant = await prisma.tenant.findUnique({
        where: { id: tenant.id },
        include: { auth: true, subscription: true },
      });
      tenant = { ...tenant, ...tenant.auth, ...tenant.subscription };
    }
  }

  const jwtAccessToken = generateAccessToken({
    id: tenant.id,
    email: tenant.email,
    type: "TENANT",
  });
  const jwtRefreshToken = generateRefreshToken({
    id: tenant.id,
    type: "TENANT",
  });
  await saveRefreshToken({ token: jwtRefreshToken, tenantId: tenant.id });

  return {
    user: {
      id: tenant.id,
      name: tenant.tenantName,
      email: tenant.email,
      type: "TENANT",
      status: tenant.status,
      planId: tenant.planId,
      planStatus: tenant.planStatus,
      billingType: tenant.billingType,
      onboardingStep: tenant.onboardingStep,
      onboardingCompleted: tenant.onboardingCompleted,
      firstName: tenant.firstName,
      lastName: tenant.lastName,
    },
    accessToken: jwtAccessToken,
    refreshToken: jwtRefreshToken,
  };
};
