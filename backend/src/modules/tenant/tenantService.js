
import bcrypt from 'bcrypt';
import pkg from '@prisma/client';
import jwt from 'jsonwebtoken';

const { PrismaClient } = pkg;
const prisma = new PrismaClient();


// Tenant Registration Service (with Auto-Login)
export const registerTenantService = async (data) => {
  const { tenantName, email, password, phone, address } = data;

  // 1️⃣ Validate input
  if (!tenantName || !email || !password) {
    throw new Error('Tenant name, email and password are required');
  }

  // 2️⃣ Check existing Tenant
  const existingTenant = await prisma.tenant.findUnique({
    where: { email },
  });

  if (existingTenant) {
    throw new Error('Tenant already exists');
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
  const accessToken = jwt.sign(
    {
      id: tenant.id,
      email: tenant.email,
      role: 'tenant',           // Recommended for role-based auth
    },
    process.env.ACCESS_SECRET,
    {
      expiresIn: '1d',
    }
  );

  const refreshToken = jwt.sign(
    {
      id: tenant.id,
      tenantId: tenant.id,     // Include tenantId for easier token management
    },
    process.env.REFRESH_SECRET,
    {
      expiresIn: '7d',
    }
  );

  // 6️⃣ Save refresh token
await prisma.refreshToken.create({
  data: {
    token: refreshToken,
    tenantId: tenant.id,
    expiresAt: new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ),
  },
});

  // 7️⃣ Remove password & refreshToken
 const {
  password: _,
  ...safeTenant
} = tenant;

  // 8️⃣ Return data
  return {
    message: 'Tenant registered successfully',
    tenant: safeTenant,
    accessToken,
    refreshToken,
  };
};




// Tenant Login Service
export const loginTenantService =
  async (data) => {
    const { email, password } = data;

    // 1️⃣ Check input
    if (!email || !password) {

      throw new Error(
        'Email and password are required'
      );
    }
    // 2️⃣ Find Tenant
    const tenant =
      await prisma.tenant.findUnique({
        where: { email },
      });

    // 3️⃣ Check tenant exists
    if (!tenant) {
      throw new Error(
        'Invalid credentials'
      );
    }

  //Check tenant status BEFORE password check
  if (tenant.status === 'PENDING') {
    throw new Error('Your account is pending approval');
  }

  if (tenant.status === 'BLOCKED') {
    throw new Error('Your account is blocked. Contact support.');
  }

  if (!tenant.isActive) {
    throw new Error('Your account has been deactivated');
  }

    // 4️⃣ Compare password
    const isPasswordMatch =
      await bcrypt.compare(
        password,
        tenant.password
      );

    if (!isPasswordMatch) {

      throw new Error(
        'Invalid credentials'
      );
    }

    // 5️⃣ Generate Access Token
    const accessToken = jwt.sign(
      {
        id: tenant.id,
        email: tenant.email,
      },
      process.env.ACCESS_SECRET,
      {
        expiresIn: '1d',
      }
    );

    // 6️⃣ Generate Refresh Token
    const refreshToken = jwt.sign(
      {
        id: tenant.id,
      },
      process.env.REFRESH_SECRET,
      {
        expiresIn: '7d',
      }
    );

    //Delete all old tokens
    await prisma.refreshToken.deleteMany({
      where: {
        tenantId: tenant.id,
      },
    });

    console.log("Creating refresh token...");
    const savedToken =

    // 7️⃣ Save refresh token
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        tenantId: tenant.id,
        expiresAt: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ),
      },
    });
    console.log(savedToken);

    // 8️⃣ Remove password
    const {
      password: _,
      ...safeTenant
    } = tenant;

    // 9️⃣ Return response
    return {
      message:
        'Login successful',
      tenant: safeTenant,
      accessToken,
      refreshToken,
    };
  };




// Tenant Logout Service
export const logoutTenantService =
  async (refreshToken) => {

    // Find tenant
    const tokenRecord =
      await prisma.refreshToken.findFirst({
        where: {
          token: refreshToken,
          tenantId: {
            not: null,
          },
          // isRevoked: false,
        },
      });

    // Invalid token
    if (!tokenRecord) {
     throw new Error('Invalid refresh token');
    }
    // Remove refresh token
    await prisma.refreshToken.delete({
      where: {
        id: tokenRecord.id,
      },
      // data: {
      //   isRevoked: true,
      // },
    });
    return {
      message:
        'Logout successful',
    };
  };



// Tenant Refresh Access Token Service
export const refreshTenantAccessTokenService =
  async (refreshToken) => {
    // Check token
    if (!refreshToken) {
      throw new Error(
        'Refresh token required'
      );
    }

    // Find tenant
    const tokenRecord =
      await prisma.refreshToken.findFirst({
        where: {
         token: refreshToken,
         tenantId: {
            not: null,
          },
         isRevoked: false,
        //  expiresAt: {gt: new Date(),}
        },
      });

    // Invalid token
    if (!tokenRecord) {
      throw new Error(
        'Invalid refresh token'
      );

    }
//check if expired in DB
    if (tokenRecord.expiresAt < new Date()) {
      throw new Error(
        'Refresh token expired, please login again'
      );
    }

   // Verify refresh token
    try {
      jwt.verify(
        refreshToken,
        process.env.REFRESH_SECRET
      );

    } catch (error) {
      throw new Error(
        'Refresh token expired, please login again'
      );
}
    // Find Tenant using tenantId from RefreshToken table
    const tenant = await prisma.tenant.findUnique({
      where: { id: tokenRecord.tenantId,},
    });
    if (!tenant){
      throw new Error('Tenant not found')
    }

    // Generate new access token
    const accessToken = jwt.sign(
      {
        id: tenant.id,
        email: tenant.email,
      },
      process.env.ACCESS_SECRET,
      {
        expiresIn: '1d',
      }
    );

    // 8️⃣ Generate NEW refresh token (rotation)
  const newRefreshToken = jwt.sign(
    {
      id: tenant.id,
    },
    process.env.REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  // 9️⃣ Delete OLD refresh token from DB
  await prisma.refreshToken.delete({
    where: { id: tokenRecord.id },
  });

  // 🔟 Save NEW refresh token to DB
  await prisma.refreshToken.create({
    data: {
      token: newRefreshToken,
      tenantId: tenant.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isRevoked: false,
    },
  });

  // 1️⃣1️⃣ Return both new tokens
  return {
    message: 'Token refreshed successfully',
    accessToken,
    refreshToken: newRefreshToken,
  };
  };




// create user by tenant services
export const createUserService = async (data, tenantId) => {
  const { name, email, password,  } = data;

  // 1️⃣ Validate input
  if (!name || !email || !password) {
    throw new Error('Name, email and password are required');
  }

  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  // 2️⃣ Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error('User with this email already exists');
  }
 // 3️⃣ Hash password
  const hashedPassword = await bcrypt.hash(password, 10);
 // 4️⃣ Create User under this Tenant
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      // role: role === 'ADMIN' ? 'ADMIN' : 'AGENT', // Only allow ADMIN or AGENT
      tenantId,
      isActive: true,
    },
  });
// 5️⃣ Generate JWT Tokens (Auto Login)
  const accessToken = jwt.sign(
    {
      id: user.id,
      email: user.email,
      // role: user.role,
      tenantId: user.tenantId,
    },
    process.env.ACCESS_SECRET,
    {
      expiresIn: '1d',
    }
  );
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
// 6️⃣ delete old tokens
  await prisma.refreshToken.deleteMany({
    where: {
      userId: user.id,
    },
  });
// 7️⃣ Save new refresh token
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,      // ← for users
      tenantId: null,       // ← not a tenant
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    isRevoked: false,
  },
});
//Remove sensitive data
  const {
    password: _,
    refreshToken: __,
    ...safeUser
  } = user;

  // 8️⃣ Return data
  return {
    message: 'User created successfully',
    user: safeUser,
    accessToken,
    refreshToken,
  };
};




//Get all users of tenant- tenantcontroller
export const getUsersByTenantService = async (tenantId) => {
  // 1️⃣ Validate
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
// 2️⃣ Fetch all users under this tenant (exclude passwords)
  const users = await prisma.user.findMany({
    where: {  tenantId: tenantId, isActive: true, // Optional: only show active users
    },
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





//Get by-id using tenant-controller
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



//Update user by id under tenant-controller
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





//Deactivate user by id (soft delete) under tenant-controller
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




//Reactivate User By Tenant - under tenant-controller
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





//Delete the user record completely from the database.
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



