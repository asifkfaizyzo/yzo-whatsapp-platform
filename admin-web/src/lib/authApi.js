// src/api/authApi.js

import api from './axios';
import { useAdminAuthStore } from '../store/useAdminAuthStore';

// ✅ Super Admin Register
export const registerSuperAdmin = async (userData) => {
  try {
    const response = await api.post('/create', {
      name: userData.name,
      email: userData.email,
      password: userData.password,
    });
    
    const registerData = response.data?.data;
    const user = registerData?.user || registerData?.superAdmin;
    if (registerData && user && registerData.accessToken) {
      useAdminAuthStore.getState().login(user, registerData.accessToken);
    }

    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || 'Registration failed',
    };
  }
};

// ✅ Super Admin Login
export const loginSuperAdmin = async (email, password) => {
  try {
    const response = await api.post('/login', { email, password });
    const loginData = response.data?.data;
    const user = loginData?.user || loginData?.superAdmin;
    if (loginData && user && loginData.accessToken) {
      useAdminAuthStore.getState().login(user, loginData.accessToken);
    }

    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || 'Login failed',
    };
  }
};

// ✅ Logout
export const logoutSuperAdmin = async () => {
  try {
    await useAdminAuthStore.getState().logout();
    return { success: true };
  } catch (error) {
    return { success: false };
  }
};

// ✅ Request Reset Link for Super Admin
export const forgotPasswordSuperAdmin = async (email) => {
  try {
    const response = await api.post('/forgot-sup-password', { email });
    return { success: true, message: response.data?.message };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to send recovery email',
    };
  }
};

// ✅ Reset Password for Super Admin
export const resetPasswordSuperAdmin = async (token, newPassword, confirmPassword) => {
  try {
    const response = await api.post('/reset-sup-password', {
      token,
      newPassword,
      confirmPassword,
    });
    return { success: true, message: response.data?.message };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to reset password',
    };
  }
};
