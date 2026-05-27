import bcrypt from 'bcrypt';
import pkg from '@prisma/client';

import {generateAccessToken, generateRefreshToken} from '../auth/jwtservice.js';
import {createSuperAdminService,loginSuperAdminService,logoutSuperAdminService,
        refreshAccessTokenService} from './superadminService.js';





// // 1️⃣ Create SuperAdmin
// export const createSuperAdmin = async (req, res) => {
//   try {
//     const result = await createSuperAdminService(req.body);
//     console.log('SuperAdmin created:', result);

//     return res.status(201).json({
//       success: true,
//       message: 'SuperAdmin created successfully',
//       data: result,
//     });
//   } catch (error) {
//     return res.status(400).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };


// 2️⃣ SuperAdmin Registration
export const createSuperAdmin = async (req,res) => {
  try {
    const result =
      await createSuperAdminService(
        req.body
      );

    return res.status(201).json({
      success: true,
      message:
        'SuperAdmin created successfully',
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


// 3️⃣ SuperAdmin Login
export const loginSuperAdmin =
  async (req, res) => {
    try {
      const result =
        await loginSuperAdminService(
          req.body
        );

      return res.status(200).json({
        success: true,
        message:'SuperAdmin logged in successfully',
        data: result,
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  };


  // 4️⃣ SuperAdmin Logout 
 export const logoutSuperAdmin =
  async (req, res) => {
    try {

      const { refreshToken } =
        req.body;

      const result =
        await logoutSuperAdminService(
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


////generating access token when access token expires
  export const refreshAccessTokenController =
  async (req, res) => {

    try {

      // 1️⃣ Get refresh token from body
      const { refreshToken } =
        req.body;

      // 2️⃣ Call service
      const result =
        await refreshAccessTokenService(
          refreshToken
        );

      // 3️⃣ Send response
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