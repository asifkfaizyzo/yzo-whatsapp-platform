// src/services/tenant.service.js
import api from "../lib/axios";

const TENANT_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api2`;

/**
 * Get all users/agents created under the tenant
 */
export const getTenantUsers = async () => {
  try {
    const response = await api.get(`${TENANT_BASE_URL}/get-all-users`);
    return {
      success: true,
      data: response.data.data.users || response.data.data, // adjust depending on backend envelope
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to fetch users",
    };
  }
};

/**
 * Assign a contact to a user
 */
export const assignContact = async (contactId, userId) => {
  try {
    const response = await api.patch(`${TENANT_BASE_URL}/assign-contact/${contactId}`, { userId });
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to assign contact",
    };
  }
};

/**
 * Re-assign a contact to a different user
 */
export const reassignContact = async (contactId, newUserId) => {
  try {
    const response = await api.patch(`${TENANT_BASE_URL}/re-assign-contacts/${contactId}`, { newUserId });
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to re-assign contact",
    };
  }
};

/**
 * Unassign a contact
 */
export const unassignContact = async (contactId) => {
  try {
    const response = await api.patch(`${TENANT_BASE_URL}/unassign-contact/${contactId}`);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to unassign contact",
    };
  }
};

/**
 * Assign multiple contacts to an agent in bulk
 */
export const assignMultipleContacts = async (contactIds, userId) => {
  try {
    const response = await api.patch(`${TENANT_BASE_URL}/assign-multiple`, {
      contactIds,
      userId,
    });
    return {
      success: true,
      message: response.data.message || "Contacts assigned successfully",
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to assign contacts in bulk",
    };
  }
};
