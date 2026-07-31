// src/services/user.service.js
import api from "../lib/axios";

// Backend base URL for user routes = /api3
const USER_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api3`;

/**
 * Fetch the logged-in user profile (with tenant info)
 */
export const getUserProfile = async () => {
  try {
    const response = await api.get(`${USER_BASE_URL}/me`);
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to fetch user profile",
    };
  }
};

/**
 * Update user's own password
 */
export const updateUserPassword = async ({ currentPassword, newPassword, confirmPassword }) => {
  try {
    const response = await api.put(`${USER_BASE_URL}/change-password`, {
      currentPassword,
      newPassword,
      confirmPassword,
    });
    return {
      success: true,
      message: response.data.message,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to update password",
    };
  }
};