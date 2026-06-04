import pkg from '@prisma/client';

const { PrismaClient } = pkg;
const prisma = new PrismaClient();



// ===================== SAVE REFRESH TOKEN =====================
export const saveRefreshToken = async ({
  token,
  superAdminId = null,
  tenantId = null,
  userId = null,
}) => {

// Delete old tokens first (Choice 1: single session)
  if (superAdminId) {
    await prisma.refreshToken.deleteMany({
      where: { superAdminId },
    });
  }

  if (tenantId) {
    await prisma.refreshToken.deleteMany({
      where: { tenantId },
    });
  }

  if (userId) {
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  // Save new token
  await prisma.refreshToken.create({
    data: {
      token,
      superAdminId,
      tenantId,
      userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isRevoked: false,
    },
  });
};



// ===================== DELETE REFRESH TOKEN (Logout) =====================
export const deleteRefreshToken = async (token) => {

  const foundToken = await prisma.refreshToken.findFirst({
    where: { token },
  });

  if (!foundToken) {
    throw new Error('Invalid refresh token');
  }

  await prisma.refreshToken.delete({
    where: { id: foundToken.id },
  });
};



// ===================== FIND REFRESH TOKEN =====================
export const findRefreshToken = async (token, type) => {

  let whereClause = { token };

  if (type === 'SUPERADMIN') {
    whereClause.superAdminId = { not: null };
  } else if (type === 'TENANT') {
    whereClause.tenantId = { not: null };
  } else if (type === 'USER') {
    whereClause.userId = { not: null };
  }

  const tokenRecord = await prisma.refreshToken.findFirst({
    where: whereClause,
  });

  return tokenRecord;
};