import bcrypt from 'bcrypt';
import pkg from '@prisma/client';

import { generateAccessToken, generateRefreshToken } from '../auth/jwtservice.js';
import {
  loginUserService, logoutUserService, refreshUserAccessTokenService,
  getAssignedContacts
} from './userService.js';
import { forgotPasswordUserService, resetPasswordUserService, } from './userService.js';


// ===============User Login Controller===============
export const loginUser =
  async (req, res) => {

    try {

      const result =
        await loginUserService(
          req.body
        );

      const { accessToken, refreshToken, user } = result;

      // Set HTTP-Only Cookie for the refresh token
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });

      return res.status(200).json({
        success: true,
        message:
          'User logged in successfully',
        data: {
          user,
          accessToken,
        },
      });

    } catch (error) {

      return res.status(400).json({
        success: false,
        message: error.message,
      });

    }
  };



// ===============User Logout Controller===============
export const logoutUser = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (refreshToken) {
      await logoutUserService(refreshToken);
    }

    // Clear cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
    });

    return res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


//===========user access token refresh controller===========
export const refreshUserAccessToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token not found in cookies or body',
      });
    }

    const result = await refreshUserAccessTokenService(refreshToken);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message,
    });
  }
};



// ===================== FORGOT PASSWORD =====================
export const forgotPasswordUser = async (req, res) => {
  try {
    const { email } = req.body;
    const result = await forgotPasswordUserService(email);
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
export const resetPasswordUser = async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;
    const result = await resetPasswordUserService(
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







// ===================== ASSIGNED CONTACTS =====================
export const getMyAssignedContacts = async (req, res) => {
  try {
    // Safety check — make sure auth middleware ran properly
    if (!req.user || !req.user.id || !req.user.tenantId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Missing user information",
      });
    }

    const userId = req.user.id;
    const tenantId = req.user.tenantId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await getAssignedContacts(userId, tenantId, {
      page, limit,
    });

    return res.status(200).json({
      success: true,
      message: "Assigned contacts fetched successfully",
      ...result,
    });
  } catch (error) {
    console.error("❌ Error in getMyAssignedContacts:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch assigned contacts",
      error: error.message,
    });
  }
};