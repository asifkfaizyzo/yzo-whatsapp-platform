
import bcrypt from 'bcrypt';
import prisma from '../../config/prisma.js';
import jwt from 'jsonwebtoken';

import { generateAccessToken,generateRefreshToken,verifyAccessToken,verifyRefreshToken } from '../auth/jwtservice.js';
import { saveRefreshToken, deleteRefreshToken,findRefreshToken } from '../auth/refreshtokenService.js';
import { generateResetToken,getResetTokenExpiry,sendPasswordResetEmail,} from '../auth/emailService.js';
import { forgotPasswordService,resetPasswordService, } from '../auth/passwordService.js';
import { getOrCreateConversation } from "../../modules/conversations/conversationService.js";


// ===========Tenant Registration Service (with Auto-Login)===========
export const registerTenantService = async (data) => {
  const { tenantName, email, password, phone, address } = data;

  // 1️⃣ Validate input
  if (!tenantName || !email || !password) {
    throw new Error('Tenant name, email and password are required');
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
      tenantName,
      email,
      password: hashedPassword,
      phone,
      address,
      status: 'PENDING', // New tenants start as PENDING
    },
  });

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
    user: {
      id: safeTenant.id,
      name: safeTenant.tenantName,
      email: safeTenant.email,
      type: 'TENANT',
      status: safeTenant.status,
    },
    accessToken,
    refreshToken,
  };
};




// ===========Tenant Login Service===========
export const loginTenantService =
  async (data) => {
    const { email, password } = data;

    // 1️⃣ Check input
    if (!email || !password) {

      throw new Error( 'Email and password are required' );
    }
    // 2️⃣ Find Tenant
    const tenant =
      await prisma.tenant.findUnique({
        where: { email },
      });

    // 3️⃣ Check tenant exists
    if (!tenant) {
      throw new Error( 'Invalid credentials' );
    }

  // //Check tenant status BEFORE password check
  // if (tenant.status === 'PENDING') {
  //   throw new Error('Your account is pending approval');
  // }

  if (tenant.status === 'BLOCKED') {
    throw new Error('Your account is blocked. Contact support.');
  }

  if (!tenant.isActive) {
    throw new Error('Your account has been deactivated');
  }

    // 4️⃣ Compare password
    const isPasswordMatch = await bcrypt.compare( password, tenant.password);

    if (!isPasswordMatch) {
    throw new Error( 'Invalid credentials' );
    }

    // 5️⃣ Generate  Tokens
  const accessToken = generateAccessToken({
    id: tenant.id,
    email: tenant.email,
    type: 'TENANT',
  });

  const refreshToken = generateRefreshToken({
    id: tenant.id,
    type: 'TENANT',
  });

  // 7️⃣ Save refresh token
  await saveRefreshToken({
    token: refreshToken,
    tenantId: tenant.id,
  });

    // 8️⃣ Remove password
    const {  password: _, ...safeTenant } = tenant;

    // 9️⃣ Return response
    return {
message: 'Login successful',
    accessToken,
    refreshToken,
    user: {
      id: safeTenant.id,
      name: safeTenant.tenantName,
      email: safeTenant.email,
      type: 'TENANT', 
      status: safeTenant.status,
    },
    };
  };




//=========== Tenant Logout Service===========
export const logoutTenantService =
  async (refreshToken) => {

      // 1️⃣ Check input
  if (!refreshToken) {
    throw new Error('Refresh token required');
  }

  // 2️⃣ Delete token
  await deleteRefreshToken(refreshToken);
    
    return {
      message:
        'Logout successful',
    };
  };



//=========== Tenant Refresh Access Token Service===========
export const refreshTenantAccessTokenService =
  async (refreshToken) => {
    // Check token
    if (!refreshToken) {
      throw new Error( 'Refresh token required' );
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

    // 1️⃣1️⃣ Return both new tokens
    return {
      message: 'Token refreshed successfully',
      accessToken : newAccessToken,
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

  if (!tenantId) {
    throw new Error('Tenant ID is required');
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
    where: {  tenantId: tenantId },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      tenantId: true,
      createdAt: true,
      updatedAt: true,
      // ❌ password is NOT selected
    },
    orderBy: {  createdAt: 'desc', },
  });
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

  // 3️⃣ Delete all refresh tokens for this user first
  await prisma.refreshToken.deleteMany({
    where: {
      userId: userId,
    },
  });

  // 4️⃣ Delete the user
  await prisma.user.delete({
    where: { id: userId },
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
    const contacts = await Contact.findAll({
        where: {
            tenantId: tenantId,
            assignedTo: null
        },
        // Optional: Show newest first
        order: [['createdAt', 'DESC']]
    });

    return contacts;
};



//========Assign contact to user under tenant-controller(manual)========
export const assignContactService = async (
  contactId,
  userId,
  tenantId
) => {
  // 1️⃣ Validate contact
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, tenantId },
  });

  if (!contact) {
    throw new Error("Contact not found");
  }

  // 2️⃣ Validate user
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // 3️⃣ Assign contact
  return await prisma.contact.update({
    where: { id: contactId },
    data: {
      assignedTo: userId,
      assignedAt: new Date(),
    },
  });
};





//========Reassign contact to user under tenant-controller========
export const reassignContactService = async (
  contactId,
  newUserId,
  tenantId
) => {
  // 1️⃣ Check contact exists under tenant
  const contact = await prisma.contact.findFirst({
    where: {
      id: contactId,
      tenantId,
    },
  });

  if (!contact) {
    throw new Error("Contact not found");
  }

  // 2️⃣ Check new user exists under same tenant
  const user = await prisma.user.findFirst({
    where: {
      id: newUserId,
      tenantId,
    },
  });

  if (!user) {
    throw new Error("User not found under this tenant");
  }

  // 3️⃣ Reassign contact (overwrite old assignment)
  const updatedContact = await prisma.contact.update({
    where: {
      id: contactId,
    },
    data: {
      assignedTo: newUserId,
      assignedAt: new Date(),
    },
  });

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