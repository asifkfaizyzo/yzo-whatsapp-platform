
import bcrypt from 'bcrypt';
import prisma from '../../config/prisma.js';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { emitToTenant, emitToUser,emitToSuperAdmin,} from "../../lib/socket.js";
import fs from 'fs';
import path from 'path';

import { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken } from '../auth/jwtservice.js';
import { saveRefreshToken, deleteRefreshToken, findRefreshToken } from '../auth/refreshtokenService.js';
import { generateResetToken, getResetTokenExpiry, sendPasswordResetEmail, } from '../auth/emailService.js';
import { forgotPasswordService, resetPasswordService, } from '../auth/passwordService.js';
import { getOrCreateConversation } from "../../modules/conversations/conversationService.js";
import { AsyncLocalStorage } from 'async_hooks';
import { createNotification } from "../notifications/notificationService.js";
import { checkLimitAccess } from '../../lib/planLimits.js';
import { createSuperAdminNotification } from '../superAdminNotifications/superAdminNotificationService.js';
import { createAuditLog } from '../audit/auditLogService.js';


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
    country
  } = data;

  // 1️⃣ Validate input
  const resolvedTenantName = tenantName || (firstName ? `${firstName}'s Workspace` : (email ? email.split('@')[0] : 'My') + "'s Workspace");
  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  // 2️⃣ Check global email uniqueness (Tenant, User, SuperAdmin)
  const [emailExistsInTenant, emailExistsInUser, emailExistsInSuperAdmin] = await Promise.all([
    prisma.tenant.findUnique({ where: { email } }),
    prisma.user.findUnique({ where: { email } }),
    prisma.superAdmin.findUnique({ where: { email } }),
  ]);

  if (emailExistsInTenant || emailExistsInUser || emailExistsInSuperAdmin) {
    throw new Error('Email is already registered on the platform');
  }

  // 3️⃣ Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // 4️⃣ Create Tenant
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
      status: 'PENDING', // New tenants start as PENDING
    },
  });

  // ✅ Notify SuperAdmin about new tenant registration
  try {
    const superAdminNotif = await createSuperAdminNotification({
      type: 'tenant_registered',
      title: '🆕 New Tenant Registered',
      message: `${resolvedTenantName} (${email}) just signed up`,
      metadata: {
        tenantId: tenant.id,
        tenantName: resolvedTenantName,
        email: tenant.email,
      },
    });

    emitToSuperAdmin('superadmin_notification', {
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
    console.error('❌ SuperAdmin notification failed:', err.message);
  }

  // 5️⃣ Generate JWT Tokens
  const accessToken = generateAccessToken({
    id: tenant.id,
    email: tenant.email,
    type: 'TENANT',
  });

  const refreshToken = generateRefreshToken({
    id: tenant.id,
    type: 'TENANT',
  });

  // 6️⃣ Save refresh token
  await saveRefreshToken({
    token: refreshToken,
    tenantId: tenant.id,
  });

  // 7️⃣ Remove password & refreshToken
  const { password: _, ...safeTenant } = tenant;

  // 8️⃣ Return data
  return {
    message: 'Tenant registered successfully',
    data: {
      user: {
        id: safeTenant.id,
        name: safeTenant.tenantName,
        email: safeTenant.email,
        type: 'TENANT',
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
  const { email, password }      = data;
  const { ipAddress, userAgent } = meta;

  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  const tenant = await prisma.tenant.findUnique({ where: { email } });

  // ── Tenant not found ──
  if (!tenant) {
    await createAuditLog({
      actorId:     'UNKNOWN',
      actorType:   'TENANT',
      actorName:   'Unknown',
      actorEmail:  email,
      action:      'LOGIN_FAILED',
      module:      'AUTH',
      description: `Failed tenant login — email not found: ${email}`,
      ipAddress,
      userAgent,
    });
    throw new Error('Invalid credentials');
  }

  // ── Tenant blocked ──
  if (tenant.status === 'BLOCKED') {
    await createAuditLog({
      actorId:     tenant.id,
      actorType:   'TENANT',
      actorName:   tenant.tenantName || tenant.email,
      actorEmail:  tenant.email,
      action:      'LOGIN_FAILED',
      module:      'AUTH',
      description: `Blocked tenant tried to login`,
      ipAddress,
      userAgent,
      tenantId:    tenant.id,
    });
    throw new Error('Your account is blocked. Contact support.');
  }

  // ── Tenant deactivated ──
  if (!tenant.isActive) {
    await createAuditLog({
      actorId:     tenant.id,
      actorType:   'TENANT',
      actorName:   tenant.tenantName || tenant.email,
      actorEmail:  tenant.email,
      action:      'LOGIN_FAILED',
      module:      'AUTH',
      description: `Deactivated tenant tried to login`,
      ipAddress,
      userAgent,
      tenantId:    tenant.id,
    });
    throw new Error('Your account has been deactivated');
  }

  if (!tenant.password) {
    throw new Error('This account uses Google Sign-In. Please log in with Google.');
  }

  const isPasswordMatch = await bcrypt.compare(password, tenant.password);

  // ── Wrong password ──
  if (!isPasswordMatch) {
    await createAuditLog({
      actorId:     tenant.id,
      actorType:   'TENANT',
      actorName:   tenant.tenantName || tenant.email,
      actorEmail:  tenant.email,
      action:      'LOGIN_FAILED',
      module:      'AUTH',
      description: `Failed tenant login — wrong password`,
      ipAddress,
      userAgent,
      tenantId:    tenant.id,
    });
    throw new Error('Invalid credentials');
  }

  // ── Tokens ──
  const accessToken = generateAccessToken({
    id:    tenant.id,
    email: tenant.email,
    name:  tenant.tenantName,   // ← ADD name
    type:  'TENANT',
  });

  const refreshToken = generateRefreshToken({
    id:   tenant.id,
    type: 'TENANT',
  });

  await saveRefreshToken({ token: refreshToken, tenantId: tenant.id });

  // ── Success audit log ──
  await createAuditLog({
    actorId:     tenant.id,
    actorType:   'TENANT',
    actorName:   tenant.tenantName || tenant.email,
    actorEmail:  tenant.email,
    action:      'LOGIN',
    module:      'AUTH',
    description: `Tenant "${tenant.tenantName}" logged in successfully`,
    ipAddress,
    userAgent,
    tenantId:    tenant.id,
  });

  const { password: _, ...safeTenant } = tenant;
  return {
    message: 'Login successful',
    accessToken,
    refreshToken,
    user: {
      id:                 safeTenant.id,
      name:               safeTenant.tenantName,
      email:              safeTenant.email,
      phone:              safeTenant.phone,
      address:            safeTenant.address,
      type:               'TENANT',
      status:             safeTenant.status,
      planId:             safeTenant.planId,
      planStatus:         safeTenant.planStatus,
      billingType:        safeTenant.billingType,
      onboardingStep:     safeTenant.onboardingStep,
      onboardingCompleted: safeTenant.onboardingCompleted,
      firstName:          safeTenant.firstName,
      lastName:           safeTenant.lastName,
    },
  };
};



//=========== Tenant Logout Service===========
export const logoutTenantService = async (refreshToken, meta = {}) => {
  if (!refreshToken) {
    throw new Error('Refresh token required');
  }

  // ── Find who owns this refresh token ──
  const tokenRecord = await prisma.refreshToken.findFirst({
    where: { token: refreshToken },
    include: {
      tenant: {
        select: {
          id:         true,
          tenantName: true,
          email:      true,
        },
      },
      user: {
        select: {
          id:       true,
          name:     true,
          email:    true,
          tenantId: true,
        },
      },
    },
  });

  // ── Delete token ──
  await deleteRefreshToken(refreshToken);

  // ── Log based on who owned the token ──
  if (tokenRecord?.tenant) {
    await createAuditLog({
      actorId:     tokenRecord.tenant.id,
      actorType:   'TENANT',
      actorName:   tokenRecord.tenant.tenantName || tokenRecord.tenant.email,
      actorEmail:  tokenRecord.tenant.email,
      action:      'LOGOUT',
      module:      'AUTH',
      description: `Tenant "${tokenRecord.tenant.tenantName}" logged out`,
      ipAddress:   meta.ipAddress,
      userAgent:   meta.userAgent,
      tenantId:    tokenRecord.tenant.id,
    });
  } else if (tokenRecord?.user) {
    await createAuditLog({
      actorId:     tokenRecord.user.id,
      actorType:   'USER',
      actorName:   tokenRecord.user.name,
      actorEmail:  tokenRecord.user.email,
      action:      'LOGOUT',
      module:      'AUTH',
      description: `User "${tokenRecord.user.name}" logged out`,
      ipAddress:   meta.ipAddress,
      userAgent:   meta.userAgent,
      tenantId:    tokenRecord.user.tenantId,
    });
  }

  return { message: 'Logout successful' };
};



//=========== Tenant Refresh Access Token Service===========
export const refreshTenantAccessTokenService =
  async (refreshToken) => {
    // Check token
    if (!refreshToken) {
      throw new Error('Refresh token required');
    }

    // 2️⃣ Find token in DB
    const tokenRecord = await findRefreshToken(refreshToken, 'TENANT');

    if (!tokenRecord) {
      throw new Error('Invalid refresh token');
    }

    // 3️⃣ Check expiry in DB
    if (tokenRecord.expiresAt < new Date()) {
      throw new Error('Refresh token expired, please login again');
    }

    // 4️⃣ Verify JWT signature
    try {
      verifyRefreshToken(refreshToken);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }

    // 5️⃣ Find Tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id: tokenRecord.tenantId },
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    // 6️⃣ Generate new access token only
    const newAccessToken = generateAccessToken({
      id: tenant.id,
      email: tenant.email,
      type: 'TENANT',
    });

    // 1️⃣1️⃣ Return new token and user details
    return {
      message: 'Token refreshed successfully',
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
        type: 'TENANT'
      }
    };
  };




// ===================== FORGOT PASSWORD =====================
export const forgotPasswordTenantService = async (email) => {
  return await forgotPasswordService(email, 'TENANT');
};

// ===================== RESET PASSWORD =====================
export const resetPasswordTenantService = async (
  token,
  newPassword,
  confirmPassword
) => {
  return await resetPasswordService(
    token,
    newPassword,
    confirmPassword,
    'TENANT'
  );
};



// ===========create user by tenant services===========
export const createUserService = async (data, tenantId) => {
  const { name, email, password } = data;

  // 1️⃣ Validate input
  if (!name || !email || !password) {
    throw new Error('Name, email and password are required');
  }

  // Plan limit check
  const limitCheck = await checkLimitAccess(tenantId, 'maxAgents');
  if (!limitCheck.allowed) {
    throw new Error(limitCheck.message);
  }
  console.log(data);


  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  console.log("checking emails");
  // 2️⃣ Check global email uniqueness (Tenant, User, SuperAdmin)
  const [emailExistsInTenant, emailExistsInUser, emailExistsInSuperAdmin] = await Promise.all([
    prisma.tenant.findUnique({ where: { email } }),
    prisma.user.findUnique({ where: { email } }),
    prisma.superAdmin.findUnique({ where: { email } }),
  ]);

  if (emailExistsInTenant || emailExistsInUser || emailExistsInSuperAdmin) {
    throw new Error('Email is already registered on the platform');
  }

  // 3️⃣ Hash password
  const hashedPassword = await bcrypt.hash(password, 10);
  console.log("creating user");
  // 5️⃣ Create User under this Tenant
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      tenantId,
      isActive: true,
    },
  });

  // 6️⃣ Generate tokens
  const accessToken = generateAccessToken({
    id: user.id,
    email: user.email,
    tenantId: user.tenantId,
    type: 'USER',
  });

  const refreshToken = generateRefreshToken({
    id: user.id,
    tenantId: user.tenantId,
    type: 'USER',
  });

  // 7️⃣ Save refresh token
  await saveRefreshToken({
    token: refreshToken,
    userId: user.id,
  });

  // 8️⃣ Remove sensitive data
  const { password: _, ...safeUser } = user;
  console.log("return response");
  // 9️⃣ Return data
  return {
    message: 'User created successfully',
    user: {
      id: safeUser.id,
      name: safeUser.name,
      email: safeUser.email,
      tenantId: safeUser.tenantId,
      type: 'USER',
    },
    accessToken,
    refreshToken,
  };
};



//===========Get all users of tenant- tenantcontroller===========
export const getUsersByTenantService = async (tenantId) => {
  // 1️⃣ Validate
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  // 2️⃣ Fetch all users under this tenant (exclude passwords)
  const users = await prisma.user.findMany({
    where: { tenantId: tenantId },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      tenantId: true,
      createdAt: true,
      updatedAt: true,
      // ❌ password is NOT selected
      assignedContacts: {
        select: { id: true }
      }
    },
    orderBy: { createdAt: 'desc', },
  });

  const usersWithCount = users.map(user => ({
    id: user.id,
    name: user.name,
    email: user.email,
    isActive: user.isActive,
    tenantId: user.tenantId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,

    // ✅ The dynamic count you were looking for
    assignedContactCount: user.assignedContacts.length
  }));

  return {
    message: 'Users fetched successfully',
    count: users.length,
    users,
  };
};





//===========Get by-id using tenant-controller===========
export const getUserByIdService = async (userId, tenantId) => {
  // 1️⃣ Validate input
  if (!userId) {
    throw new Error('User ID is required');
  }

  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  // 2️⃣ Find user by id AND tenantId
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      tenantId: tenantId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      tenantId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // 3️⃣ If not found
  if (!user) {
    throw new Error('User not found');
  }

  // 4️⃣ Return user
  return {
    message: 'User fetched successfully',
    user,
  };
};



//===========Update user by id under tenant-controller===========
export const updateUserByIdService = async (userId, tenantId, data) => {

  // 1️⃣ Validate input
  if (!userId) {
    throw new Error('User ID is required');
  }

  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  // 2️⃣ Check if user exists AND belongs to this tenant
  const existingUser = await prisma.user.findFirst({
    where: {
      id: userId,
      tenantId: tenantId,
    },
  });

  if (!existingUser) {
    throw new Error('User not found');
  }

  // 3️⃣ Prepare update data (only allowed fields)
  const updateData = {};

  if (data.name) {
    updateData.name = data.name;
  }

  if (data.email) {
    // Check if email is already taken by another user
    const emailExists = await prisma.user.findFirst({
      where: {
        email: data.email,
        id: { not: userId },  // Exclude current user
      },
    });

    if (emailExists) {
      throw new Error('Email already in use');
    }

    updateData.email = data.email;
  }

  if (typeof data.isActive === 'boolean') {
    if (data.isActive === true && !existingUser.isActive) {
      const limitCheck = await checkLimitAccess(tenantId, 'maxAgents');
      if (!limitCheck.allowed) {
        throw new Error(limitCheck.message);
      }
    }
    updateData.isActive = data.isActive;
  }

  // 4️⃣ Check if there's anything to update
  if (Object.keys(updateData).length === 0) {
    throw new Error('No valid fields to update');
  }

  // 5️⃣ Update user
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      tenantId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    message: 'User updated successfully',
    user: updatedUser,
  };
};





//===========Deactivate user by id (soft delete) under tenant-controller===========
export const deactivateUserByIdService = async (userId, tenantId) => {

  // 1️⃣ Validate input
  if (!userId) {
    throw new Error('User ID is required');
  }

  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  // 2️⃣ Check if user exists AND belongs to this tenant
  const existingUser = await prisma.user.findFirst({
    where: {
      id: userId,
      tenantId: tenantId,
    },
  });

  // 3️⃣ User not found
  if (!existingUser) {
    throw new Error('User not found');
  }

  // 4️⃣ Check if already deactivated
  if (!existingUser.isActive) {
    throw new Error('User is already deactivated');
  }

  // 5️⃣ Deactivate user (set isActive to false)
  const deactivatedUser = await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      tenantId: true,
      updatedAt: true,
    },
  });
  // 6️⃣ Delete their refresh tokens (force logout)
  await prisma.refreshToken.deleteMany({
    where: { userId: userId },
  });
  return {
    message: 'User deactivated successfully',
    user: deactivatedUser,
  };
};




//===========Reactivate User By Tenant - under tenant-controller===========
export const reactivateUserByIdService = async (userId, tenantId) => {

  // 1️⃣ Validate input
  if (!userId) {
    throw new Error('User ID is required');
  }

  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  // Plan limit check
  const limitCheck = await checkLimitAccess(tenantId, 'maxAgents');
  if (!limitCheck.allowed) {
    throw new Error(limitCheck.message);
  }

  // 2️⃣ Check if user exists AND belongs to this tenant
  const existingUser = await prisma.user.findFirst({
    where: {
      id: userId,
      tenantId: tenantId,
    },
  });

  // 3️⃣ User not found
  if (!existingUser) {
    throw new Error('User not found');
  }

  // 4️⃣ Check if already active
  if (existingUser.isActive) {
    throw new Error('User is already active');
  }

  // 5️⃣ Reactivate user (set isActive to true)
  const reactivatedUser = await prisma.user.update({
    where: { id: userId },
    data: { isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      tenantId: true,
      updatedAt: true,
    },
  });

  return {
    message: 'User reactivated successfully',
    user: reactivatedUser,
  };
};





//===========Delete the user record completely from the database.===========
//Delete user by id under tenant-controller
export const deleteUserByIdService = async (userId, tenantId) => {

  // 1️⃣ Validate input
  if (!userId) {
    throw new Error('User ID is required');
  }

  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  // 2️⃣ Check if user exists AND belongs to this tenant
  const existingUser = await prisma.user.findFirst({
    where: {
      id: userId,
      tenantId: tenantId,
    },
  });

  if (!existingUser) {
    throw new Error('User not found');
  }

  await prisma.$transaction(async (tx) => {
    // A. Clean up User Tag Mappings
    await tx.userTagMapping.deleteMany({
      where: { userId }
    });

    // B. Null out user references in Tickets and Ticket Messages
    await tx.ticket.updateMany({
      where: { userId },
      data: { userId: null }
    });

    await tx.ticketMessage.updateMany({
      where: { userId },
      data: { userId: null }
    });

    // C. Null out contact assignments
    await tx.contact.updateMany({
      where: { assignedTo: userId },
      data: { assignedTo: null, assignedAt: null }
    });

    // D. Null out conversation assignments
    await tx.conversation.updateMany({
      where: { assignedTo: userId },
      data: { assignedTo: null }
    });

    // F. Delete refresh tokens
    await tx.refreshToken.deleteMany({
      where: { userId }
    });

    // G. Delete the user
    await tx.user.delete({
      where: { id: userId }
    });
  });

  return {
    message: 'User deleted successfully',
  };
};



//========Get Unassigned Contacts by Tenant ID========
export const getUnassignedContacts = async (tenantId) => {
  // We simply find all contacts where:
  // 1. They belong to this tenant
  // 2. assignedTo is null (no agent has them)
  return await prisma.contact.findMany({
    where: { tenantId, assignedTo: null },
    orderBy: { createdAt: 'desc' }
  });

};



export const assignContactService = async (contactId, userId, tenantId) => {
  // ── 1. Validate contact ──
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, tenantId },
  });
  if (!contact) throw new Error("Contact not found");

  // ── 2. Validate user ──
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: { id: true, name: true },
  });
  if (!user) throw new Error("User not found");

  // ── 3. Assign contact ──
  const updatedContact = await prisma.contact.update({
    where: { id: contactId },
    data: {
      assignedTo: userId,
      assignedAt: new Date(),
    },
  });

  // ── 4. Also update conversation ──
  const conversation = await prisma.conversation.findUnique({
    where: { contactId },
  });

  if (conversation) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { assignedTo: userId },
    });
  }

    // ── 5. Notify agent ──
  try {
    const notification = await createNotification({
      tenantId,
      userId,
      type: "contact_assigned",
      title: "Contact Assigned",
      message: `${contact.name || contact.phone} has been assigned to you`,
      metadata: { contactId, contactName: contact.name || contact.phone },
    });

    const notifPayload = {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
      metadata: notification.metadata,
    };

    // ✅ Emit to tenant room (for admin dashboard)
    emitToTenant(tenantId, "new_notification", { notification: notifPayload });

    // ✅ Emit directly to assigned user (for agent's notification bell)
    emitToUser(userId, "new_notification", { notification: notifPayload });
  

    // ── 6. Emit to user so their inbox refreshes ──
    if (conversation) {
      // Show unread count
      if (conversation.unreadCount > 0) {
        emitToUser(userId, 'unread_count_update', {
          conversationId: conversation.id,
          unreadCount:    conversation.unreadCount,
          contactId:      contact.id,
          contactName:    contact.name || contact.phone,
        });
      }

      // Trigger inbox refresh for the user
      emitToUser(userId, 'conversation_assigned', {
        conversationId: conversation.id,
        contactId:      contact.id,
        contactName:    contact.name || contact.phone,
      });
    }

    // ── 7. Update tenant's unassigned count ──
    const unassignedCount = await prisma.contact.count({
      where: { tenantId, assignedTo: null, isActive: true }
    });

    emitToTenant(tenantId, 'unassigned_contact_update', {
      unassignedCount,
      isNew: false,
      contact: { id: contact.id, name: contact.name, phone: contact.phone },
      conversationId: conversation?.id,
    });

    // ── 8. Send WhatsApp to customer ──
    try {
      const flowEngineModule = await import('../automation/flowEngineService.js');
      const flowEngine = flowEngineModule.default;

      const customerMsg =
        `👋 Hi ${contact.name || 'there'}!\n\n` +
        `You've been connected with *${user.name}*.\n` +
        `They will respond to you shortly. 💬`;

      await flowEngine.sendWhatsAppMessage(tenantId, contact.phone, customerMsg);

      if (conversation) {
        await flowEngine.saveBotMessage(conversation.id, customerMsg);
      }
    } catch (waError) {
      console.error('WhatsApp notify failed:', waError.message);
    }

  } catch (err) {
    console.error('Assignment notification error:', err.message);
  }

  return updatedContact;
};



export const reassignContactService = async (contactId, newUserId, tenantId) => {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, tenantId },
  });
  if (!contact) throw new Error('Contact not found');

  const user = await prisma.user.findFirst({
    where: { id: newUserId, tenantId },
    select: { id: true, name: true },
  });
  if (!user) throw new Error('User not found');

  const updatedContact = await prisma.contact.update({
    where: { id: contactId },
    data: {
      assignedTo: newUserId,
      assignedAt: new Date(),
    },
  });

  const conversation = await prisma.conversation.findUnique({
    where: { contactId },
  });

  if (conversation) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { assignedTo: newUserId },
    });
  }

    try {
    const notification = await createNotification({
      tenantId,
      userId: newUserId,
      type: 'contact_assigned',
      title: 'Contact Reassigned',
      message: `${contact.name || contact.phone} has been assigned to you`,
      metadata: { contactId, contactName: contact.name || contact.phone },
    });

    const notifPayload = {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
      metadata: notification.metadata,
    };

    // ✅ Emit to tenant room
    emitToTenant(tenantId, 'new_notification', { notification: notifPayload });

    // ✅ Emit to new agent's room
    emitToUser(newUserId, 'new_notification', { notification: notifPayload });

    if (conversation) {
      if (conversation.unreadCount > 0) {
        emitToUser(newUserId, 'unread_count_update', {
          conversationId: conversation.id,
          unreadCount:    conversation.unreadCount,
          contactId:      contact.id,
          contactName:    contact.name || contact.phone,
        });
      }

      emitToUser(newUserId, 'conversation_assigned', {
        conversationId: conversation.id,
        contactId:      contact.id,
        contactName:    contact.name || contact.phone,
      });
    }

    try {
      const flowEngineModule = await import('../automation/flowEngineService.js');
      const flowEngine = flowEngineModule.default;

      const customerMsg =
        `👋 Hi ${contact.name || 'there'}!\n\n` +
        `Your conversation has been transferred to *${user.name}*.\n` +
        `They will help you from here. 💬`;

      await flowEngine.sendWhatsAppMessage(tenantId, contact.phone, customerMsg);

      if (conversation) {
        await flowEngine.saveBotMessage(conversation.id, customerMsg);
      }
    } catch (waError) {
      console.error('WhatsApp notify failed:', waError.message);
    }

  } catch (err) {
    console.error('Reassign notification error:', err.message);
  }

  return updatedContact;
};



//========Unassign contact from user under tenant-controller========
export const unassignContactService = async (
  contactId,
  tenantId
) => {
  // 1️⃣ Check contact belongs to tenant
  const contact = await prisma.contact.findFirst({
    where: {
      id: contactId,
      tenantId,
    },
  });

  if (!contact) {
    throw new Error("Contact not found");
  }

  // 2️⃣ Check if already unassigned
  if (!contact.assignedTo) {
    throw new Error("Contact is already unassigned");
  }

  // 3️⃣ Unassign contact
  const updatedContact = await prisma.contact.update({
    where: {
      id: contactId,
    },
    data: {
      assignedTo: null,
      assignedAt: null,
    },
  });

  return updatedContact;
};



//List all conversations for a user
export const listConversations = async (tenantId, options = {}) => {
  const page = options.page || 1;
  const limit = options.limit || 20;
  const skip = (page - 1) * limit;

  // 1️⃣ Fetch conversations
  const conversations = await prisma.conversation.findMany({
    where: {
      tenantId,
    },
    include: {
      contact: true,
      messages: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1, // 🔥 only last message (important for inbox)
      },
    },
    orderBy: {
      updatedAt: "desc", // 🔥 latest chat first (WhatsApp style)
    },
    skip,
    take: limit,
  });

  // 2️⃣ Count total conversations
  const total = await prisma.conversation.count({
    where: { tenantId },
  });

  return {
    conversations,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};


//======== Get or Create Auto-Reopen Configuration for a Tenant ========
export const getAutoReopenConfigService = async (tenantId) => {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  // 1️⃣ Find existing config
  let config = await prisma.autoReopenConfig.findUnique({
    where: { tenantId },
  });

  // 2️⃣ If it doesn't exist, create a default one
  if (!config) {
    config = await prisma.autoReopenConfig.create({
      data: {
        tenantId,
        enabled: true,
        reopenWindowHours: 72,
        maxReopenCount: 5,
        smartFilterEnabled: true,
        assignmentStrategy: 'original_agent',
      },
    });
  }

  return config;
};

//======== Update or Upsert Auto-Reopen Configuration for a Tenant ========
export const updateAutoReopenConfigService = async (tenantId, data) => {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  // Use upsert to safely update or insert the settings
  return await prisma.autoReopenConfig.upsert({
    where: { tenantId },
    update: {
      enabled: data.enabled,
      reopenWindowHours: data.reopenWindowHours,
      maxReopenCount: data.maxReopenCount,
      smartFilterEnabled: data.smartFilterEnabled,
      assignmentStrategy: data.assignmentStrategy,
    },
    create: {
      tenantId,
      enabled: data.enabled ?? true,
      reopenWindowHours: data.reopenWindowHours ?? 72,
      maxReopenCount: data.maxReopenCount ?? 5,
      smartFilterEnabled: data.smartFilterEnabled ?? true,
      assignmentStrategy: data.assignmentStrategy ?? 'original_agent',
    },
  });
};


// Initialize Google OAuth2Client using client ID from env
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// =========== Google Sign-In & On-the-Fly Registration Service ===========
export const loginOrRegisterWithGoogleService = async (credential) => {
  // 1. Verify ID Token with Google
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload) {
    throw new Error('Invalid Google Token payload');
  }

  const { email, name, given_name: firstName, family_name: lastName, sub: googleId } = payload;

  // 2. Check if user or tenant already exists by email OR googleId
  let tenant = await prisma.tenant.findUnique({ where: { email } });
  let user = await prisma.user.findUnique({ where: { email } });

  // Also look up tenant by googleId in case email differs or onboarding was partial
  if (!tenant) {
    tenant = await prisma.tenant.findUnique({ where: { googleId } });
  }

  // Scenario A: User (Agent) already exists with this email
  if (user) {
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      type: 'USER',
    });
    const refreshToken = generateRefreshToken({
      id: user.id,
      type: 'USER',
    });
    await saveRefreshToken({
      token: refreshToken,
      userId: user.id,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        type: 'USER',
        status: 'APPROVED',
      },
      accessToken,
      refreshToken,
    };
  }

  // Scenario B: Tenant does not exist yet (JIT sign up)
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        tenantName: name ? `${name}'s Workspace` : 'Google Workspace',
        email,
        googleId,
        firstName,
        lastName,
        authProvider: 'GOOGLE',
        status: 'APPROVED', // Auto-approve Google-verified signups
        onboardingStep: 4,  // Immediately advance to Step 4 (Company info)
        onboardingCompleted: false,
      },
    });
  } else {
    // Scenario C: Tenant exists but doesn't have Google linked yet (or was found by googleId)
    if (tenant.authProvider !== 'GOOGLE' || !tenant.googleId) {
      tenant = await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          googleId,
          authProvider: 'GOOGLE',
          // Update email if it was missing (e.g. partial onboarding record)
          ...(tenant.email ? {} : { email }),
        },
      });
    }
  }

  // 3. Issue Token credentials
  const accessToken = generateAccessToken({
    id: tenant.id,
    email: tenant.email,
    type: 'TENANT',
  });
  const refreshToken = generateRefreshToken({
    id: tenant.id,
    type: 'TENANT',
  });
  await saveRefreshToken({
    token: refreshToken,
    tenantId: tenant.id,
  });

  return {
    user: {
      id: tenant.id,
      name: tenant.tenantName,
      email: tenant.email,
      type: 'TENANT',
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



//Update tenant password
export const updateTenantPasswordService = async (
  tenantId,
  { currentPassword, newPassword, confirmPassword }
) => {
  if (!newPassword || !confirmPassword) {
    throw new Error('New password and confirm password are required');
  }
  if (newPassword !== confirmPassword) {
    throw new Error('Passwords do not match');
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  if (tenant.password) {
    if (!currentPassword) {
      throw new Error('Current password is required to change password');
    }
    const isPasswordMatch = await bcrypt.compare(currentPassword, tenant.password);
    if (!isPasswordMatch) {
      throw new Error('Incorrect current password');
    }
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { password: hashedPassword },
  });

  // ─────────────────────────────────────────────
  // 🔍 DEBUG BLOCK - remove after fix confirmed
  // ─────────────────────────────────────────────
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 STEP 1 - Reached audit log section');
  console.log('🔍 tenant.id      :', tenant.id);
  console.log('🔍 tenant.email   :', tenant.email);
  console.log('🔍 tenant.tenantName:', tenant.tenantName);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const auditPayload = {
      actorId:     tenant.id,
      actorType:   'TENANT',
      actorName:   tenant.tenantName || tenant.email,
      actorEmail:  tenant.email,
      action:      'PASSWORD_CHANGED',
      module:      'AUTH',
      description: `Tenant "${tenant.tenantName}" changed their password`,
      tenantId:    tenant.id,
    };

    console.log('🔍 STEP 2 - Audit payload:', JSON.stringify(auditPayload, null, 2));

    const auditResult = await createAuditLog(auditPayload);

    console.log('✅ STEP 3 - Audit log created:', auditResult?.id ?? auditResult);
  } catch (auditError) {
    // ⚠️ THIS will show you the EXACT failure reason
    console.error('❌ STEP 3 - Audit log FAILED');
    console.error('❌ Error message :', auditError.message);
    console.error('❌ Error code    :', auditError.code);    // Prisma error code
    console.error('❌ Full error    :', auditError);
  }
  // ─────────────────────────────────────────────

  return { message: 'Password updated successfully' };
};




// =========== Upload Tenant Logo Service ===========
export const uploadTenantLogoService = async (tenantId, file) => {
  if (!tenantId) throw new Error("Tenant ID is required");
  if (!file) throw new Error("No file uploaded");

  // 1️⃣ Find tenant
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });
  if (!tenant) throw new Error("Tenant not found");

  // 2️⃣ Delete old logo file (if exists)
  if (tenant.logo) {
    try {
      // Extract file path from URL (e.g. /uploads/logos/xyz/logo-123.png)
      const oldLogoPath = tenant.logo.replace(/^\/+/, ''); // remove leading slash
      if (fs.existsSync(oldLogoPath)) {
        fs.unlinkSync(oldLogoPath);
      }
    } catch (err) {
      console.error("Failed to delete old logo:", err.message);
      // Don't throw — continue with new upload
    }
  }

  // 3️⃣ Build public URL for the new logo
  const logoUrl = `/${file.path.replace(/\\/g, '/')}`; // normalize for Windows

  // 4️⃣ Update tenant with new logo URL
  const updatedTenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: { logo: logoUrl },
    select: {
      id: true,
      tenantName: true,
      logo: true,
    },
  });

  return {
    message: "Logo uploaded successfully",
    data: {
      logoUrl: updatedTenant.logo,
      tenant: updatedTenant,
    },
  };
};

// =========== Delete Tenant Logo Service ===========
export const deleteTenantLogoService = async (tenantId) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });
  if (!tenant) throw new Error("Tenant not found");
  if (!tenant.logo) throw new Error("No logo to delete");

  // Delete file from disk
  try {
    const logoPath = tenant.logo.replace(/^\/+/, '');
    if (fs.existsSync(logoPath)) {
      fs.unlinkSync(logoPath);
    }
  } catch (err) {
    console.error("Failed to delete logo file:", err.message);
  }

  // Remove from DB
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { logo: null },
  });

  return { message: "Logo removed successfully" };
};