// src/services/plan.service.js

import api from "../lib/axios";

// ── Get all active plans (public — no auth needed) ──
export const getPublicPlans = async () => {
  try {
    const response = await api.get("/plans/public");
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to fetch plans",
    };
  }
};