import bcrypt from 'bcrypt';
import pkg from '@prisma/client';

import {generateAccessToken, generateRefreshToken} from '../auth/jwtservice.js';
import { loginUserService } from '../users/userService.js';
import { forgotPasswordTenantService,resetPasswordTenantService,} from './tenantService.js';
import{registerTenantService,loginTenantService,logoutTenantService,
  refreshTenantAccessTokenService,createUserService,getUsersByTenantService,
  getUserByIdService,updateUserByIdService,deleteUserByIdService,
  deactivateUserByIdService,reactivateUserByIdService} from './tenantService.js';


const { PrismaClient } = pkg;
const prisma = new PrismaClient();

// Tenant Registration Controller
export const registerTenant = async (req, res) => {
  try {
    const result = await registerTenantService(req.body);

    return res.status(201).json({
      success: true,
      message: 'Tenant registered and logged in successfully',
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};



// Tenant (and Unified User) Login Controller
export const loginTenant = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // 1️⃣ Check if email exists in Tenant table
    const tenantExists = await prisma.tenant.findUnique({
      where: { email },
    });

    let result;
    let message;

    if (tenantExists) {
      result = await loginTenantService(req.body);
      message = 'Tenant logged in successfully';
    } else {
      // 2️⃣ Check if email exists in User table
      const userExists = await prisma.user.findUnique({
        where: { email },
      });

      if (userExists) {
        result = await loginUserService(req.body);
        message = 'User logged in successfully';
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid credentials',
        });
      }
    }

    return res.status(200).json({
      success: true,
      message,
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};



// Tenant Logout Controller
export const logoutTenant =
  async (req, res) => {

    try {

      const { refreshToken } =
        req.body;

      const result =
        await logoutTenantService(
          refreshToken
        );

      return res.status(200).json({
        success: true,
        data: result,
      });

    } catch (error) {

      return res.status(400).json({
        success: false,
        message: error.message,
      });

    }
};




// Tenant Refresh Access Token Controller
export const refreshTenantAccessToken =
  async (req, res) => {

    try {

      // Get refresh token
      const { refreshToken } =
        req.body;

      // Call service
      const result =
        await refreshTenantAccessTokenService(
          refreshToken
        );

      return res.status(200).json({
        success: true,
        message:
          'Access token refreshed successfully',
        accessToken:
          result.accessToken,
      });

    } catch (error) {

      return res.status(401).json({
        success: false,
        message: error.message,
      });

    }
};




//create user by tenant-controller
export const createUser = async (req, res) => {
  try {
    const tenantId = req.tenant?.id;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Tenant not authenticated',
      });
    }

    const result = await createUserService(req.body, tenantId);

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


// ===================== FORGOT PASSWORD =====================
export const forgotPasswordTenant = async (req, res) => {
  try {
    const { email } = req.body;
    const result = await forgotPasswordTenantService(email);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ===================== RESET PASSWORD =====================
export const resetPasswordTenant = async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;
    const result = await resetPasswordTenantService(
      token,
      newPassword,
      confirmPassword
    );
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};



//Get all users by tenant-controller
export const getUsersByTenant = async (req, res) => {
  try {
    // 3️⃣ Get tenantId from the logged-in tenant (set by verifyTenant middleware)
    const tenantId = req.tenant.id;

    const result = await getUsersByTenantService(tenantId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};



//Get user by id under tenant-tenantcontroller
export const getUserById = async (req, res) => {
  try {
    // user id from params
    const { id } = req.params;

    // tenant id from middleware
    const tenantId = req.tenant.id;

    const result = await getUserByIdService(id, tenantId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};



//update user by id under tenant-tenantcontroller
export const updateUserById = async (req, res) => {
  try {
    // User ID from URL params
    const { id } = req.params;

    // Tenant ID from middleware
    const tenantId = req.tenant.id;

    // Data from request body
    const data = req.body;

    const result = await updateUserByIdService(id, tenantId, data);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};



//Deactivate user by id (soft delete) under tenant-controller
export const deactivateUserById = async (req, res) => {
  try {
    // User ID from URL params
    const { id } = req.params;

    // Tenant ID from middleware
    const tenantId = req.tenant.id;

    const result = await deactivateUserByIdService(id, tenantId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};




//Reactivate User By Id - under tenant-controller
export const reactivateUserById = async (req, res) => {
  try {
    // User ID from URL params
    const { id } = req.params;

    // Tenant ID from middleware
    const tenantId = req.tenant.id;

    const result = await reactivateUserByIdService(id, tenantId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};




//Delete user by id under tenant-tenantcontroller
export const deleteUserById = async (req, res) => {
  try {
    // User ID from URL params
    const { id } = req.params;

    // Tenant ID from middleware
    const tenantId = req.tenant.id;

    const result = await deleteUserByIdService(id, tenantId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


// Get logged-in tenant's current profile details
export const getLoggedInTenant = async (req, res) => {
  try {
    const tenantId = req.tenant?.id;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Tenant not authenticated',
      });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        tenantName: true,
        email: true,
        status: true,
        isActive: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
