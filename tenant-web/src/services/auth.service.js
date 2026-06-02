// src/services/auth.service.js

import api from "../lib/axios";

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
      const userLogoutUrl = `${import.meta.env.VITE_USER_API_URL}/logout-user`;
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

