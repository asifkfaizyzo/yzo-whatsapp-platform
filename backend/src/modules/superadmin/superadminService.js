import bcrypt from 'bcrypt';
import prisma from '../../config/prisma.js';
import jwt from 'jsonwebtoken';

import { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken } from '../auth/jwtservice.js';
import { saveRefreshToken, deleteRefreshToken, findRefreshToken } from '../auth/refreshtokenService.js';
import { generateResetToken, getResetTokenExpiry, sendPasswordResetEmail, } from '../auth/emailService.js';
import { forgotPasswordService, resetPasswordService, } from '../auth/passwordService.js';
import { createAuditLog } from '../audit/auditLogService.js';


//===========SuperAdmin creation Service===========//
export const createSuperAdminService = async (data) => {
  const { name, email, password } = data;

  if (!name || !email || !password) {
    throw new Error('Name, email and password are required');
  }

  const [emailExistsInTenant, emailExistsInUser, emailExistsInSuperAdmin] = await Promise.all([
    prisma.tenant.findUnique({ where: { email } }),
    prisma.user.findUnique({ where: { email } }),
    prisma.superAdmin.findUnique({ where: { email } }),
  ]);

  if (emailExistsInTenant || emailExistsInUser || emailExistsInSuperAdmin) {
    throw new Error('Email is already registered on the platform');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const superAdmin = await prisma.superAdmin.create({
    data: { name, email, password: hashedPassword },
  });

  const accessToken = generateAccessToken({
    id:    superAdmin.id,
    email: superAdmin.email,
    name:  superAdmin.name,
    type:  'SUPERADMIN',
  });

  const refreshToken = generateRefreshToken({
    id:   superAdmin.id,
    type: 'SUPERADMIN',
  });

  await saveRefreshToken({
    token:        refreshToken,
    superAdminId: superAdmin.id,
  });

  const { password: _, ...safeSuperAdmin } = superAdmin;

  return {
    message:    'SuperAdmin registered successfully',
    superAdmin: safeSuperAdmin,
    user: {
      id:    safeSuperAdmin.id,
      name:  safeSuperAdmin.name,
      email: safeSuperAdmin.email,
      type:  'SUPERADMIN',
    },
    accessToken,
    refreshToken,
  };
};


//===========SuperAdmin Login Service with audit===========
export const loginSuperAdminService = async (data, meta = {}) => {
  const { email, password }      = data;
  const { ipAddress, userAgent } = meta;

  if (!email || !password) throw new Error('Email and password are required');

  const superAdmin = await prisma.superAdmin.findUnique({ where: { email } });

  if (!superAdmin) {
    await createAuditLog({
      actorId:     'UNKNOWN',
      actorType:   'SUPER_ADMIN',
      actorName:   'Unknown',
      actorEmail:  email,
      action:      'LOGIN_FAILED',
      module:      'AUTH',
      description: `Failed login attempt — email not found: ${email}`,
      ipAddress,
      userAgent,
    });
    throw new Error('Invalid credentials');
  }

  const isPasswordMatch = await bcrypt.compare(password, superAdmin.password);

  if (!isPasswordMatch) {
    await createAuditLog({
      actorId:     superAdmin.id,
      actorType:   'SUPER_ADMIN',
      actorName:   superAdmin.name,
      actorEmail:  superAdmin.email,
      action:      'LOGIN_FAILED',
      module:      'AUTH',
      description: `Failed login attempt — wrong password`,
      ipAddress,
      userAgent,
    });
    throw new Error('Invalid credentials');
  }

  const accessToken  = generateAccessToken({
    id:    superAdmin.id,
    email: superAdmin.email,
    name:  superAdmin.name,
    type:  'SUPERADMIN',
  });
  const refreshToken = generateRefreshToken({
    id:   superAdmin.id,
    type: 'SUPERADMIN',
  });
  await saveRefreshToken({ token: refreshToken, superAdminId: superAdmin.id });

  await createAuditLog({
    actorId:     superAdmin.id,
    actorType:   'SUPER_ADMIN',
    actorName:   superAdmin.name,
    actorEmail:  superAdmin.email,
    action:      'LOGIN',
    module:      'AUTH',
    description: `SuperAdmin logged in successfully`,
    ipAddress,
    userAgent,
  });

  const { password: _, ...safeSuperAdmin } = superAdmin;
  return {
    message:    'Login successful',
    superAdmin: safeSuperAdmin,
    user: {
      id:    safeSuperAdmin.id,
      name:  safeSuperAdmin.name,
      email: safeSuperAdmin.email,
      type:  'SUPERADMIN',
    },
    accessToken,
    refreshToken,
  };
};


//===========logout service for superadmin with audit===========
export const logoutSuperAdminService = async (refreshToken, meta = {}) => {
  if (!refreshToken) throw new Error('Refresh token required');

  const tokenRecord = await prisma.refreshToken.findFirst({
    where:   { token: refreshToken },
    include: {
      superAdmin: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  await deleteRefreshToken(refreshToken);

  if (tokenRecord?.superAdmin) {
    await createAuditLog({
      actorId:     tokenRecord.superAdmin.id,
      actorType:   'SUPER_ADMIN',
      actorName:   tokenRecord.superAdmin.name,
      actorEmail:  tokenRecord.superAdmin.email,
      action:      'LOGOUT',
      module:      'AUTH',
      description: `SuperAdmin "${tokenRecord.superAdmin.name}" logged out`,
      ipAddress:   meta.ipAddress,
      userAgent:   meta.userAgent,
      tenantId:    null,
    });
  }

  return { message: 'Logout successful' };
};


//===========access token refresh service===========
export const refreshAccessTokenService = async (refreshToken) => {
  if (!refreshToken) throw new Error('Refresh token required');

  const tokenRecord = await findRefreshToken(refreshToken, 'SUPERADMIN');
  if (!tokenRecord)                       throw new Error('Invalid refresh token');
  if (tokenRecord.expiresAt < new Date()) throw new Error('Refresh token expired, please login again');

  try {
    verifyRefreshToken(refreshToken);
  } catch (error) {
    throw new Error('Invalid refresh token');
  }

  const superAdmin = await prisma.superAdmin.findUnique({
    where: { id: tokenRecord.superAdminId },
  });
  if (!superAdmin) throw new Error('SuperAdmin not found');

 const newAccessToken = jwt.sign(
  {
    id:    superAdmin.id,
    email: superAdmin.email,
    name:  superAdmin.name,  // ✅ ADD
    type:  'SUPERADMIN',
  },
  process.env.ACCESS_SECRET,
  { expiresIn: '1d' }
);

  return { accessToken: newAccessToken };
};


// ===================== FORGOT PASSWORD =====================
export const forgotPasswordSuperAdminService = async (email) => {
  return await forgotPasswordService(email, 'SUPERADMIN');
};

// ===================== RESET PASSWORD =====================
export const resetPasswordSuperAdminService = async (token, newPassword, confirmPassword) => {
  return await resetPasswordService(token, newPassword, confirmPassword, 'SUPERADMIN');
};


//===========get all tenants by superadmin===========
export const getAllTenantsService = async () => {
  const tenants = await prisma.tenant.findMany({
    select: {
      id:             true,
      tenantName:     true,
      email:          true,
      phone:          true,
      address:        true,
      isActive:       true,
      status:         true,
      createdAt:      true,
      updatedAt:      true,
      planId:         true,
      planStatus:     true,
      billingType:    true,
      planActivatedAt: true,
      plan: {
        select: {
          id:             true,
          name:           true,
          monthlyPrice:   true,
          annualPrice:    true,
          maxAgents:      true,
          maxBroadcasts:  true,
          maxAutomations: true,
          maxCampaigns:   true,
        },
      },
      users: {
        select: {
          id:        true,
          name:      true,
          email:     true,
          isActive:  true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          contacts:   true,
          templates:  true,
          broadcasts: true,
          flows:      true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return {
    message: 'Tenants fetched successfully',
    count:   tenants.length,
    tenants,
  };
};


//===========Get tenant by id===========
export const getTenantByIdService = async (tenantId) => {
  if (!tenantId) throw new Error('Tenant ID is required');

  const tenant = await prisma.tenant.findUnique({
    where:  { id: tenantId },
    select: {
      id:        true,
      tenantName: true,
      email:     true,
      phone:     true,
      address:   true,
      isActive:  true,
      status:    true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!tenant) throw new Error('Tenant not found');

  return { message: 'Tenant fetched successfully', tenant };
};


//===========Update tenant by id===========
export const updateTenantByIdService = async (tenantId, data, actor = null, meta = {}) => {
  if (!tenantId) throw new Error('Tenant ID is required');

  const existingTenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });
  if (!existingTenant) throw new Error('Tenant not found');

  const updateData = {};

  if (data.tenantName)               updateData.tenantName  = data.tenantName;
  if (data.phone !== undefined)      updateData.phone       = data.phone;
  if (data.address !== undefined)    updateData.address     = data.address;
  if (data.websiteUrl !== undefined) updateData.websiteUrl  = data.websiteUrl;
  if (data.industry !== undefined)   updateData.industry    = data.industry;
  if (data.companySize !== undefined) updateData.companySize = data.companySize;
  if (data.country !== undefined)    updateData.country     = data.country;

  if (data.email) {
    const emailExists = await prisma.tenant.findFirst({
      where: { email: data.email, id: { not: tenantId } },
    });
    if (emailExists) throw new Error('Email already in use');
    updateData.email = data.email;
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error('No valid fields to update');
  }

  const updatedTenant = await prisma.tenant.update({
    where:  { id: tenantId },
    data:   updateData,
    select: {
      id:          true,
      tenantName:  true,
      email:       true,
      phone:       true,
      address:     true,
      websiteUrl:  true,
      industry:    true,
      companySize: true,
      country:     true,
      isActive:    true,
      createdAt:   true,
      updatedAt:   true,
    },
  });

  const changedFields = Object.keys(updateData).reduce((acc, key) => {
    acc[key] = {
      from: existingTenant[key] ?? null,
      to:   updateData[key],
    };
    return acc;
  }, {});

  if (actor) {
    await createAuditLog({
      actorId:     actor.id,
      actorType:   'SUPER_ADMIN',
      actorName:   actor.name,
      actorEmail:  actor.email,
      action:      'TENANT_UPDATED',
      module:      'TENANT',
      description: `SuperAdmin "${actor.name}" updated tenant "${existingTenant.tenantName}"`,
      targetId:    existingTenant.id,
      targetType:  'TENANT',
      targetName:  existingTenant.tenantName,
      tenantId:    existingTenant.id,
      ipAddress:   meta.ipAddress,
      userAgent:   meta.userAgent,
      metadata:    { changedFields },
    });
  } else {
    await createAuditLog({
      actorId:     existingTenant.id,
      actorType:   'TENANT',
      actorName:   existingTenant.tenantName || existingTenant.email,
      actorEmail:  existingTenant.email,
      action:      'TENANT_UPDATED',
      module:      'TENANT',
      description: `Tenant "${existingTenant.tenantName}" updated their own profile`,
      targetId:    existingTenant.id,
      targetType:  'TENANT',
      targetName:  existingTenant.tenantName,
      tenantId:    existingTenant.id,
      ipAddress:   meta.ipAddress,
      userAgent:   meta.userAgent,
      metadata:    { changedFields },
    });
  }

  return { message: 'Tenant updated successfully', tenant: updatedTenant };
};


//===========Deactivate tenant===========
export const deactivateTenantService = async (tenantId, actor, meta = {}) => {
  if (!tenantId)  throw new Error('Tenant ID is required');
  if (!actor?.id) throw new Error('Actor (superadmin) is required'); // ✅ GUARD ADDED

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant)          throw new Error('Tenant not found');
  if (!tenant.isActive) throw new Error('Tenant is already deactivated');

  const deactivatedTenant = await prisma.tenant.update({
    where:  { id: tenantId },
    data:   { isActive: false },
    select: { id: true, tenantName: true, email: true, isActive: true, updatedAt: true },
  });

  await prisma.refreshToken.deleteMany({ where: { tenantId } });

  const users   = await prisma.user.findMany({ where: { tenantId }, select: { id: true } });
  const userIds = users.map(u => u.id);

  await prisma.user.updateMany({ where: { tenantId }, data: { isActive: false } });

  if (userIds.length > 0) {
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
  }

  await createAuditLog({
    actorId:     actor.id,
    actorType:   'SUPER_ADMIN',
    actorName:   actor.name,
    actorEmail:  actor.email,
    action:      'TENANT_DEACTIVATED',
    module:      'TENANT',
    description: `Tenant "${tenant.tenantName}" deactivated. All users suspended.`,
    targetId:    tenant.id,
    targetType:  'TENANT',
    targetName:  tenant.tenantName,
    tenantId:    tenant.id,
    ipAddress:   meta.ipAddress,
    userAgent:   meta.userAgent,
    metadata:    { usersDeactivated: userIds.length },
  });

  return { message: 'Tenant and all users deactivated successfully', tenant: deactivatedTenant };
};


//===========Reactivate tenant===========
export const reactivateTenantService = async (tenantId, actor, meta = {}) => {
  if (!tenantId)  throw new Error('Tenant ID is required');
  if (!actor?.id) throw new Error('Actor (superadmin) is required'); // ✅ GUARD ADDED

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant)         throw new Error('Tenant not found');
  if (tenant.isActive) throw new Error('Tenant is already active');

  const reactivatedTenant = await prisma.tenant.update({
    where:  { id: tenantId },
    data:   { isActive: true },
    select: { id: true, tenantName: true, email: true, isActive: true, updatedAt: true },
  });

  await prisma.user.updateMany({ where: { tenantId }, data: { isActive: true } });

  await createAuditLog({
    actorId:     actor.id,
    actorType:   'SUPER_ADMIN',
    actorName:   actor.name,
    actorEmail:  actor.email,
    action:      'TENANT_REACTIVATED',
    module:      'TENANT',
    description: `Tenant "${tenant.tenantName}" reactivated. All users restored.`,
    targetId:    tenant.id,
    targetType:  'TENANT',
    targetName:  tenant.tenantName,
    tenantId:    tenant.id,
    ipAddress:   meta.ipAddress,
    userAgent:   meta.userAgent,
  });

  return { message: 'Tenant and all users reactivated successfully', tenant: reactivatedTenant };
};


//===========Delete tenant===========
export const deleteTenantByIdService = async (tenantId, actor, meta = {}) => {
  if (!tenantId)  throw new Error('Tenant ID is required');
  if (!actor?.id) throw new Error('Actor (superadmin) is required'); // ✅ GUARD ADDED

  const existingTenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!existingTenant) throw new Error('Tenant not found');

  const tenantSnapshot = {
    id:         existingTenant.id,
    tenantName: existingTenant.tenantName,
    email:      existingTenant.email,
    status:     existingTenant.status,
  };

  const users   = await prisma.user.findMany({ where: { tenantId }, select: { id: true } });
  const userIds = users.map(u => u.id);

  const contacts   = await prisma.contact.findMany({ where: { tenantId }, select: { id: true } });
  const contactIds = contacts.map(c => c.id);

  await prisma.$transaction([
    // 1. Tag mappings & tokens
    prisma.userTagMapping.deleteMany({ where: { OR: [{ tenantId }, { userId: { in: userIds } }] } }),
    prisma.refreshToken.deleteMany({  where: { OR: [{ tenantId }, { userId: { in: userIds } }] } }),

    // 2. Messages, activities & conversations (checked by tenantId, contactId, and contact relation)
    prisma.message.deleteMany({
      where: {
        OR: [
          { conversation: { tenantId } },
          { conversation: { contactId: { in: contactIds } } },
          { conversation: { contact: { tenantId } } },
        ],
      },
    }),
    prisma.conversationActivity.deleteMany({
      where: {
        OR: [
          { conversation: { tenantId } },
          { conversation: { contactId: { in: contactIds } } },
          { conversation: { contact: { tenantId } } },
        ],
      },
    }),
    prisma.conversation.deleteMany({
      where: {
        OR: [
          { tenantId },
          { contactId: { in: contactIds } },
          { contact: { tenantId } },
        ],
      },
    }),

    // 3. Broadcasts & recipients
    prisma.broadcastRecipient.deleteMany({
      where: {
        OR: [
          { broadcast: { tenantId } },
          { contactId: { in: contactIds } },
          { contact: { tenantId } },
        ],
      },
    }),
    prisma.broadcastTag.deleteMany({ where: { OR: [{ broadcast: { tenantId } }, { tag: { tenantId } }] } }),
    prisma.broadcast.deleteMany({ where: { OR: [{ tenantId }, { createdById: { in: userIds } }] } }),
    prisma.template.deleteMany({ where: { OR: [{ tenantId }, { createdById: { in: userIds } }] } }),

    // 4. Contacts & Tags
    prisma.contactTagMapping.deleteMany({
      where: {
        OR: [
          { contactId: { in: contactIds } },
          { contact: { tenantId } },
          { tag: { tenantId } },
        ],
      },
    }),
    prisma.contact.deleteMany({ where: { OR: [{ tenantId }, { id: { in: contactIds } }] } }),
    prisma.tag.deleteMany({ where: { tenantId } }),

    // 5. Automation / Flows
    prisma.flowNode.deleteMany({ where: { flow: { tenantId } } }),
    prisma.keywordTrigger.deleteMany({ where: { OR: [{ tenantId }, { flow: { tenantId } }] } }),
    prisma.flow.deleteMany({ where: { tenantId } }),
    prisma.autoReopenConfig.deleteMany({ where: { tenantId } }),

    // 6. Tickets
    prisma.ticketMessage.deleteMany({ where: { OR: [{ ticket: { tenantId } }, { tenantId }, { userId: { in: userIds } }] } }),
    prisma.ticket.deleteMany({ where: { OR: [{ tenantId }, { userId: { in: userIds } }] } }),

    // 7. Subscriptions, Invoices & Payments
    prisma.subscriptionReminder.deleteMany({ where: { tenantId } }),
    prisma.cancellationSurvey.deleteMany({ where: { tenantId } }),
    prisma.tenantDataDeletion.deleteMany({ where: { tenantId } }),
    prisma.enterpriseLead.deleteMany({ where: { tenantId } }),
    prisma.notification.deleteMany({ where: { OR: [{ tenantId }, { userId: { in: userIds } }] } }),
    prisma.invoice.deleteMany({ where: { tenantId } }),
    prisma.payment.deleteMany({ where: { tenantId } }),

    // 8. Audit logs
    prisma.auditLog.updateMany({
      where: { tenantId },
      data:  { tenantId: null },
    }),

    // 9. Users & Root Tenant
    prisma.user.deleteMany({ where: { tenantId } }),
    prisma.tenant.delete({ where: { id: tenantId } }),
  ]);

  await createAuditLog({
    actorId:     actor.id,
    actorType:   'SUPER_ADMIN',
    actorName:   actor.name,
    actorEmail:  actor.email,
    action:      'TENANT_DELETED',
    module:      'TENANT',
    description: `Tenant "${tenantSnapshot.tenantName}" permanently deleted`,
    targetId:    tenantSnapshot.id,
    targetType:  'TENANT',
    targetName:  tenantSnapshot.tenantName,
    tenantId:    null,
    ipAddress:   meta.ipAddress,
    userAgent:   meta.userAgent,
    metadata: {
      deletedTenant: tenantSnapshot,
      usersDeleted:  userIds.length,
    },
  });

  return { message: 'Tenant and all associated data deleted successfully' };
};


//===========Approve Tenant===========
export const approveTenantService = async (tenantId, actor, meta = {}) => {
  if (!tenantId)  throw new Error('Tenant ID is required');
  if (!actor?.id) throw new Error('Actor (superadmin) is required'); // ✅ GUARD ADDED

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant)                      throw new Error('Tenant not found');
  if (tenant.status === 'APPROVED') throw new Error('Tenant is already approved');

  const approvedTenant = await prisma.tenant.update({
    where:  { id: tenantId },
    data:   { status: 'APPROVED' },
    select: { id: true, tenantName: true, email: true, status: true, updatedAt: true },
  });

  await createAuditLog({
    actorId:     actor.id,
    actorType:   'SUPER_ADMIN',
    actorName:   actor.name,
    actorEmail:  actor.email,
    action:      'TENANT_APPROVED',
    module:      'TENANT',
    description: `Tenant "${tenant.tenantName}" approved`,
    targetId:    tenant.id,
    targetType:  'TENANT',
    targetName:  tenant.tenantName,
    tenantId:    tenant.id,
    ipAddress:   meta.ipAddress,
    userAgent:   meta.userAgent,
    metadata: {
      previousStatus: tenant.status,
      newStatus:      'APPROVED',
    },
  });

  return { message: 'Tenant approved successfully', tenant: approvedTenant };
};


//===========Block tenant===========
export const blockTenantService = async (tenantId, actor, meta = {}) => {
  if (!tenantId)  throw new Error('Tenant ID is required');
  if (!actor?.id) throw new Error('Actor (superadmin) is required'); // ✅ GUARD ADDED

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant)                     throw new Error('Tenant not found');
  if (tenant.status === 'BLOCKED') throw new Error('Tenant is already blocked');

  const blockedTenant = await prisma.tenant.update({
    where:  { id: tenantId },
    data:   { status: 'BLOCKED' },
    select: { id: true, tenantName: true, email: true, status: true, updatedAt: true },
  });

  await prisma.refreshToken.deleteMany({ where: { tenantId } });

  const users   = await prisma.user.findMany({ where: { tenantId }, select: { id: true } });
  const userIds = users.map(u => u.id);

  if (userIds.length > 0) {
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
  }

  await createAuditLog({
    actorId:     actor.id,
    actorType:   'SUPER_ADMIN',
    actorName:   actor.name,
    actorEmail:  actor.email,
    action:      'TENANT_BLOCKED',
    module:      'TENANT',
    description: `Tenant "${tenant.tenantName}" blocked. All sessions terminated.`,
    targetId:    tenant.id,
    targetType:  'TENANT',
    targetName:  tenant.tenantName,
    tenantId:    tenant.id,
    ipAddress:   meta.ipAddress,
    userAgent:   meta.userAgent,
    metadata: {
      previousStatus: tenant.status,
      usersAffected:  userIds.length,
    },
  });

  return { message: 'Tenant blocked. All sessions terminated.', tenant: blockedTenant };
};


//===========Unblock tenant===========
export const unblockTenantService = async (tenantId, actor, meta = {}) => {
  if (!tenantId)  throw new Error('Tenant ID is required');
  if (!actor?.id) throw new Error('Actor (superadmin) is required'); // ✅ GUARD ADDED

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant)                     throw new Error('Tenant not found');
  if (tenant.status !== 'BLOCKED') throw new Error('Tenant is not blocked');

  const unblockedTenant = await prisma.tenant.update({
    where:  { id: tenantId },
    data:   { status: 'APPROVED' },
    select: { id: true, tenantName: true, email: true, status: true, updatedAt: true },
  });

  await createAuditLog({
    actorId:     actor.id,
    actorType:   'SUPER_ADMIN',
    actorName:   actor.name,
    actorEmail:  actor.email,
    action:      'TENANT_UNBLOCKED',
    module:      'TENANT',
    description: `Tenant "${tenant.tenantName}" unblocked`,
    targetId:    tenant.id,
    targetType:  'TENANT',
    targetName:  tenant.tenantName,
    tenantId:    tenant.id,
    ipAddress:   meta.ipAddress,
    userAgent:   meta.userAgent,
    metadata: {
      previousStatus: 'BLOCKED',
      newStatus:      'APPROVED',
    },
  });

  return { message: 'Tenant unblocked successfully', tenant: unblockedTenant };
};


//===========Deactivate user by superadmin===========
export const deactivateUserService = async (userId, actor, meta = {}) => {
  if (!userId)    throw new Error('User ID is required');
  if (!actor?.id) throw new Error('Actor (superadmin) is required'); // ✅ GUARD ADDED

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user)          throw new Error('User not found');
  if (!user.isActive) throw new Error('User is already deactivated');

  const deactivatedUser = await prisma.user.update({
    where:  { id: userId },
    data:   { isActive: false },
    select: { id: true, name: true, email: true, isActive: true, tenantId: true },
  });

  await prisma.refreshToken.deleteMany({ where: { userId } });

  await createAuditLog({
    actorId:     actor.id,
    actorType:   'SUPER_ADMIN',
    actorName:   actor.name,
    actorEmail:  actor.email,
    action:      'USER_DEACTIVATED',
    module:      'USER',
    description: `User "${user.name}" deactivated. Session terminated.`,
    targetId:    user.id,
    targetType:  'USER',
    targetName:  user.name,
    tenantId:    user.tenantId,
    ipAddress:   meta.ipAddress,
    userAgent:   meta.userAgent,
    metadata:    { userEmail: user.email },
  });

  return { message: 'User deactivated successfully', user: deactivatedUser };
};


//===========Reactivate user by superadmin===========
export const reactivateUserService = async (userId, actor, meta = {}) => {
  if (!userId)    throw new Error('User ID is required');
  if (!actor?.id) throw new Error('Actor (superadmin) is required'); // ✅ GUARD ADDED

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user)         throw new Error('User not found');
  if (user.isActive) throw new Error('User is already active');

  const reactivatedUser = await prisma.user.update({
    where:  { id: userId },
    data:   { isActive: true },
    select: { id: true, name: true, email: true, isActive: true, tenantId: true },
  });

  await createAuditLog({
    actorId:     actor.id,
    actorType:   'SUPER_ADMIN',
    actorName:   actor.name,
    actorEmail:  actor.email,
    action:      'USER_REACTIVATED',
    module:      'USER',
    description: `User "${user.name}" reactivated`,
    targetId:    user.id,
    targetType:  'USER',
    targetName:  user.name,
    tenantId:    user.tenantId,
    ipAddress:   meta.ipAddress,
    userAgent:   meta.userAgent,
    metadata:    { userEmail: user.email },
  });

  return { message: 'User reactivated successfully', user: reactivatedUser };
};


// ══════════════════════════════════════════
// REVENUE
// ══════════════════════════════════════════
export const getRevenueStatsService = async () => {
  const payments = await prisma.payment.findMany({
    where:   { status: 'SUCCESS' },
    include: {
      tenant: {
        select: { id: true, tenantName: true, email: true, planStatus: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const totalRevenue = payments.reduce((sum, p) => sum + p.totalAmount, 0);
  const totalGST     = payments.reduce((sum, p) => sum + p.gstAmount,   0);
  const totalBase    = payments.reduce((sum, p) => sum + p.baseAmount,  0);

  const now            = new Date();
  const startOfMonth   = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth   = new Date(now.getFullYear(), now.getMonth(), 0);

  const thisMonthRevenue = payments
    .filter(p => new Date(p.createdAt) >= startOfMonth)
    .reduce((sum, p) => sum + p.totalAmount, 0);

  const lastMonthRevenue = payments
    .filter(p => new Date(p.createdAt) >= startOfLastMonth && new Date(p.createdAt) <= endOfLastMonth)
    .reduce((sum, p) => sum + p.totalAmount, 0);

  const activeTenants = await prisma.tenant.count({
    where: { planStatus: 'active' },
  });

  const planDistribution = await prisma.tenant.groupBy({
    by:    ['planId'],
    where: { planStatus: 'active', planId: { not: null } },
    _count: { planId: true },
  });

  const planIds = planDistribution.map(p => p.planId).filter(Boolean);
  const plans   = await prisma.subscriptionPlan.findMany({
    where:  { id: { in: planIds } },
    select: { id: true, name: true, monthlyPrice: true },
  });

  const planDistributionWithNames = planDistribution.map(p => {
    const plan = plans.find(pl => pl.id === p.planId);
    return {
      planId:       p.planId,
      planName:     plan?.name || 'Unknown',
      count:        p._count.planId,
      monthlyPrice: plan?.monthlyPrice || 0,
    };
  });

  const mrr = planDistributionWithNames.reduce((sum, p) => sum + p.monthlyPrice * p.count, 0);
  const arr  = mrr * 12;

  return {
    totalRevenue:      parseFloat(totalRevenue.toFixed(2)),
    totalGST:          parseFloat(totalGST.toFixed(2)),
    totalBase:         parseFloat(totalBase.toFixed(2)),
    thisMonthRevenue:  parseFloat(thisMonthRevenue.toFixed(2)),
    lastMonthRevenue:  parseFloat(lastMonthRevenue.toFixed(2)),
    totalPayments:     payments.length,
    activeTenants,
    mrr:               parseFloat(mrr.toFixed(2)),
    arr:               parseFloat(arr.toFixed(2)),
    planDistribution:  planDistributionWithNames,
  };
};


export const getAllPaymentsService = async () => {
  return prisma.payment.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      tenant: {
        select: { id: true, tenantName: true, email: true, phone: true },
      },
    },
  });
};


export const getTenantBillingService = async (tenantId) => {
  const tenant = await prisma.tenant.findUnique({
    where:   { id: tenantId },
    include: {
      plan: {
        select: { id: true, name: true, monthlyPrice: true, annualPrice: true, maxAgents: true },
      },
    },
  });
  if (!tenant) throw new Error('Tenant not found');

  const payments = await prisma.payment.findMany({
    where:   { tenantId },
    orderBy: { createdAt: 'desc' },
  });

  let nextRenewalDate = null;
  if (tenant.planActivatedAt && tenant.planStatus === 'active') {
    const activatedAt = new Date(tenant.planActivatedAt);
    nextRenewalDate   = new Date(activatedAt);
    if (tenant.billingType === 'annual') {
      nextRenewalDate.setFullYear(nextRenewalDate.getFullYear() + 1);
    } else {
      nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 1);
    }
  }

  const totalSpent = payments
    .filter(p => p.status === 'SUCCESS')
    .reduce((sum, p) => sum + p.totalAmount, 0);

  return {
    tenant: {
      id:              tenant.id,
      tenantName:      tenant.tenantName,
      email:           tenant.email,
      phone:           tenant.phone,
      status:          tenant.status,
      planStatus:      tenant.planStatus,
      billingType:     tenant.billingType,
      planActivatedAt: tenant.planActivatedAt,
      nextRenewalDate,
      plan:            tenant.plan,
    },
    payments,
    totalSpent: parseFloat(totalSpent.toFixed(2)),
  };
};



// ══════════════════════════════════════════
// GST / TAX SETTINGS
// ══════════════════════════════════════════

// ── Get GST Settings ──
export const getGSTSettingsService = async () => {
  let settings = await prisma.platformSettings.findUnique({
    where: { id: "GLOBAL" },
  });

  if (!settings) {
    settings = await prisma.platformSettings.create({
      data: {
        id:               "GLOBAL",
        gstEnabled:       true,
        gstPercent:       18.0,
        gstType:          "CGST_SGST",
        companyGstNumber: "27AABCU9603R1ZM",
        pricingType:      "EXCLUSIVE",
        companyName:      "SudoReply Technologies Pvt Ltd",
        companyEmail:     "support@sudoreply.com",
        companyAddress:   "Mumbai, Maharashtra, India",
        sacCode:          "998314",
      },
    });
  }

  return settings;
};

// ── Update GST Settings ──
export const updateGSTSettingsService = async (data, actor, meta = {}) => {
  const {
    gstEnabled,
    gstPercent,
    gstType,
    companyGstNumber,
    pricingType,
    companyName,
    companyEmail,
    companyAddress,
    sacCode,
  } = data;

  // ── Validate ──
  if (gstPercent !== undefined) {
    const pct = parseFloat(gstPercent);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      throw new Error("GST percent must be between 0 and 100");
    }
  }

  if (gstType && !["CGST_SGST", "IGST"].includes(gstType)) {
    throw new Error("GST type must be CGST_SGST or IGST");
  }

  if (pricingType && !["EXCLUSIVE", "INCLUSIVE"].includes(pricingType)) {
    throw new Error("Pricing type must be EXCLUSIVE or INCLUSIVE");
  }

  // ── Build update payload ──
  const updateData = {};
  if (gstEnabled !== undefined)       updateData.gstEnabled       = Boolean(gstEnabled);
  if (gstPercent !== undefined)       updateData.gstPercent       = parseFloat(gstPercent);
  if (gstType !== undefined)          updateData.gstType          = gstType;
  if (companyGstNumber !== undefined) updateData.companyGstNumber = companyGstNumber;
  if (pricingType !== undefined)      updateData.pricingType      = pricingType;
  if (companyName !== undefined)      updateData.companyName      = companyName;
  if (companyEmail !== undefined)     updateData.companyEmail     = companyEmail;
  if (companyAddress !== undefined)   updateData.companyAddress   = companyAddress;
  if (sacCode !== undefined)          updateData.sacCode          = sacCode;
  if (actor?.id)                      updateData.updatedBy        = actor.id;

  const updated = await prisma.platformSettings.upsert({
    where:  { id: "GLOBAL" },
    update: updateData,
    create: {
      id:               "GLOBAL",
      gstEnabled:       gstEnabled !== undefined ? Boolean(gstEnabled) : true,
      gstPercent:       gstPercent !== undefined ? parseFloat(gstPercent) : 18.0,
      gstType:          gstType          || "CGST_SGST",
      companyGstNumber: companyGstNumber || "27AABCU9603R1ZM",
      pricingType:      pricingType      || "EXCLUSIVE",
      companyName:      companyName      || "SudoReply Technologies Pvt Ltd",
      companyEmail:     companyEmail     || "support@sudoreply.com",
      companyAddress:   companyAddress   || "Mumbai, Maharashtra, India",
      sacCode:          sacCode          || "998314",
      updatedBy:        actor?.id        || null,
    },
  });

  // ── Audit Log ──
  if (actor?.id) {
    await createAuditLog({
      actorId:     actor.id,
      actorType:   "SUPER_ADMIN",
      actorName:   actor.name,
      actorEmail:  actor.email,
      action:      "GST_SETTINGS_UPDATED",
      module:      "SETTINGS",
      description: `SuperAdmin "${actor.name}" updated GST settings — GST is now ${updated.gstEnabled ? "ENABLED" : "DISABLED"} at ${updated.gstPercent}%`,
      ipAddress:   meta.ipAddress,
      userAgent:   meta.userAgent,
      tenantId:    null,
      metadata: {
        gstEnabled:  updated.gstEnabled,
        gstPercent:  updated.gstPercent,
        gstType:     updated.gstType,
        pricingType: updated.pricingType,
      },
    });
  }

  return updated;
};

// ── Get GST Config Helper (used by other services) ──
export const getGSTConfig = async () => {
  try {
    const settings = await prisma.platformSettings.findUnique({
      where: { id: "GLOBAL" },
    });

    if (!settings) {
      return {
        gstEnabled:       true,
        gstPercent:       18,
        gstType:          "CGST_SGST",
        pricingType:      "EXCLUSIVE",
        companyGstNumber: "27AABCU9603R1ZM",
        companyName:      "SudoReply Technologies Pvt Ltd",
        companyEmail:     "support@sudoreply.com",
        companyAddress:   "Mumbai, Maharashtra, India",
        sacCode:          "998314",
      };
    }

    return {
      gstEnabled:       settings.gstEnabled,
      gstPercent:       settings.gstPercent,
      gstType:          settings.gstType,
      pricingType:      settings.pricingType,
      companyGstNumber: settings.companyGstNumber,
      companyName:      settings.companyName,
      companyEmail:     settings.companyEmail,
      companyAddress:   settings.companyAddress,
      sacCode:          settings.sacCode,
    };
  } catch {
    return {
      gstEnabled:  true,
      gstPercent:  18,
      gstType:     "CGST_SGST",
      pricingType: "EXCLUSIVE",
    };
  }
};

// ── Calculate GST for a base amount ──
export const calculateGST = async (baseAmount) => {
  const config = await getGSTConfig();
  const base   = parseFloat(baseAmount);

  if (!config.gstEnabled) {
    return {
      gstEnabled:  false,
      baseAmount:  base,
      gstPercent:  0,
      gstAmount:   0,
      totalAmount: base,
      gstType:     config.gstType,
    };
  }

  const gstAmount   = parseFloat(((base * config.gstPercent) / 100).toFixed(2));
  const totalAmount = parseFloat((base + gstAmount).toFixed(2));

  return {
    gstEnabled:  true,
    baseAmount:  base,
    gstPercent:  config.gstPercent,
    gstAmount,
    totalAmount,
    gstType:     config.gstType,
  };
};