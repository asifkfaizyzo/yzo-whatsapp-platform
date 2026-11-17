// admin-web/src/api/tenants.js (do not remove this comment)
import api from "./axios";

export const fetchTenants = async (params = {}) => {
  try {
    const res = await api.get("/tenants", { params });
    return { success: true, data: res.data.data };
  } catch (err) {
    return {
      success: false,
      message: err.response?.data?.message || "Failed to fetch tenants",
      errors: err.response?.data?.errors,
    };
  }
};

export const getTenantById = async (id) => {
  try {
    const res = await api.get(`/tenants/${id}`);
    return { success: true, data: res.data.data };
  } catch (err) {
    return {
      success: false,
      message: err.response?.data?.message || "Failed to fetch tenant details",
    };
  }
};

export const registerTenant = async (data) => {
  try {
    const res = await api.post("/tenants/register", data);
    return { success: true, data: res.data.data, message: res.data.message };
  } catch (err) {
    return {
      success: false,
      message: err.response?.data?.message || "Failed to register tenant",
      errors: err.response?.data?.errors,
    };
  }
};

export const updateTenant = async (id, data) => {
  try {
    const res = await api.put(`/tenants/${id}`, data);
    return { success: true, data: res.data.data, message: res.data.message };
  } catch (err) {
    return {
      success: false,
      message: err.response?.data?.message || "Failed to update tenant",
      errors: err.response?.data?.errors,
    };
  }
};

export const approveTenant = async (id) => {
  try {
    const res = await api.patch(`/tenants/${id}/approve`);
    return { success: true, data: res.data.data, message: res.data.message };
  } catch (err) {
    return {
      success: false,
      message: err.response?.data?.message || "Failed to approve tenant",
    };
  }
};

export const blockTenant = async (id, reason) => {
  try {
    const res = await api.patch(`/tenants/${id}/block`, { reason });
    return { success: true, data: res.data.data, message: res.data.message };
  } catch (err) {
    return {
      success: false,
      message: err.response?.data?.message || "Failed to block tenant",
    };
  }
};

export const unblockTenant = async (id) => {
  try {
    const res = await api.patch(`/tenants/${id}/unblock`);
    return { success: true, data: res.data.data, message: res.data.message };
  } catch (err) {
    return {
      success: false,
      message: err.response?.data?.message || "Failed to unblock tenant",
    };
  }
};

export const deactivateTenant = async (id) => {
  try {
    const res = await api.patch(`/tenants/${id}/deactivate`);
    return { success: true, data: res.data.data, message: res.data.message };
  } catch (err) {
    return {
      success: false,
      message: err.response?.data?.message || "Failed to suspend tenant",
    };
  }
};

export const reactivateTenant = async (id) => {
  try {
    const res = await api.patch(`/tenants/${id}/reactivate`);
    return { success: true, data: res.data.data, message: res.data.message };
  } catch (err) {
    return {
      success: false,
      message: err.response?.data?.message || "Failed to activate tenant",
    };
  }
};

export const deleteTenant = async (id) => {
  try {
    const res = await api.delete(`/tenants/${id}`);
    return { success: true, data: res.data.data, message: res.data.message };
  } catch (err) {
    return {
      success: false,
      message: err.response?.data?.message || "Failed to delete tenant",
    };
  }
};

// -- Agent Moderation --

export const deactivateUser = async (userId) => {
  try {
    const res = await api.patch(`/tenants/users/${userId}/deactivate`);
    return { success: true, data: res.data.data, message: res.data.message };
  } catch (err) {
    return {
      success: false,
      message: err.response?.data?.message || "Failed to deactivate agent",
    };
  }
};

export const reactivateUser = async (userId) => {
  try {
    const res = await api.patch(`/tenants/users/${userId}/reactivate`);
    return { success: true, data: res.data.data, message: res.data.message };
  } catch (err) {
    return {
      success: false,
      message: err.response?.data?.message || "Failed to reactivate agent",
    };
  }
};

// -- Subscription Operations --

export const manualActivateSubscription = async (tenantId, payload) => {
  try {
    const res = await api.post(
      `/admin/subscriptions/${tenantId}/manual-activate`,
      payload
    );
    return { success: true, data: res.data.data, message: res.data.message };
  } catch (err) {
    return {
      success: false,
      message: err.response?.data?.message || "Failed to manually activate plan",
    };
  }
};

export const updateSubscription = async (tenantId, payload) => {
  try {
    const res = await api.patch(`/admin/subscriptions/${tenantId}`, payload);
    return { success: true, data: res.data.data, message: res.data.message };
  } catch (err) {
    return {
      success: false,
      message: err.response?.data?.message || "Failed to update subscription",
    };
  }
};