import bcrypt from 'bcrypt';
import pkg from '@prisma/client';

import {generateAccessToken, generateRefreshToken} from '../auth/jwtservice.js';
import{registerTenantService,loginTenantService,
       logoutTenantService, refreshTenantAccessTokenService,
      createUserService} from './tenantService.js';


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



// Tenant Login Controller
export const loginTenant =
  async (req, res) => {

    try {

      const result =
        await loginTenantService(
          req.body
        );

      return res.status(200).json({
        success: true,
        message:
          'Tenant logged in successfully',
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