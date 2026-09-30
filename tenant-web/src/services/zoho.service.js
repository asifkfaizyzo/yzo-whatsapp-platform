// src/services/zoho.service.js

import api from "../lib/axios";

const ZOHO_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api2/zoho`;

/**
 * Generate Zoho CRM OAuth authorization URL
 */
export const getZohoAuthUrl = async () => {
  try {
    const response = await api.get(`${ZOHO_BASE_URL}/connect`);
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to start Zoho connection",
    };
  }
};

/**
 * Fetch Zoho CRM integration status
 */
export const getZohoStatus = async () => {
  try {
    const response = await api.get(`${ZOHO_BASE_URL}/status`);
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to fetch Zoho status",
    };
  }
};

/**
 * Fetch Zoho CRM plan info and capabilities
 */


export const getZohoPlanInfo = async (forceRefresh = false) => {
  try {
    const url = forceRefresh ? `${ZOHO_BASE_URL}/plan?refresh=true` : `${ZOHO_BASE_URL}/plan`;
    const response = await api.get(url);
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to fetch Zoho plan info",
    };
  }
};

/**
 * Test live integration connection with Zoho CRM
 */
export const testZohoConnection = async () => {
  try {
    const response = await api.post(`${ZOHO_BASE_URL}/test`);
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Connection test failed",
    };
  }
};

/**
 * Disconnect Zoho CRM integration
 */
export const disconnectZoho = async () => {
  try {
    const response = await api.post(`${ZOHO_BASE_URL}/disconnect`);
    return {
      success: true,
      message: response.data?.message || "Disconnected Zoho successfully",
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to disconnect Zoho",
    };
  }
};

/**
 * Trigger background contact synchronization to Zoho
 */
export const triggerZohoSync = async (syncType = "FULL") => {
  try {
    const response = await api.post(`${ZOHO_BASE_URL}/sync/contacts`, { syncType });
    return {
      success: true,
      data: response.data.data,
      message: response.data?.message || "Contact synchronization queued",
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to start contact sync",
    };
  }
};

/**
 * Trigger incremental contact sync (only changed contacts)
 */
export const triggerZohoIncrementalSync = async () => {
  try {
    const response = await api.post(`${ZOHO_BASE_URL}/sync/incremental`);
    return {
      success: true,
      data: response.data.data,
      message: response.data?.message || "Incremental sync queued",
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to start incremental sync",
    };
  }
};

/**
 * Fetch contact sync statistics
 */
export const getZohoSyncStatus = async () => {
  try {
    const response = await api.get(`${ZOHO_BASE_URL}/sync/status`);
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to fetch sync status",
    };
  }
};

/**
 * Fetch Zoho automation settings and preferences
 */
export const getZohoPreferences = async () => {
  try {
    const response = await api.get(`${ZOHO_BASE_URL}/preferences`);
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to fetch preferences",
    };
  }
};

/**
 * Save new Zoho preferences and automation toggles
 */
export const updateZohoPreferences = async (preferences) => {
  try {
    const response = await api.put(`${ZOHO_BASE_URL}/preferences`, preferences);
    return {
      success: true,
      data: response.data.data,
      message: response.data?.message || "Preferences updated successfully",
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to update preferences",
    };
  }
};