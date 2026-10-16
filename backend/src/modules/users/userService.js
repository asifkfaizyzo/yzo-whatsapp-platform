import bcrypt from 'bcrypt';
import prisma from '../../config/prisma.js';
import jwt from 'jsonwebtoken';

import { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken } from '../auth/jwtservice.js';
import { saveRefreshToken, deleteRefreshToken, findRefreshToken } from '../auth/refreshtokenService.js';
import { forgotPasswordService, resetPasswordService, } from '../auth/passwordService.js';

import { createAuditLog } from '../audit/auditLogService.js';

// =========user Login Service =========
export const loginUserService = async (data, meta = {}) => {
  const { email, password }      = data;
  const { ipAddress, userAgent } = meta;

  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // ── User not found ──
  if (!user) {
    await createAuditLog({
      actorId:     'UNKNOWN',
      actorType:   'USER',
      actorName:   'Unknown',
      actorEmail:  email,
      action:      'LOGIN_FAILED',
      module:      'AUTH',
      description: `Failed user login — email not found: ${email}`,
      ipAddress,
      userAgent,
    });
    throw new Error('Invalid credentials');
  }

  // ── User deactivated ──
  if (!user.isActive) {
    await createAuditLog({
      actorId:     user.id,
      actorType:   'USER',
      actorName:   user.name,
      actorEmail:  user.email,
      action:      'LOGIN_FAILED',
      module:      'AUTH',
      description: `Deactivated user tried to login`,
      ipAddress,
      userAgent,
      tenantId:    user.tenantId,
    });
    throw new Error('Your user account has been deactivated. Please contact support.');
  }

  // ── Tenant check ──
  const tenant = await prisma.tenant.findUnique({
  where:  { id: user.tenantId },
  select: {
    id:          true,
    status:      true,
    isActive:    true,
    planId:      true,     
    planStatus:  true,      
    billingType: true,     
  },
});

  if (!tenant || tenant.status === 'BLOCKED' || !tenant.isActive) {
    await createAuditLog({
      actorId:     user.id,
      actorType:   'USER',
      actorName:   user.name,
      actorEmail:  user.email,
      action:      'LOGIN_FAILED',
      module:      'AUTH',
      description: `User login failed — organization blocked or deactivated`,
      ipAddress,
      userAgent,
      tenantId:    user.tenantId,
    });
    throw new Error('Your organization account is deactivated or blocked.');
  }

  if (tenant.status === 'PENDING') {
    throw new Error('Your organization account is pending approval.');
  }

  // ── Wrong password ──
  const isPasswordMatch = await bcrypt.compare(password, user.password);
  if (!isPasswordMatch) {
    await createAuditLog({
      actorId:     user.id,
      actorType:   'USER',
      actorName:   user.name,
      actorEmail:  user.email,
      action:      'LOGIN_FAILED',
      module:      'AUTH',
      description: `Failed user login — wrong password`,
      ipAddress,
      userAgent,
      tenantId:    user.tenantId,
    });
    throw new Error('Invalid credentials');
  }

  // ── Tokens ──
  const accessToken = generateAccessToken({
    id:       user.id,
    email:    user.email,
    name:     user.name,       // ← ADD name
    tenantId: user.tenantId,
    type:     'USER',
  });

  const refreshToken = generateRefreshToken({
    id:       user.id,
    tenantId: user.tenantId,
    type:     'USER',
  });

  await saveRefreshToken({ token: refreshToken, userId: user.id });

  // ── Success audit log ──
  await createAuditLog({
    actorId:     user.id,
    actorType:   'USER',
    actorName:   user.name,
    actorEmail:  user.email,
    action:      'LOGIN',
    module:      'AUTH',
    description: `User "${user.name}" logged in successfully`,
    ipAddress,
    userAgent,
    tenantId:    user.tenantId,
  });

  const { password: _, ...safeUser } = user;
  return {
  message:      'Login successful',
  accessToken,
  refreshToken,
  user: {
    id:          safeUser.id,
    name:        safeUser.name,
    email:       safeUser.email,
    tenantId:    safeUser.tenantId,
    type:        'USER',
    status:      tenant.status,
    isActive:    safeUser.isActive, 
    planId:      tenant.planId,      
    planStatus:  tenant.planStatus,  
    billingType: tenant.billingType, 
  },
};
};



// =========user logout service =========
export const logoutUserService = async (refreshToken, meta = {}) => {
  if (!refreshToken) {
    throw new Error('Refresh token required');
  }

  // ── Find who owns this refresh token ──
  const tokenRecord = await prisma.refreshToken.findFirst({
    where: { token: refreshToken },
    include: {
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

  // ── Log who logged out ──
  if (tokenRecord?.user) {
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

  return { message: 'User logged out successfully' };
};



// =========user access token refresh service =========
export const refreshUserAccessTokenService = async (refreshToken) => {

  // 1️⃣ Check input
  if (!refreshToken) {
    throw new Error('Refresh token required');
  }

  // 2️⃣ Find token in DB
  const tokenRecord = await findRefreshToken(refreshToken, 'USER');

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

  // 5️⃣ Find User
  const user = await prisma.user.findUnique({
    where: { id: tokenRecord.userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  if (!user.isActive) {
    throw new Error('User account is deactivated');
  }

  // 6️⃣ Generate new access token
  const newAccessToken = generateAccessToken({
    id: user.id,
    email: user.email,
    tenantId: user.tenantId,
    type: 'USER',
  });

  // 8️⃣ Return tokens (same refreshToken continues to work)
  return {
    message: 'Token refreshed successfully',
    accessToken: newAccessToken,
    refreshToken: tokenRecord.token,  // Same old refresh token
  };
};



// ===================== FORGOT PASSWORD =====================
export const forgotPasswordUserService = async (email) => {
  return await forgotPasswordService(email, 'USER');
};

// ===================== RESET PASSWORD =====================
export const resetPasswordUserService = async (
  token,
  newPassword,
  confirmPassword
) => {
  return await resetPasswordService(
    token,
    newPassword,
    confirmPassword,
    'USER'
  );
};






// ===================== ASSIGNED CONTACTS =====================
export const getAssignedContacts = async (userId, tenantId, options = {}) => {

  // 🔍 DEBUG: check who is calling API
  // console.log("LOGIN USER ID:", userId);
  // console.log("TENANT ID:", tenantId);

  const page = options.page || 1;
  const limit = options.limit || 20;
  const skip = (page - 1) * limit;

  // 🔥 DEBUG: check ALL contacts in DB
  const all = await prisma.contact.findMany();
  // console.log("ALL CONTACTS:", all);
  const totalAll = all.length;
  console.log("TOTAL CONTACTS IN DB:", totalAll);

  const where = {
    assignedTo: userId,
    tenantId: tenantId, // 🔒 Tenant isolation
    isActive: true,
    isBlocked: false,
  };

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      skip,
      take: limit,
      orderBy: [
        { assignedAt: "desc" },
        { updatedAt: "desc" },
      ],
      select: {
        id: true,
        phone: true,
        email: true,
        company: true,
        contactTags: {
          include: {
            tag: true
          }
        },
        countryCode: true,
        whatsappId: true,
        assignedAt: true,
        createdAt: true,
        updatedAt: true,
        tenant: {
          select: { id: true },
        },
      },
    }),

    prisma.contact.count({ where }),
  ]);

  return {
    contacts,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};


// ============================================================
// GET LOGGED-IN USER PROFILE (with tenant info)
// ============================================================
export const getUserProfileService = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      tenantId: true,
      createdAt: true,
      updatedAt: true,
      // 🆕 Include tenant info (for showing logo & company name)
      tenant: {
        select: {
          id: true,
          tenantName: true,
          logo: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  return user;
};


// ============================================================
// UPDATE USER PASSWORD (User changes their own password)
// ============================================================
export const updateUserPasswordService = async (userId, { currentPassword, newPassword, confirmPassword }) => {
  // 1️⃣ Validate input
  if (!currentPassword) {
    throw new Error('Current password is required');
  }
  if (!newPassword || !confirmPassword) {
    throw new Error('New password and confirm password are required');
  }
  if (newPassword !== confirmPassword) {
    throw new Error('New passwords do not match');
  }
  if (newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  // 2️⃣ Find user
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // 3️⃣ Verify current password
  const isPasswordMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isPasswordMatch) {
    throw new Error('Current password is incorrect');
  }

  // 4️⃣ Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // 5️⃣ Update in DB
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  // 6️⃣ Optional: Delete all refresh tokens (force re-login on other devices)
  await prisma.refreshToken.deleteMany({
    where: { userId: userId },
  });

    // ✅ ADD audit log
  await createAuditLog({
    actorId:     user.id,
    actorType:   'USER',
    actorName:   user.name,
    actorEmail:  user.email,
    action:      'PASSWORD_CHANGED',
    module:      'AUTH',
    description: `User "${user.name}" changed their password`,
    tenantId:    user.tenantId,
  });

  return { 
    message: 'Password updated successfully. Please log in again on other devices.' 
  };
};

// ============================================================
// 🆕 UPDATE AGENT AVAILABILITY
// ============================================================
export const updateAvailabilityService = async (userId, status) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { availabilityStatus: status },
    select: {
      id: true,
      name: true,
      availabilityStatus: true,
    },
  });

  return user;
};


// ============================================================
// 🆕 DASHBOARD STATS FOR AGENT
// ============================================================
export const getDashboardStatsService = async (userId, tenantId) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    assignedContacts,
    openConversations,
    unresolvedTickets,
    messagesToday,
    recentConversations,
  ] = await Promise.all([
    // 1. Total active contacts assigned to this agent
    prisma.contact.count({
      where: {
        assignedTo: userId,
        tenantId,
        isActive: true,
        isBlocked: false,
      },
    }),

    // 2. Open conversations for this agent
    prisma.conversation.count({
      where: {
        tenantId,
        contact: { assignedTo: userId },
        status: 'OPEN',
        isArchived: false,
      },
    }),

    // 3. Unresolved tickets for this agent
    prisma.ticket.count({
      where: {
        tenantId,
        userId,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
    }),

    // 4. Outbound messages sent today
    prisma.message.count({
      where: {
        senderId: userId,
        senderType: 'USER',
        direction: 'OUTBOUND',
        createdAt: { gte: todayStart },
      },
    }),

    // 5. Recent conversations for avg response time calculation
    prisma.conversation.findMany({
      where: {
        tenantId,
        contact: { assignedTo: userId },
        firstResponseAt: { not: null },
        incomingAt: { not: null },
        updatedAt: { gte: sevenDaysAgo },
      },
      select: {
        firstResponseAt: true,
        incomingAt: true,
      },
      take: 100,
    }),
  ]);

  // Calculate average first-response time in minutes
  let avgResponseTimeMins = 0;
  if (recentConversations.length > 0) {
    const totalMs = recentConversations.reduce((sum, c) => {
      const diff = new Date(c.firstResponseAt).getTime() - new Date(c.incomingAt).getTime();
      return sum + (diff > 0 ? diff : 0);
    }, 0);
    avgResponseTimeMins = Math.round((totalMs / recentConversations.length / 60000) * 10) / 10;
  }

  return {
    assignedContacts,
    openConversations,
    unresolvedTickets,
    messagesToday,
    avgResponseTimeMins,
  };
};


// ============================================================
// 🆕 GLOBAL UNREAD BADGE COUNT
// ============================================================
export const getUnreadBadgeCountService = async (userId, tenantId) => {
  const [unreadConversations, unreadNotifications] = await Promise.all([
    // Conversations with unread messages assigned to this agent
    prisma.conversation.count({
      where: {
        tenantId,
        contact: { assignedTo: userId },
        isArchived: false,
        unreadCount: { gt: 0 },
      },
    }),

    // Unread notifications for this user
    prisma.notification.count({
      where: {
        tenantId,
        userId,
        isRead: false,
      },
    }),
  ]);

  return {
    unreadConversations,
    unreadNotifications,
    totalBadge: unreadConversations + unreadNotifications,
  };
};