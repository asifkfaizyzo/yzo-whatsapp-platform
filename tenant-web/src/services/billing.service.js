// src/services/billing.service.js
import api from "../lib/axios";

// ── Get billing overview + payment history ──
export const getBillingDetails = async () => {
  try {
    const response = await api.get("/plans/billing");
    return response.data;
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to fetch billing details",
    };
  }
};


// ── Download Invoice ──
export const downloadInvoice = async (paymentId) => {
  try {
    const response = await api.get(`/plans/billing/invoice/${paymentId}`);
    return response.data;
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to get invoice",
    };
  }
};