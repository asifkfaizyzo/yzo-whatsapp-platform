import bcrypt from 'bcrypt';
import pkg from '@prisma/client';

import {generateAccessToken, generateRefreshToken} from '../auth/jwtservice.js';
import {createSuperAdminService,loginSuperAdminService,logoutSuperAdminService,
        refreshAccessTokenService,getAllTenantsService,getTenantByIdService,
        updateTenantByIdService,deactivateTenantService,reactivateTenantService,
        deleteTenantByIdService,approveTenantService,blockTenantService,
        unblockTenantService,forgotPasswordSuperAdminService,resetPasswordSuperAdminService
      } from './superadminService.js';





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


// 2️⃣ SuperAdmin Creation
export const createSuperAdmin = async (req,res) => {
  try {
    const result =
      await createSuperAdminService(
        req.body
      );

    return res.status(201).json({
      success: true,
      message: 'SuperAdmin created successfully',
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
        console.log(req.body);
        console.log(refreshToken);

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

  
  

//generating access token when access token expires
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




// ===================== FORGOT PASSWORD =====================
export const forgotPasswordSuperAdmin = async (req, res) => {
  try {
    const { email } = req.body;
    const result = await forgotPasswordSuperAdminService(email);
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
export const resetPasswordSuperAdmin = async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;
    const result = await resetPasswordSuperAdminService(
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


  //get all tenants by superadmin
  export const getAllTenants = async (req, res) => {
  try {
    const result = await getAllTenantsService();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};



//Get tenant by id by superadmin
export const getTenantById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await getTenantByIdService(id);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};



//update tenant by id by superadmin
export const updateTenantById = async (req, res) => {
  try {
    // Tenant ID from URL params
    const { id } = req.params;
    // Data from request body
    const data = req.body;
    const result = await updateTenantByIdService(id, data);
    return res.status(200).json({ success: true, data: result,});
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message});
  }
};



//deactivate tenant by id by superadmin
export const deactivateTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deactivateTenantService(id);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};



//Reactivate tenant by id by superadmin
export const reactivateTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await reactivateTenantService(id);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};




//Delete tenant by id by superadmin
export const deleteTenantById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteTenantByIdService(id);
    return res.status(200).json({ success: true, data: result,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message,});
  }
};



//Approve Tenant service by superadmin
export const approveTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await approveTenantService(id);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};


//Block Tenant service by superadmin
export const blockTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await blockTenantService(id);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};


//Unblock Tenant service by superadmin
export const unblockTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await unblockTenantService(id);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};


