import bcrypt from 'bcrypt';
import pkg from '@prisma/client';
import jwt from 'jsonwebtoken';

import { generateAccessToken,generateRefreshToken,verifyAccessToken,verifyRefreshToken } from '../auth/jwtservice.js';
import { saveRefreshToken, deleteRefreshToken,findRefreshToken } from '../auth/refreshtokenService.js';
import { generateResetToken, getResetTokenExpiry, sendPasswordResetEmail,} from '../auth/emailService.js';
import { forgotPasswordService,resetPasswordService, } from '../auth/passwordService.js';



const { PrismaClient } = pkg;
const prisma = new PrismaClient();


// //Creation of SuperAdmin
// export const createSuperAdmin = async (data) => {
//   const { name, email, password } = data;

//   // 1️⃣ Check if email already exists
//   const existingSuperAdmin = await prisma.superAdmin.findUnique({
//     where: { email },
//   });

//   if (existingSuperAdmin) {
//     throw new Error('Email already exists');
//   }

//   // 2️⃣ Hash password
//   const hashedPassword = await bcrypt.hash(password, 10);

//   // 3️⃣ Create SuperAdmin
//   const superAdmin = await prisma.superAdmin.create({
//     data: {
//       name,
//       email,
//       password: hashedPassword,
//     },
//   });

//   // 4️⃣ Remove password before returning
//   const { password: _, ...safeSuperAdmin } = superAdmin;

//   return safeSuperAdmin;
// };






//===========SuperAdmin creation Service===========//
export const createSuperAdminService =
  async (data) => {
    const { name, email, password } = data;

    // 1️⃣ Validate input
    if (!name || !email || !password) {
      throw new Error( 'Name, email and password are required');
    }

    // 2️⃣ Check existing SuperAdmin
    const existingSuperAdmin = await prisma.superAdmin.findUnique({
        where: { email },
      });

    if (existingSuperAdmin) {
      throw new Error( 'SuperAdmin already exists' );
    }

    // 3️⃣ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4️⃣ Create SuperAdmin
    const superAdmin = await prisma.superAdmin.create({
        data: {
          name,
          email,
          password: hashedPassword,
        },
      });

    // 5️⃣ Generate Tokens
     const accessToken = generateAccessToken({
    id: superAdmin.id,
    email: superAdmin.email,
    type: 'SUPERADMIN',
  });


      const refreshToken = generateRefreshToken({
    id: superAdmin.id,
    type: 'SUPERADMIN',
  });

    // 6️⃣ Save refresh token
  await saveRefreshToken({
    token: refreshToken,
    superAdminId: superAdmin.id,
  });

// 7️⃣ Remove password
    const { password: _, ...safeSuperAdmin } = superAdmin;

    // 8️⃣ Return data
    return {
      message: 'SuperAdmin registered successfully',
      superAdmin: safeSuperAdmin,
      user: {
        id: safeSuperAdmin.id,
        name: safeSuperAdmin.name,
        email: safeSuperAdmin.email,
        type: 'SUPERADMIN',
      },
      accessToken,
      refreshToken,
    };
  };





//===========SuperAdmin Login Service===========
export const loginSuperAdminService =
  async (data) => {
    const { email, password } = data;

    // 1. Check input
    if (!email || !password) {
      throw new Error( 'Email and password are required');
    }

    // 2. Find SuperAdmin
    const superAdmin =
      await prisma.superAdmin.findUnique({ where: { email },});

    if (!superAdmin) {
      throw new Error( 'Invalid credentials' );
    }

    // 3. Compare password
    const isPasswordMatch =
      await bcrypt.compare( password, superAdmin.password );

    if (!isPasswordMatch) {
      throw new Error( 'Invalid credentials' );
    }

    // 4. Generate Access Token
     const accessToken = generateAccessToken({
    id: superAdmin.id,
    email: superAdmin.email,
    type: 'SUPERADMIN',
  });

   const refreshToken = generateRefreshToken({
    id: superAdmin.id,
    type: 'SUPERADMIN',
  });
 //Save new refresh token to refreshTokens table
  await saveRefreshToken({
    token: refreshToken,
    superAdminId: superAdmin.id,
  });

  //Remove password from response
  const { password: _, ...safeSuperAdmin } = superAdmin;

    // 8. Return response
    return {
      message:
        'Login successful',
      superAdmin: safeSuperAdmin,
      user: {
        id: safeSuperAdmin.id,
        name: safeSuperAdmin.name,
        email: safeSuperAdmin.email,
        type: 'SUPERADMIN',
      },
      accessToken,
      refreshToken,
    };
  };



  //===========logout service for superadmin===========
export const logoutSuperAdminService = async (refreshToken) => {

  // 1️⃣ Check input
  if (!refreshToken) {
    throw new Error('Refresh token required');
  }

  //Delete refresh token 
  await deleteRefreshToken(refreshToken);

  return {
    message: 'Logout successful',
  };
};




//===========access token refresh service   ===========
export const refreshAccessTokenService = async (refreshToken) => {
// 1️⃣ Check token exists
  if (!refreshToken) {
    throw new Error('Refresh token required');
  }

  // 2️⃣ ✅ Find token in DB
  const tokenRecord = await findRefreshToken(refreshToken, 'SUPERADMIN');

  // 3️⃣ No token found = invalid
  if (!tokenRecord) {
    throw new Error('Invalid refresh token');
  }
 // 4️⃣ Check if expired in DB
  if (tokenRecord.expiresAt < new Date()) {
    throw new Error('Refresh token expired, please login again');
  }

  // 5️⃣ Verify JWT signature
    try {
    verifyRefreshToken(refreshToken);
  } catch (error) {
    throw new Error('Invalid refresh token');
  }

  // 6️⃣ ✅ Find SuperAdmin using superAdminId from token record
  const superAdmin = await prisma.superAdmin.findUnique({
    where: { id: tokenRecord.superAdminId },
  });

  if (!superAdmin) {
    throw new Error('SuperAdmin not found');
  }

  // 7️⃣ Generate NEW access token
  const newAccessToken = jwt.sign(
    {
      id: superAdmin.id,
      email: superAdmin.email,
      type: 'SUPERADMIN',
    },
    process.env.ACCESS_SECRET,
    {
      expiresIn: '1d',
    }
  );

  // 8️⃣ Return new access token
  return {
    accessToken: newAccessToken,
  };
};




// ===================== FORGOT PASSWORD =====================
export const forgotPasswordSuperAdminService = async (email) => {
  return await forgotPasswordService(email, 'SUPERADMIN');
};

// ===================== RESET PASSWORD =====================
export const resetPasswordSuperAdminService = async (
  token,
  newPassword,
  confirmPassword
) => {
  return await resetPasswordService(
    token,
    newPassword,
    confirmPassword,
    'SUPERADMIN'
  );
};









//===========get all tenant by superadmin service===========
export const getAllTenantsService = async () => {
  
  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      tenantName: true,
      email: true,
      phone: true,
      address: true,
      isActive: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return {
    message: 'Tenants fetched successfully',
    count: tenants.length,
    tenants,
  };
};



//===========Get tenant by id by superadmin service===========
export const getTenantByIdService = async (tenantId) => {
  
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      tenantName: true,
      email: true,
      phone: true,
      address: true,
      isActive: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  return {
    message: 'Tenant fetched successfully',
    tenant,
  };
};




//===========update tenant by id by superadmin===========
export const updateTenantByIdService = async (tenantId, data) => {

  // 1️⃣ Validate input
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  // 2️⃣ Check if tenant exists
  const existingTenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!existingTenant) {
    throw new Error('Tenant not found');
  }

  // 3️⃣ Prepare update data (only allowed fields)
  const updateData = {};

  if (data.tenantName) {
    updateData.tenantName = data.tenantName;
  }

  if (data.email) {
    // Check if email is already taken by another tenant
    const emailExists = await prisma.tenant.findFirst({
      where: {
        email: data.email,
        id: { not: tenantId },
      },
    });

    if (emailExists) {
      throw new Error('Email already in use');
    }

    updateData.email = data.email;
  }

  if (data.phone !== undefined) {
    updateData.phone = data.phone;
  }

  if (data.address !== undefined) {
    updateData.address = data.address;
  }

  // 4️⃣ Check if there's anything to update
  if (Object.keys(updateData).length === 0) {
    throw new Error('No valid fields to update');
  }

  // 5️⃣ Update tenant
  const updatedTenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: updateData,
    select: {
      id: true,
      tenantName: true,
      email: true,
      phone: true,
      address: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    message: 'Tenant updated successfully',
    tenant: updatedTenant,
  };
};




//===========Deactivate tenant by id by superadmin service===========
export const deactivateTenantService = async (tenantId) => {
  
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  if (!tenant.isActive) {
    throw new Error('Tenant is already deactivated');
  }

  // 1️⃣ Deactivate tenant
  const deactivatedTenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: { isActive: false },
    select: {
      id: true,
      tenantName: true,
      email: true,
      isActive: true,
      updatedAt: true,
    },
  });

  // 2️⃣ Delete tenant's refresh tokens (force logout)
  await prisma.refreshToken.deleteMany({
    where: { tenantId: tenantId },
  });

  // 3️⃣ Deactivate all users under this tenant
  await prisma.user.updateMany({
    where: { tenantId: tenantId },
    data: { isActive: false },
  });

  // 4️⃣ Delete all user refresh tokens under this tenant
  const users = await prisma.user.findMany({
    where: { tenantId: tenantId },
    select: { id: true },
  });

  const userIds = users.map(user => user.id);

  await prisma.refreshToken.deleteMany({
    where: { userId: { in: userIds } },
  });

  return {
    message: 'Tenant and all users deactivated successfully',
    tenant: deactivatedTenant,
  };
};




//===========Reactivate tenant by id by superadmin service===========
export const reactivateTenantService = async (tenantId) => {
  
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  if (tenant.isActive) {
    throw new Error('Tenant is already active');
  }

  // 1️⃣ Reactivate tenant
  const reactivatedTenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: { isActive: true },
    select: {
      id: true,
      tenantName: true,
      email: true,
      isActive: true,
      updatedAt: true,
    },
  });

  // 2️⃣ Reactivate all users under this tenant
  await prisma.user.updateMany({
    where: { tenantId: tenantId },
    data: { isActive: true },
  });

  return {
    message: 'Tenant and all users reactivated successfully',
    tenant: reactivatedTenant,
  };
};




//===========Delete tenant by id by superadmin service===========
export const deleteTenantByIdService = async (tenantId) => {

  // 1️⃣ Validate input
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  // 2️⃣ Check if tenant exists
  const existingTenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!existingTenant) {
    throw new Error('Tenant not found');
  }

  // 3️⃣ Get all users under this tenant
  const users = await prisma.user.findMany({
    where: { tenantId: tenantId },
    select: { id: true },
  });

  const userIds = users.map(user => user.id);

  // 4️⃣ Delete all user refresh tokens
  if (userIds.length > 0) {
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: userIds } },
    });
  }

  // 5️⃣ Delete tenant's refresh tokens
  await prisma.refreshToken.deleteMany({
    where: { tenantId: tenantId },
  });

  // 6️⃣ Delete all users under this tenant
  await prisma.user.deleteMany({
    where: { tenantId: tenantId },
  });

  // 7️⃣ Delete the tenant
  await prisma.tenant.delete({
    where: { id: tenantId },
  });

  return {
    message: 'Tenant and all associated data deleted successfully',
  };
};




//===========Approve Tenant service by superadmin===========
export const approveTenantService = async (tenantId) => {

  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  if (tenant.status === 'APPROVED') {
    throw new Error('Tenant is already approved');
  }

  const approvedTenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: { status: 'APPROVED' },
    select: {
      id: true,
      tenantName: true,
      email: true,
      status: true,
      updatedAt: true,
    },
  });

  return {
    message: 'Tenant approved successfully',
    tenant: approvedTenant,
  };
};



//==========Block tenant by id by superadmin service===========
export const blockTenantService = async (tenantId) => {

  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  if (tenant.status === 'BLOCKED') {
    throw new Error('Tenant is already blocked');
  }

  // 1️⃣ Block tenant
  const blockedTenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: { status: 'BLOCKED' },
    select: {
      id: true,
      tenantName: true,
      email: true,
      status: true,
      updatedAt: true,
    },
  });

  // 2️⃣ Delete tenant's refresh tokens (force logout)
  await prisma.refreshToken.deleteMany({
    where: { tenantId: tenantId },
  });

  // 3️⃣ Get all users under this tenant
  const users = await prisma.user.findMany({
    where: { tenantId: tenantId },
    select: { id: true },
  });

  const userIds = users.map(user => user.id);

  // 4️⃣ Delete all user refresh tokens (force logout all)
  if (userIds.length > 0) {
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: userIds } },
    });
  }

  return {
    message: 'Tenant blocked. All sessions terminated.',
    tenant: blockedTenant,
  };
};



//=========unblock tenant service by superadmin============
export const unblockTenantService = async (tenantId) => {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  if (tenant.status !== 'BLOCKED') {
    throw new Error('Tenant is not blocked');
  }

  const unblockedTenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: { status: 'APPROVED' },
    select: {
      id: true,
      tenantName: true,
      email: true,
      status: true,
      updatedAt: true,
    },
  });

  return {
    message: 'Tenant unblocked successfully',
    tenant: unblockedTenant,
  };
};