// src/services/googleSheets.service.js

import api from "../lib/axios";

// If your axios baseURL already includes '/api', use '/google-sheets'
// Otherwise use '/api/google-sheets'
const GOOGLE_SHEETS_BASE = "/google-sheets";

// ── Existing OAuth Connections ──
export const getGoogleSheetsAuthUrl = async () => {
  try {
    const res = await api.get(`${GOOGLE_SHEETS_BASE}/auth-url`);
    return { success: true, data: res.data?.data || res.data };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.error || error.response?.data?.message || "Failed to get auth URL",
    };
  }
};

export const getGoogleSheetsStatus = async () => {
  try {
    const res = await api.get(`${GOOGLE_SHEETS_BASE}/status`);
    return { success: true, data: res.data?.data || res.data };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.error || error.response?.data?.message || "Failed to fetch status",
    };
  }
};

export const disconnectGoogleSheets = async () => {
  try {
    const res = await api.delete(`${GOOGLE_SHEETS_BASE}/disconnect`);
    return { success: true, data: res.data };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.error || error.response?.data?.message || "Failed to disconnect",
    };
  }
};

// ── Existing Sheet Broadcast Actions ──
export const previewGoogleSheet = async (sheetUrl, tabName = "Sheet1") => {
  try {
    const res = await api.get(`${GOOGLE_SHEETS_BASE}/preview`, {
      params: { sheetUrl, tabName },
    });
    return { success: true, data: res.data?.data || res.data };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.error || "Failed to preview Google Sheet",
    };
  }
};

export const launchGoogleSheetBroadcast = async (payload) => {
  try {
    const res = await api.post(`${GOOGLE_SHEETS_BASE}/broadcast`, payload);
    return { success: true, data: res.data?.data || res.data };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.error || "Failed to launch sheet broadcast",
    };
  }
};

// ── 🆕 Custom Column Fields API Methods ──

/**
 * Fetch all column fields configured for the tenant
 */
export const getGoogleSheetsFields = async () => {
  try {
    const res = await api.get(`${GOOGLE_SHEETS_BASE}/fields`);
    return { 
      success: true, 
      data: res.data?.data || res.data?.fields || res.data 
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.error || error.response?.data?.message || "Failed to fetch fields configuration",
    };
  }
};

/**
 * Add a new custom sheet column field
 */
export const addGoogleSheetsField = async (payload) => {
  try {
    const res = await api.post(`${GOOGLE_SHEETS_BASE}/fields`, payload);
    return { 
      success: true, 
      data: res.data?.data || res.data?.field || res.data 
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.error || error.response?.data?.message || "Failed to add custom field",
    };
  }
};

/**
 * Update an existing custom column field (rename, change type/options)
 */
export const updateGoogleSheetsField = async (fieldId, payload) => {
  try {
    const res = await api.put(`${GOOGLE_SHEETS_BASE}/fields/${fieldId}`, payload);
    return { 
      success: true, 
      data: res.data?.data || res.data?.field || res.data 
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.error || error.response?.data?.message || "Failed to update field",
    };
  }
};

/**
 * Toggle a standard default field column ON/OFF
 */
export const toggleGoogleSheetsField = async (fieldId, isActive) => {
  try {
    const res = await api.put(`${GOOGLE_SHEETS_BASE}/fields/${fieldId}/toggle`, { isActive });
    return { 
      success: true, 
      data: res.data?.data || res.data?.field || res.data 
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.error || error.response?.data?.message || "Failed to toggle field sync status",
    };
  }
};

/**
 * Delete a custom column field
 */
export const deleteGoogleSheetsField = async (fieldId) => {
  try {
    const res = await api.delete(`${GOOGLE_SHEETS_BASE}/fields/${fieldId}`);
    return { success: true, data: res.data };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.error || error.response?.data?.message || "Failed to delete custom field",
    };
  }
};

/**
 * Submit manual array ordering configuration list for columns positions
 */
export const reorderGoogleSheetsFields = async (fieldOrders) => {
  try {
    const res = await api.put(`${GOOGLE_SHEETS_BASE}/fields/reorder`, { fieldOrders });
    return { 
      success: true, 
      data: res.data?.data || res.data?.fields || res.data 
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.error || error.response?.data?.message || "Failed to save columns alignment order",
    };
  }
};

/**
 * Rebuild current headers structure in Google Sheets dynamically from DB layout
 */
export const syncGoogleSheetsFields = async () => {
  try {
    const res = await api.post(`${GOOGLE_SHEETS_BASE}/fields/sync`);
    return { 
      success: true, 
      data: res.data?.data || res.data 
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.error || error.response?.data?.message || "Failed to synchronize configurations to sheets",
    };
  }
};

// ── Named & Default Combined Export ──
export default {
  getGoogleSheetsAuthUrl,
  getGoogleSheetsStatus,
  disconnectGoogleSheets,
  previewGoogleSheet,
  launchGoogleSheetBroadcast,
  getGoogleSheetsFields,
  addGoogleSheetsField,
  updateGoogleSheetsField,
  toggleGoogleSheetsField,
  deleteGoogleSheetsField,
  reorderGoogleSheetsFields,
  syncGoogleSheetsFields,
};


// 🆕 Export syncFields for Repair Sheet Structure
export const syncFields = async () => {
  // Use whatever axios/api client instance is used in this file (e.g., api, apiClient, or axios)
  const response = await api.post('/google-sheets/fields/sync'); 
  return response.data;
};