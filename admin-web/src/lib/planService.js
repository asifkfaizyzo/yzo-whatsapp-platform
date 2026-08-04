// src/lib/planService.js
import api from "./axios";

export const getPlans = async () => {
  try {
    const res = await api.get("/plans");
    return { success: true, data: res.data.data };
  } catch (err) {
    return { success: false, message: err.response?.data?.message || "Failed to fetch plans" };
  }
};

export const createPlan = async (data) => {
  try {
    const res = await api.post("/plans", data);
    return { success: true, data: res.data.data };
  } catch (err) {
    return { success: false, message: err.response?.data?.message || "Failed to create plan" };
  }
};

export const updatePlan = async (id, data) => {
  try {
    const res = await api.put(`/plans/${id}`, data);
    return { success: true, data: res.data.data };
  } catch (err) {
    return { success: false, message: err.response?.data?.message || "Failed to update plan" };
  }
};

export const togglePlanStatus = async (id) => {
  try {
    const res = await api.patch(`/plans/${id}/toggle-status`);
    return { success: true, data: res.data.data };
  } catch (err) {
    return { success: false, message: err.response?.data?.message || "Failed to toggle status" };
  }
};

export const deletePlan = async (id) => {
  try {
    const res = await api.delete(`/plans/${id}`);
    return { success: true, message: res.data.message };
  } catch (err) {
    return { success: false, message: err.response?.data?.message || "Failed to delete plan" };
  }
};

export const getFeatures = async () => {
  try {
    const res = await api.get("/plans/features");
    return { success: true, data: res.data.data };
  } catch (err) {
    return { success: false, message: err.response?.data?.message || "Failed to fetch features" };
  }
};

export const createFeature = async (name) => {
  try {
    const res = await api.post("/plans/features/create", { name });
    return { success: true, data: res.data.data };
  } catch (err) {
    return { success: false, message: err.response?.data?.message || "Failed to create feature" };
  }
};

export const deleteFeature = async (id) => {
  try {
    const res = await api.delete(`/plans/features/${id}`);
    return { success: true, message: res.data.message };
  } catch (err) {
    return { success: false, message: err.response?.data?.message || "Failed to delete feature" };
  }
};



// ══════════════════════════════════════════
// TAX / GST SETTINGS
// ══════════════════════════════════════════

export const getTaxSettings = async () => {
  try {
    const res = await api.get("/settings/tax");
    return { success: true, data: res.data.data };
  } catch (err) {
    return {
      success: false,
      message: err.response?.data?.message || "Failed to fetch tax settings",
    };
  }
};

export const updateTaxSettings = async (data) => {
  try {
     const res = await api.put("/settings/tax", data);
    return {
      success: true,
      data:    res.data.data,
      message: res.data.message,
    };
  } catch (err) {
    return {
      success: false,
      message: err.response?.data?.message || "Failed to update tax settings",
    };
  }
};