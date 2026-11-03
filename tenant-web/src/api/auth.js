// tenant-web/src/api/auth.js (do not remove this comment)
import api, { userApi } from "./axios";
import { useAuthStore } from '../store/useAuthStore';

// Step 1: First name + Last name
export const registerStep1 = async (formData) => {
  try {
    const response = await api.post("/register/step-1", {
      firstName: formData.firstName,
      lastName: formData.lastName,
    });

    const currentToken = useAuthStore.getState().accessToken;
    const onboardingUser = { ...response.data.data.user, type: 'TENANT' };
    useAuthStore.getState().login(onboardingUser, currentToken || null);

    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Step 1 failed",
    };
  }
};

// Step 2: Email
export const registerStep2 = async (formData) => {
  try {
    const response = await api.put("/register/step-2", {
      email: formData.email,
    });

    const currentToken = useAuthStore.getState().accessToken;
    const onboardingUser = { ...response.data.data.user, type: 'TENANT' };
    useAuthStore.getState().login(onboardingUser, currentToken || null);

    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Step 2 failed",
    };
  }
};

// Step 2.5: Verify Email OTP Code
export const verifyEmailOtp = async (otpCode) => {
  try {
    const response = await api.post("/register/verify-email", {
      otpCode,
    });

    const currentToken = useAuthStore.getState().accessToken;
    const onboardingUser = { ...response.data.data.user, type: 'TENANT' };
    useAuthStore.getState().login(onboardingUser, currentToken || null);

    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Verification failed",
    };
  }
};

// Step 3: Password
export const registerStep3 = async (formData) => {
  try {
    const response = await api.put("/register/step-3", {
      password: formData.password,
    });

    const currentToken = useAuthStore.getState().accessToken;
    const onboardingUser = { ...response.data.data.user, type: 'TENANT' };
    useAuthStore.getState().login(onboardingUser, currentToken || null);

    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Step 3 failed",
    };
  }
};

// Step 4: Company name + Website
export const registerStep4 = async (formData) => {
  try {
    const response = await api.put("/register/step-4", {
      tenantName: formData.tenantName,
      websiteUrl: formData.websiteUrl,
    });

    const currentToken = useAuthStore.getState().accessToken;
    const onboardingUser = { ...response.data.data.user, type: 'TENANT' };
    useAuthStore.getState().login(onboardingUser, currentToken || null);

    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Step 4 failed",
    };
  }
};

// Step 5: Phone + Team Size + Use Case
export const registerStep5 = async (formData) => {
  try {
    const response = await api.put("/register/step-5", {
      phone: formData.phone,
      companySize: formData.companySize,
      useCase: formData.useCase,
    });

    const loggedInUser = { ...response.data.data.user, type: 'TENANT' };
    useAuthStore.getState().login(loggedInUser, response.data.data.accessToken);

    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Step 5 failed",
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

    useAuthStore.getState().login(response.data.data.user, response.data.data.accessToken);

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
    await useAuthStore.getState().logout();
    return { success: true };
  } catch (error) {
    return { success: false };
  }
};

// Invite / Create a new agent user under this Tenant
export const createTenantUser = async (userData) => {
  try {
    const response = await api.post("/create-user", {
      name: userData.name,
      email: userData.email,
      password: userData.password,
    });

    return {
      success: true,
      data: response.data.data,
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
      data: response.data.data,
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

// Forgot Password for Tenant/User
export const forgotPasswordTenant = async (email, roleType = 'TENANT') => {
  try {
    if (roleType === 'USER') {
      const response = await userApi.post('/forgot-usr-password', { email });
      return { success: true, message: response.data?.message };
    } else {
      const response = await api.post('/forgot-ten-password', { email });
      return { success: true, message: response.data?.message };
    }
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to send recovery email',
    };
  }
};

// Reset Password for Tenant/User
export const resetPasswordTenant = async (token, newPassword, confirmPassword, roleType = 'TENANT') => {
  try {
    if (roleType === 'USER') {
      const response = await userApi.post('/reset-usr-password', {
        token,
        newPassword,
        confirmPassword
      });
      return { success: true, message: response.data?.message };
    } else {
      const response = await api.post('/reset-ten-password', {
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

// Google Login
export const loginWithGoogle = async (credential) => {
  try {
    const response = await api.post("/google-login", { credential });

    useAuthStore.getState().login(response.data.data.user, response.data.data.accessToken);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Google sign-in failed",
    };
  }
};

// Facebook Login
export const loginWithFacebook = async (accessToken) => {
  try {
    const response = await api.post("/facebook-login", { accessToken });

    useAuthStore.getState().login(response.data.data.user, response.data.data.accessToken);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Facebook sign-in failed",
    };
  }
};