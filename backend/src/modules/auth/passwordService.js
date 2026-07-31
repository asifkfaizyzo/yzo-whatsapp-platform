import bcrypt from 'bcrypt';
import prisma from '../../config/prisma.js';
import { generateResetToken,getResetTokenExpiry,sendPasswordResetEmail, } from './emailService.js';
import { createAuditLog } from '../audit/auditLogService.js';


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

  // 2️⃣ Find user based on type (with auto-detection fallback)
  let user = null;
  let detectedUserType = userType;

  if (userType === 'SUPERADMIN') {
    user = await prisma.superAdmin.findUnique({ where: { email } });
  } else if (userType === 'TENANT') {
    user = await prisma.tenant.findUnique({ where: { email } });
  } else if (userType === 'USER') {
    user = await prisma.user.findUnique({ where: { email } });
  }

  // If not found in the provided role, auto-detect across tables since email is unique
  if (!user) {
    const tenantUser = await prisma.tenant.findUnique({ where: { email } });
    if (tenantUser) {
      user = tenantUser;
      detectedUserType = 'TENANT';
    } else {
      const regularUser = await prisma.user.findUnique({ where: { email } });
      if (regularUser) {
        user = regularUser;
        detectedUserType = 'USER';
      } else {
        const superAdmin = await prisma.superAdmin.findUnique({ where: { email } });
        if (superAdmin) {
          user = superAdmin;
          detectedUserType = 'SUPERADMIN';
        }
      }
    }
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
  await sendPasswordResetEmail(email, resetToken, detectedUserType);

   // ✅ 8️⃣ Audit log — PASSWORD_RESET_REQUESTED
  await createAuditLog({
    actorId:     user.id,
    actorType:   detectedUserType === 'SUPERADMIN'
                   ? 'SUPER_ADMIN'
                   : detectedUserType,   // TENANT or USER
    actorName:   user.name || user.tenantName || user.email,
    actorEmail:  user.email,
    action:      'PASSWORD_RESET_REQUESTED',
    module:      'AUTH',
    description: `Password reset requested for ${detectedUserType} "${user.email}"`,
    tenantId:    detectedUserType === 'TENANT'
                   ? user.id
                   : detectedUserType === 'USER'
                   ? user.tenantId
                   : null,
    metadata: {
      userType: detectedUserType,
      email:    user.email,
    },
  });

  return {
    message: 'If this email exists, a reset link has been sent.',
  };
};




// ===================== RESET PASSWORD (Shared) =====================
export const resetPasswordService = async (
  token,
  newPassword,
  confirmPassword,
  userType
) => {

  // 1️⃣ Validate
  if (!token || !newPassword || !confirmPassword) {
    throw new Error('Token, new password and confirm password are required');
  }

  // 2️⃣ Check passwords match
  if (newPassword !== confirmPassword) {
    throw new Error('Passwords do not match');
  }

  // 3️⃣ Find token in DB
  const resetRecord = await prisma.passwordReset.findFirst({
    where: { token, isUsed: false },
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

  // 7️⃣ Detect user type
let actualUserType = userType;  // ← use the TYPE passed in
let targetUser     = null;

// ✅ Use userType passed in — don't auto-detect
if (actualUserType === 'SUPERADMIN') {
  const superAdminFound = await prisma.superAdmin.findUnique({
    where: { email: resetRecord.email },
  });
  if (superAdminFound) {
    targetUser = superAdminFound;
  }
}

else if (actualUserType === 'TENANT') {
  const tenantFound = await prisma.tenant.findUnique({
    where: { email: resetRecord.email },
  });
  if (tenantFound) {
    targetUser = tenantFound;
  }
}

else if (actualUserType === 'USER') {
  const userFound = await prisma.user.findUnique({
    where: { email: resetRecord.email },
  });
  if (userFound) {
    targetUser = userFound;
  }
}

// Fallback — if userType wrong, auto detect
if (!targetUser) {
  const superAdminFound = await prisma.superAdmin.findUnique({
    where: { email: resetRecord.email },
  });
  if (superAdminFound) {
    actualUserType = 'SUPERADMIN';
    targetUser     = superAdminFound;
  } else {
    const tenantFound = await prisma.tenant.findUnique({
      where: { email: resetRecord.email },
    });
    if (tenantFound) {
      actualUserType = 'TENANT';
      targetUser     = tenantFound;
    } else {
      const userFound = await prisma.user.findUnique({
        where: { email: resetRecord.email },
      });
      if (userFound) {
        actualUserType = 'USER';
        targetUser     = userFound;
      }
    }
  }
}

// Safety check
if (!targetUser) {
  throw new Error('Account not found for this reset link');
}

  // 9️⃣ Update password based on type
  if (actualUserType === 'SUPERADMIN') {
    await prisma.superAdmin.update({
      where: { email: resetRecord.email },
      data:  { password: hashedPassword },
    });
    await prisma.refreshToken.deleteMany({
      where: { superAdminId: targetUser.id }, // ← uses targetUser ✅
    });
  }

  if (actualUserType === 'TENANT') {
    await prisma.tenant.update({
      where: { email: resetRecord.email },
      data:  { password: hashedPassword },
    });
    await prisma.refreshToken.deleteMany({
      where: { tenantId: targetUser.id }, // ← uses targetUser ✅
    });
  }

  if (actualUserType === 'USER') {
    await prisma.user.update({
      where: { email: resetRecord.email },
      data:  { password: hashedPassword },
    });
    await prisma.refreshToken.deleteMany({
      where: { userId: targetUser.id }, // ← uses targetUser ✅
    });
  }

  // 1️⃣0️⃣ Mark token as used
  await prisma.passwordReset.update({
    where: { id: resetRecord.id },
    data:  { isUsed: true },
  });

  // ✅ 1️⃣1️⃣ Audit log
  await createAuditLog({
    actorId:     targetUser.id,
    actorType:   actualUserType === 'SUPERADMIN'
                   ? 'SUPER_ADMIN'
                   : actualUserType,
    actorName:   targetUser.name
                   || targetUser.tenantName
                   || targetUser.email,
    actorEmail:  targetUser.email,
    action:      'PASSWORD_RESET_COMPLETED',
    module:      'AUTH',
    description: `Password reset completed for ${actualUserType} "${targetUser.email}"`,
    tenantId:    actualUserType === 'TENANT'
                   ? targetUser.id
                   : actualUserType === 'USER'
                   ? targetUser.tenantId
                   : null,
    metadata: {
      userType: actualUserType,
      email:    targetUser.email,
    },
  });

  return {
    message: 'Password reset successfully. Please login again.',
  };
};