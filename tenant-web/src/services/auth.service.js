// src/services/auth.service.js

import api from "../lib/axios";
import api2 from "../lib/axios"; // Targets VITE_API_URL (/api2)
import axios from "axios"; // Raw axios to easily target VITE_USER_API_URL (/api3)

const USER_API_URL = `${import.meta.env.VITE_BACKEND_URL}/api3`;

// Register Tenant
export const registerTenant = async (formData) => {
  try {
    const response = await api.post("/register", {
      tenantName: formData.tenantName,
      email: formData.email,
      password: formData.password,
      phone: formData.phone,
      address: formData.address,
    });

    console.log("REGISTER RESPONSE:", response.data);
    localStorage.setItem("accessToken", response.data.data.accessToken);

    localStorage.setItem("refreshToken", response.data.data.refreshToken);

    localStorage.setItem("user", JSON.stringify(response.data.data.user));

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Registration failed",
    };
  }
};

// Login
export const login = async (email, password) => {
  try {
    const response = await api.post("/login", {
      email,
      password,
    });

    localStorage.setItem("accessToken", response.data.data.accessToken);
    localStorage.setItem("refreshToken", response.data.data.refreshToken);
    localStorage.setItem("user", JSON.stringify(response.data.data.user));

    console.log(response.data.data.user);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Login failed",
    };
  }
};

// Logout


export const logout = async () => {
  try {
    const refreshToken = localStorage.getItem("refreshToken");
    const userStr = localStorage.getItem("user");
    const user = userStr ? JSON.parse(userStr) : null;

    if (user?.type === "USER") {
      const userLogoutUrl = `${USER_API_URL}/logout-user`;
      await api.post(userLogoutUrl, {
        refreshToken,
      });
    } else {
      await api.post("/logout", {
        refreshToken,
      });
    }

    localStorage.clear();

    return { success: true };
  } catch (error) {
    localStorage.clear();
    return { success: false };
  }
};



// Invite / Create a new agent user under this Tenant
export const createTenantUser = async (userData) => {
  try {
    const response = await api.post("/create-user", {
      name: userData.name,
      email: userData.email,
      password: userData.password, // Backend requires a password to create a user
    });

    return {
      success: true,
      data: response.data.data, // This contains the created user object
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to create user",
    };
  }
};

// Get all users under this Tenant
export const getTenantUsers = async () => {
  try {
    const response = await api.get("/get-all-users");
    return {
      success: true,
      data: response.data.data, // Contains count and users array
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to fetch users",
    };
  }
};

// Update user details under this Tenant
export const updateTenantUser = async (userId, userData) => {
  try {
    const response = await api.put(`/update-user/${userId}`, {
      name: userData.name,
      email: userData.email,
    });
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to update user",
    };
  }
};

// Deactivate user under this Tenant
export const deactivateTenantUser = async (userId) => {
  try {
    const response = await api.patch(`/users/${userId}/deactivate`);
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to deactivate user",
    };
  }
};

// Reactivate user under this Tenant
export const reactivateTenantUser = async (userId) => {
  try {
    const response = await api.patch(`/users/${userId}/reactivate`);
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to reactivate user",
    };
  }
};

// Delete user under this Tenant
export const deleteTenantUser = async (userId) => {
  try {
    const response = await api.delete(`/delete-user/${userId}`);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to delete user",
    };
  }
};


// ✅ Forgot Password for Tenant/User
export const forgotPasswordTenant = async (email, roleType = 'TENANT') => {
  try {
    if (roleType === 'USER') {
      // Call User forgot password endpoint
      const response = await axios.post(`${USER_API_URL}/forgot-usr-password`, { email });
      return { success: true, message: response.data?.message };
    } else {
      // Call Tenant forgot password endpoint
      const response = await api2.post('/forgot-ten-password', { email });
      return { success: true, message: response.data?.message };
    }
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to send recovery email',
    };
  }
};

// ✅ Reset Password for Tenant/User
export const resetPasswordTenant = async (token, newPassword, confirmPassword, roleType = 'TENANT') => {
  try {
    if (roleType === 'USER') {
      const response = await axios.post(`${USER_API_URL}/reset-usr-password`, {
        token,
        newPassword,
        confirmPassword
      });
      return { success: true, message: response.data?.message };
    } else {
      const response = await api2.post('/reset-ten-password', {
        token,
        newPassword,
        confirmPassword
      });
      return { success: true, message: response.data?.message };
    }
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to reset password',
    };
  }
};


