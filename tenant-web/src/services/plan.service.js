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


// ✅ Create Razorpay order
export const createPaymentOrder = async (planId, billingType) => {
  try {
    const response = await api.post("/plans/create-order", {
      planId,
      billingType,
    });
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Failed to create order",
    };
  }
};

// ✅ Verify payment and activate plan
export const verifyPayment = async (paymentData) => {
  try {
    const response = await api.post("/plans/verify-payment", paymentData);
    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Payment verification failed",
    };
  }
};