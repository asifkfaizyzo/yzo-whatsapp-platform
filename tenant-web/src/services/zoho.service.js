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