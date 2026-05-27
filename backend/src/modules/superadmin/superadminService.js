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





// SuperAdmin Registration Service
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

    // 6️⃣ Save refresh token
    await prisma.superAdmin.update({
      where: {
        id: superAdmin.id,
      },
      data: {
        refreshToken,
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

    // 6. Save refresh token
    await prisma.superAdmin.update({
      where: {
        id: superAdmin.id,
      },
      data: {
        refreshToken,
      },
    });

    // 7. Remove password
    const {
      password: _,
      ...safeSuperAdmin
    } = superAdmin;

    // 8. Return response
    return {
      message:
        'Login successful',
      superAdmin: safeSuperAdmin,
      accessToken,
      refreshToken,
    };
  };



//SuperAdmin Logout Service
export const logoutSuperAdminService =
  async (refreshToken) => {

    // Find SuperAdmin
    const superAdmin =
      await prisma.superAdmin.findFirst({
        where: {
          refreshToken,
        },
      });

    // If not found
    if (!superAdmin) {
      throw new Error(
        'Invalid refresh token'
      );
    }

    // Remove refresh token
    await prisma.superAdmin.update({
      where: {
        id: superAdmin.id,
      },
      data: {
        refreshToken: null,
      },
    });

    return {
      message:
        'Logout successful',
    };
  };



//generating access token when access token expires
export const refreshAccessTokenService = async (refreshToken) => {

  // 1️⃣ Check token exists
  if (!refreshToken) {
    throw new Error('Refresh token required');
  }

  // 2️⃣ Find SuperAdmin with this refresh token in DB
  const superAdmin = await prisma.superAdmin.findFirst({
    where: { refreshToken },
  });

  // 3️⃣ No superAdmin found = invalid token
  if (!superAdmin) {
    throw new Error('Invalid refresh token');
  }

  // 4️⃣ Verify refresh token is not expired
  try {
    jwt.verify(
      refreshToken,
      process.env.REFRESH_SECRET
    );
  } catch (error) {
    // Refresh token is expired or tampered
    throw new Error('Refresh token expired, please login again');
  }

  // 5️⃣ Generate NEW access token
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

  // 6️⃣ Return new access token
  return {
    accessToken: newAccessToken,
  };
};