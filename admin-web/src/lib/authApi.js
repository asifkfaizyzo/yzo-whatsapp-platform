// src/api/authApi.js

import api from './axios';

// ✅ Super Admin Register
export const registerSuperAdmin = async (userData) => {
  try {
    const response = await api.post('/create', {
      name: userData.name,
      email: userData.email,
      password: userData.password,
      //   companyName: userData.companyName,
    });
    
    const registerData = response.data?.data;
    if (registerData) {
      if (registerData.accessToken) {
        localStorage.setItem('accessToken', registerData.accessToken);
      }
      if (registerData.refreshToken) {
        localStorage.setItem('refreshToken', registerData.refreshToken);
      }
      if (registerData.superAdmin) {
        localStorage.setItem('user', JSON.stringify(registerData.superAdmin));
      }
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

    // Save tokens
    if (loginData) {
      if (loginData.accessToken) {
        localStorage.setItem('accessToken', loginData.accessToken);
      }
      if (loginData.refreshToken) {
        localStorage.setItem('refreshToken', loginData.refreshToken);
      }
      if (loginData.superAdmin) {
        localStorage.setItem('user', JSON.stringify(loginData.superAdmin));
      }
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
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken && refreshToken !== 'undefined') {
      await api.post('/logout', { refreshToken });
    }
    localStorage.clear();
    return { success: true };
  } catch (error) {
    localStorage.clear();   // clear even if API fails
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
