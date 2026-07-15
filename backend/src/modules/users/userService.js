import bcrypt from 'bcrypt';
import prisma from '../../config/prisma.js';
import jwt from 'jsonwebtoken';

import { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken } from '../auth/jwtservice.js';
import { saveRefreshToken, deleteRefreshToken, findRefreshToken } from '../auth/refreshtokenService.js';
import { forgotPasswordService, resetPasswordService, } from '../auth/passwordService.js';


// =========user Login Service =========
export const loginUserService =
  async (data) => {
    const { email, password } = data;

    // 1️⃣ Check input
    if (!email || !password) {
      throw new Error('Email and password are required');
    }
    // 2️⃣ Find User
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // 3️⃣ Check user exists
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // ── ADDED: Verify user account status ──
    if (!user.isActive) {
      throw new Error('Your user account has been deactivated. Please contact support.');
    }

    // ── ADDED: Verify organization/tenant status ──
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
    });
    if (!tenant || tenant.status === 'BLOCKED' || !tenant.isActive) {
      throw new Error('Your organization account is deactivated or blocked.');
    }
    if (tenant.status === 'PENDING') {
      throw new Error('Your organization account is pending approval.');
    }

    // 4️⃣ Compare password
    const isPasswordMatch =
      await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
      throw new Error('Invalid credentials');
    }


    // 5️⃣ Generate Access Token
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

    // 8️⃣ Remove password
    const {
      password: _, ...safeUser } = user;

    // 9️⃣ Return response
    return {
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: {
        id: safeUser.id,
        name: safeUser.name,
        email: safeUser.email,
        tenantId: safeUser.tenantId,
        type: 'USER',
        status: tenant.status,
      },
    };
  };




// =========user logout service =========
export const logoutUserService = async (refreshToken) => {

  // 1️⃣ Check input
  if (!refreshToken) {
    throw new Error('Refresh token required');
  }

  // 2️⃣ Delete token
  await deleteRefreshToken(refreshToken);

  return {
    message: 'User logged out successfully',
  };
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