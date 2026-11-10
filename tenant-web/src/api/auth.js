// tenant-web/src/api/auth.js (do not remove this comment)
import api, { userApi } from "./axios";
import { useAuthStore } from "../store/useAuthStore";

// Step 1: First name + Last name
export const registerStep1 = async (formData) => {
  try {
    const response = await api.post("/register/step-1", {
      firstName: formData.firstName,
      lastName: formData.lastName,
    });

    const currentToken = useAuthStore.getState().accessToken;
    const onboardingUser = { ...response.data.data.user, type: "TENANT" };
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
    const onboardingUser = { ...response.data.data.user, type: "TENANT" };
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
    const onboardingUser = { ...response.data.data.user, type: "TENANT" };
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
    const onboardingUser = { ...response.data.data.user, type: "TENANT" };
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
    const onboardingUser = { ...response.data.data.user, type: "TENANT" };
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

    const loggedInUser = { ...response.data.data.user, type: "TENANT" };
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

    useAuthStore
      .getState()
      .login(response.data.data.user, response.data.data.accessToken);

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
export const forgotPasswordTenant = async (email, roleType = "TENANT") => {
  try {
    if (roleType === "USER") {
      const response = await userApi.post("/forgot-usr-password", { email });
      return { success: true, message: response.data?.message };
    } else {
      const response = await api.post("/forgot-ten-password", { email });
      return { success: true, message: response.data?.message };
    }
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to send recovery email",
    };
  }
};

// Reset Password for Tenant/User
export const resetPasswordTenant = async (
  token,
  newPassword,
  confirmPassword,
  roleType = "TENANT",
) => {
  try {
    if (roleType === "USER") {
      const response = await userApi.post("/reset-usr-password", {
        token,
        newPassword,
        confirmPassword,
      });
      return { success: true, message: response.data?.message };
    } else {
      const response = await api.post("/reset-ten-password", {
        token,
        newPassword,
        confirmPassword,
      });
      return { success: true, message: response.data?.message };
    }
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to reset password",
    };
  }
};

// Google Login
export const loginWithGoogle = async (credential) => {
  try {
    const response = await api.post("/google-login", { credential });

    useAuthStore
      .getState()
      .login(response.data.data.user, response.data.data.accessToken);

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

    useAuthStore
      .getState()
      .login(response.data.data.user, response.data.data.accessToken);

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

// ═══════════════════════════════════════════════════════════════════
//  NEW SIGNUP FLOW ENDPOINTS (Phase 1 — dummy stubs)
//  These will be replaced with real API calls in Phase 3.
//  Currently they return mock success responses so the frontend
//  can be tested end-to-end with MOCK_SIGNUP = true.
// ═══════════════════════════════════════════════════════════════════

// POST /tenant/auth/signup
export const signupWithEmail = async (email, password) => {
  try {
    const response = await api.post("/auth/signup", { email, password });
    const { accessToken, user } = response.data.data;
    useAuthStore.getState().login(user, accessToken);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Signup failed",
    };
  }
};

// POST /tenant/auth/google-signup
export const signupWithGoogle = async (credential) => {
  try {
    const response = await api.post("/auth/google-signup", { credential });
    const { accessToken, user } = response.data.data;
    useAuthStore.getState().login(user, accessToken);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Google signup failed",
    };
  }
};

// POST /tenant/auth/facebook-signup
export const signupWithFacebook = async (accessToken) => {
  try {
    const response = await api.post("/auth/facebook-signup", { accessToken });
    const { accessToken: token, user } = response.data.data;
    useAuthStore.getState().login(user, token);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Facebook signup failed",
    };
  }
};

// POST /tenant/auth/onboarding/verify-email
export const verifyEmailOtpNew = async (otp) => {
  try {
    const response = await api.post("/auth/onboarding/verify-email", { otp });
    const currentToken = useAuthStore.getState().accessToken;
    const user = { ...response.data.data.user, type: "TENANT" };
    useAuthStore.getState().login(user, currentToken);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Verification failed",
    };
  }
};

// POST /tenant/auth/onboarding/resend-otp
export const resendOtp = async () => {
  try {
    const response = await api.post("/auth/onboarding/resend-otp");
    return { success: true, message: response.data?.message || "Code sent" };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to resend code",
    };
  }
};

// PUT /tenant/auth/onboarding/profile
export const updateOnboardingProfile = async (data) => {
  try {
    const response = await api.put("/auth/onboarding/profile", data);
    const currentToken = useAuthStore.getState().accessToken;
    const user = { ...response.data.data.user, type: "TENANT" };
    useAuthStore.getState().login(user, currentToken);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Profile update failed",
    };
  }
};

// PUT /tenant/auth/onboarding/set-password (OAuth users)
export const setOAuthPassword = async (password) => {
  try {
    const response = await api.put("/auth/onboarding/set-password", {
      password,
    });
    const currentToken = useAuthStore.getState().accessToken;
    const user = { ...response.data.data.user, type: "TENANT" };
    useAuthStore.getState().login(user, currentToken);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Password setup failed",
    };
  }
};

// PUT /tenant/auth/onboarding/step  (steps 4, 5, 6, 7)
export const updateOnboardingStep = async (step, data) => {
  try {
    const response = await api.put("/auth/onboarding/step", { step, data });
    const currentToken = useAuthStore.getState().accessToken;
    const user = { ...response.data.data.user, type: "TENANT" };
    useAuthStore.getState().login(user, currentToken);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || `Step ${step} failed`,
    };
  }
};

// GET /tenant/auth/check-username?q=xxx
export const checkUsername = async (username) => {
  try {
    const response = await api.get("/auth/check-username", {
      params: { q: username },
    });
    return { success: true, data: response.data.data };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Username check failed",
    };
  }
};

// GET /tenant/auth/username-suggestions?firstName=x&lastName=y
export const getUsernameSuggestions = async (firstName, lastName) => {
  try {
    const response = await api.get("/auth/username-suggestions", {
      params: { firstName, lastName },
    });
    return { success: true, data: response.data.data };
  } catch (error) {
    return {
      success: false,
      message:
        error.response?.data?.message || "Failed to fetch suggestions",
    };
  }
};