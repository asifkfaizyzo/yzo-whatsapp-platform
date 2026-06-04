import bcrypt from 'bcrypt';
import pkg from '@prisma/client';
import { generateResetToken,getResetTokenExpiry,sendPasswordResetEmail, } from './emailService.js';



const { PrismaClient } = pkg;
const prisma = new PrismaClient();


// ===================== FORGOT PASSWORD (Shared) =====================
export const forgotPasswordService = async (email, userType) => {

   // Debug 1: Check what we receive
  console.log('===== FORGOT PASSWORD DEBUG =====');
  console.log('Email received:', email);
  console.log('UserType received:', userType);


  // 1️⃣ Validate
  if (!email) {
    throw new Error('Email is required');
  }

  // 2️⃣ Find user based on type
  let user;

  if (userType === 'SUPERADMIN') {
    user = await prisma.superAdmin.findUnique({ where: { email } });
  } else if (userType === 'TENANT') {
    user = await prisma.tenant.findUnique({ where: { email } });
  } else if (userType === 'USER') {
    user = await prisma.user.findUnique({ where: { email } });
  }

  // 3️⃣ Security: dont reveal if email exists
  if (!user) {
    return {
      message: 'If this email exists, a reset link has been sent.......................................',
    };
  }

  // 4️⃣ Generate reset token
  const resetToken = generateResetToken();
  const expiresAt = getResetTokenExpiry();

  // 5️⃣ Delete any old reset tokens
  await prisma.passwordReset.deleteMany({
    where: { email },
  });

  // 6️⃣ Save token to DB
  await prisma.passwordReset.create({
    data: {
      email,
      token: resetToken,
      expiresAt,
      isUsed: false,
    },
  });

  // 7️⃣ Send email
  await sendPasswordResetEmail(email, resetToken);

  return {
    message: 'If this email exists, a reset link has been sent.',
  };
};




// ===================== RESET PASSWORD (Shared) =====================
export const resetPasswordService = async (token, newPassword, confirmPassword, userType) => {

  // 1️⃣ Validate
  if (!token || !newPassword || !confirmPassword) {
    throw new Error('Token, new password and confirm password are required');
  }

  // 2️⃣ Check if passwords match
  if (newPassword !== confirmPassword) {
    throw new Error('Passwords do not match');
  }

  // 3️⃣ Find token in DB
  const resetRecord = await prisma.passwordReset.findFirst({
    where: {
      token,
      isUsed: false,
    },
  });

  // 4️⃣ Invalid token
  if (!resetRecord) {
    throw new Error('Invalid or expired reset link');
  }

  // 5️⃣ Check expiry
  if (resetRecord.expiresAt < new Date()) {
    throw new Error('Reset link expired. Please request a new one.');
  }

  // 6️⃣ Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // 7️⃣ Update password based on type
  if (userType === 'SUPERADMIN') {
    await prisma.superAdmin.update({
      where: { email: resetRecord.email },
      data: { password: hashedPassword },
    });

    const superAdmin = await prisma.superAdmin.findUnique({
      where: { email: resetRecord.email },
    });

    await prisma.refreshToken.deleteMany({
      where: { superAdminId: superAdmin.id },
    });
  }

  if (userType === 'TENANT') {
    await prisma.tenant.update({
      where: { email: resetRecord.email },
      data: { password: hashedPassword },
    });

    const tenant = await prisma.tenant.findUnique({
      where: { email: resetRecord.email },
    });

    await prisma.refreshToken.deleteMany({
      where: { tenantId: tenant.id },
    });
  }

  if (userType === 'USER') {
    await prisma.user.update({
      where: { email: resetRecord.email },
      data: { password: hashedPassword },
    });

    const user = await prisma.user.findUnique({
      where: { email: resetRecord.email },
    });

    await prisma.refreshToken.deleteMany({
      where: { userId: user.id },
    });
  }

  // 8️⃣ Mark token as used
  await prisma.passwordReset.update({
    where: { id: resetRecord.id },
    data: { isUsed: true },
  });

  return {
    message: 'Password reset successfully. Please login again.',
  };
};