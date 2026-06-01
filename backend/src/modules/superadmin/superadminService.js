import bcrypt from 'bcrypt';
import pkg from '@prisma/client';
import jwt from 'jsonwebtoken';

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





// SuperAdmin creation Service
export const createSuperAdminService =
  async (data) => {
    const { name, email, password } =
      data;

    // 1️⃣ Validate input
    if (!name || !email || !password) {
      throw new Error(
        'Name, email and password are required'
      );
    }

    // 2️⃣ Check existing SuperAdmin
    const existingSuperAdmin =
      await prisma.superAdmin.findUnique({
        where: { email },
      });

    if (existingSuperAdmin) {
      throw new Error(
        'SuperAdmin already exists'
      );
    }

    // 3️⃣ Hash password
    const hashedPassword =
      await bcrypt.hash(password, 10);

    // 4️⃣ Create SuperAdmin
    const superAdmin =
      await prisma.superAdmin.create({
        data: {
          name,
          email,
          password: hashedPassword,
        },
      });

    // 5️⃣ Generate JWT Tokens
    const accessToken = jwt.sign(
      {
        id: superAdmin.id,
        email: superAdmin.email,
      },
      process.env.ACCESS_SECRET,
      {
        expiresIn: '1d',
      }
    );

    const refreshToken = jwt.sign(
      {
        id: superAdmin.id,
      },
      process.env.REFRESH_SECRET,
      {
        expiresIn: '7d',
      }
    );

    // 6️⃣ delete any existing refresh tokens for this SuperAdmin (if any)
   await prisma.refreshToken.deleteMany({   // ← FIX: refreshTokens, not superAdmin
  where: {
    superAdminId: superAdmin.id,
  },
});

    //save new refresh token to refresh table
    await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      superAdminId: superAdmin.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isRevoked: false,
    },
  });

// 7️⃣ Remove password
    const {
      password: _,
      ...safeSuperAdmin
    } = superAdmin;

    // 8️⃣ Return data
    return {
      message:
        'SuperAdmin registered successfully',
      superAdmin: safeSuperAdmin,
      accessToken,
      refreshToken,
    };
  };





// SuperAdmin Login Service
export const loginSuperAdminService =
  async (data) => {
    const { email, password } = data;

    // 1. Check input
    if (!email || !password) {
      throw new Error(
        'Email and password are required'
      );
    }

    // 2. Find SuperAdmin
    const superAdmin =
      await prisma.superAdmin.findUnique({
        where: { email },
      });

    if (!superAdmin) {
      throw new Error(
        'Invalid credentials'
      );
    }

    // 3. Compare password
    const isPasswordMatch =
      await bcrypt.compare(
        password,
        superAdmin.password
      );

    if (!isPasswordMatch) {
      throw new Error(
        'Invalid credentials'
      );
    }

    // 4. Generate Access Token
    const accessToken = jwt.sign(
      {
        id: superAdmin.id,
        email: superAdmin.email,
      },
      process.env.ACCESS_SECRET,
      {
        expiresIn: '1d',
      }
    );

    // 5. Generate Refresh Token
    const refreshToken = jwt.sign(
      {
        id: superAdmin.id,
      },
      process.env.REFRESH_SECRET,
      {
        expiresIn: '7d',
      }
    );

      // Delete old refresh tokens for this SuperAdmin
  await prisma.refreshToken.deleteMany({
    where: {
      superAdminId: superAdmin.id,
    },
  });

   //Save new refresh token to refreshTokens table
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      superAdminId: superAdmin.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isRevoked: false,
    },
  });

  //Remove password from response
  const { password: _, ...safeSuperAdmin } = superAdmin;

    // 8. Return response
    return {
      message:
        'Login successful',
      superAdmin: safeSuperAdmin,
      accessToken,
      refreshToken,
    };
  };



  //logout service for superadmin
export const logoutSuperAdminService = async (refreshToken) => {

  // 1️⃣ Check input
  if (!refreshToken) {
    throw new Error('Refresh token required');
  }

  // 2️⃣ ✅ Find token in RefreshToken table (NOT SuperAdmin table)
  const foundToken = await prisma.refreshToken.findFirst({
    where: {
      token: refreshToken,
      superAdminId: { not: null },
    },
  });

  // 3️⃣ Invalid token
  if (!foundToken) {
    throw new Error('Invalid refresh token');
  }

  // 4️⃣ ✅ Delete using the token's own ID
  await prisma.refreshToken.delete({
    where: {
      id: foundToken.id,
    },
  });

  return {
    message: 'Logout successful',
  };
};




//access tioken refresh service   
export const refreshAccessTokenService = async (refreshToken) => {
// 1️⃣ Check token exists
  if (!refreshToken) {
    throw new Error('Refresh token required');
  }

  // 2️⃣ ✅ Find token in RefreshToken table (NOT SuperAdmin table)
  const tokenRecord = await prisma.refreshToken.findFirst({
    where: {
      token: refreshToken,
      superAdminId: { not: null },  // Must belong to a SuperAdmin
    },
  });

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
    jwt.verify(refreshToken, process.env.REFRESH_SECRET);
  } catch (error) {
    throw new Error('Refresh token expired, please login again');
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