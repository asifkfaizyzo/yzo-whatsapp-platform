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
    const response = await api.get(`/plans/billing/invoice/${paymentId}`, {
      responseType: "blob",
    });
    const blob = new Blob([response.data], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Invoice-${paymentId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to download invoice",
    };
  }
};