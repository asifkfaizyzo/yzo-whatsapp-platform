import bcrypt from 'bcrypt';
import pkg from '@prisma/client';
import jwt from 'jsonwebtoken';

const { PrismaClient } = pkg;
const prisma = new PrismaClient();


//user Login Service
export const loginUserService =
  async (data) => {
    const { email, password } = data;

    // 1️⃣ Check input
    if (!email || !password) {
    throw new Error(
        'Email and password are required'
      );
    }
    // 2️⃣ Find User
    const user = await prisma.user.findUnique({
        where: { email },
      });

    // 3️⃣ Check user exists
    if (!user) {
      throw new Error(
        'Invalid credentials'
      );
    }

    // 4️⃣ Compare password
    const isPasswordMatch =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!isPasswordMatch) {
     throw new Error(
        'Invalid credentials'
      );
    }

    // 5️⃣ Generate Access Token
    const accessToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
      },
      process.env.ACCESS_SECRET,
      {
        expiresIn: '1d',
      }
    );

    // 6️⃣ Generate Refresh Token
    const refreshToken = jwt.sign(
      {
        id: user.id,
        tenantId: user.tenantId,
      },
      process.env.REFRESH_SECRET,
      {
        expiresIn: '7d',
      }
    );

    //delete old tokens
    await prisma.refreshToken.deleteMany({
      where: {
        userId: user.id,
      },
      
    });
    // 7️⃣ Save refresh token in DB
    console.log("Creating refresh token...");
    const savedToken =
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isRevoked: false,
      },
    });
    console.log(savedToken);

    // 8️⃣ Remove password
    const {
      password: _,
      ...safeUser
    } = user;

    // 9️⃣ Return response
    return {
      message: 'Login successful',
      user: safeUser,
      accessToken,
      refreshToken,
    };
  };


  //user logout service
  export const logoutUserService = async (refreshToken) => {

  // 1️⃣ Check input
  if (!refreshToken) {
    throw new Error('Refresh token required');
  }
// 2️⃣ Find token in RefreshToken table (must belong to a User)
  const foundToken = await prisma.refreshToken.findFirst({
    where: {
      token: refreshToken,
      userId: { not: null },  // ← Ensures this is a User token, not Tenant/SuperAdmin
    },
  });

  // 3️⃣ Invalid token
  if (!foundToken) {
    throw new Error('Invalid refresh token');
  }

  // 4️⃣ Delete the token from DB (complete logout)
  await prisma.refreshToken.delete({
    where: {
      id: foundToken.id,
    },
  });

  return {
    message: 'User logged out successfully',
  };
};


//user access token refresh service
export const refreshUserAccessTokenService = async (refreshToken) => {

  // 1️⃣ Check input
  if (!refreshToken) {
    throw new Error('Refresh token required');
  }

  // 2️⃣ Find token in RefreshToken table (must belong to a User)
  const tokenRecord = await prisma.refreshToken.findFirst({
    where: {
      token: refreshToken,
      userId: { not: null },
    },
  });

  // 3️⃣ Invalid token
  if (!tokenRecord) {
    throw new Error('Invalid refresh token');
  }

  // 4️⃣ Check if expired in DB
  if (tokenRecord.expiresAt < new Date()) {
    throw new Error('Refresh token expired, please login again');
  }

  // 5️⃣ Verify JWT signature
  try {
    jwt.verify(refreshToken, process.env.REFRESH_SECRET);
  } catch (error) {
    throw new Error('Invalid refresh token');
  }

  // 6️⃣ Find User using userId from token record
  const user = await prisma.user.findUnique({
    where: { id: tokenRecord.userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  if (!user.isActive) {
    throw new Error('User account is deactivated');
  }

  // 7️⃣ Generate NEW access token only
  const newAccessToken = jwt.sign(
    {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
    },
    process.env.ACCESS_SECRET,
    { expiresIn: '1d' }
  );

  // 8️⃣ Return tokens (same refreshToken continues to work)
  return {
    message: 'Token refreshed successfully',
    accessToken: newAccessToken,
    refreshToken: tokenRecord.token,  // Same old refresh token
  };
};