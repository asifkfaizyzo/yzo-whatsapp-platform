import * as planService from "./planService.js";
import {
  createPlanSchema,
  updatePlanSchema,
  createFeatureSchema,
} from "./planValidation.js";

import Razorpay from "razorpay";
import crypto from "crypto";
import prisma from "../../config/prisma.js";

// ✅ Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ── Get all plans ──
export const getPlans = async (req, res) => {
  try {
    const plans = await planService.getAllPlans();
    res.json({ success: true, data: plans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get public plans (no auth) ──
export const getPublicPlans = async (req, res) => {
  try {
    const plans = await planService.getPublicPlans();
    res.json({ success: true, data: plans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get single plan ──
export const getPlan = async (req, res) => {
  try {
    const plan = await planService.getPlanById(req.params.id);
    if (!plan) {
      return res
        .status(404)
        .json({ success: false, message: "Plan not found" });
    }
    res.json({ success: true, data: plan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Create plan ──
export const createPlan = async (req, res) => {
  try {
    const parsed = createPlanSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const plan = await planService.createPlan(parsed.data);
    res.status(201).json({ success: true, data: plan });
  } catch (err) {
    if (err.code === "P2002") {
      return res
        .status(409)
        .json({ success: false, message: "Plan name already exists" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Update plan ──
export const updatePlan = async (req, res) => {
  try {
    const parsed = updatePlanSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const plan = await planService.updatePlan(req.params.id, parsed.data);
    res.json({ success: true, data: plan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Toggle status ──
export const toggleStatus = async (req, res) => {
  try {
    const plan = await planService.togglePlanStatus(req.params.id);
    res.json({ success: true, data: plan });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
};

// ── Delete plan ──
export const deletePlan = async (req, res) => {
  try {
    await planService.deletePlan(req.params.id);
    res.json({ success: true, message: "Plan deleted successfully" });
  } catch (err) {
    // Tenant constraint error
    if (err.message.includes("Cannot delete")) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get all features ──
export const getFeatures = async (req, res) => {
  try {
    const features = await planService.getAllFeatures();
    res.json({ success: true, data: features });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Create feature ──
export const createFeature = async (req, res) => {
  try {
    const parsed = createFeatureSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const feature = await planService.createFeature(parsed.data.name);
    res.status(201).json({ success: true, data: feature });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Delete feature ──
export const deleteFeature = async (req, res) => {
  try {
    await planService.deleteFeature(req.params.id);
    res.json({ success: true, message: "Feature deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// Create Razorpay Order
export const createPaymentOrder = async (req, res) => {
  try {
    const { planId, billingType } = req.body;
    const tenantId = req.tenantId;

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: "planId is required",
      });
    }

    // Get plan
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    // Calculate price
    const price =
      billingType === "annual" && plan.annualPrice
        ? plan.annualPrice
        : plan.monthlyPrice;

    // Razorpay amount is in PAISE (₹1 = 100 paise)
    const amountInPaise = Math.round(price * 100);

    // Create order in Razorpay
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `rcpt_${tenantId}_${Date.now()}`,
      notes: {
        tenantId,
        planId,
        billingType: billingType || "monthly",
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        planName: plan.name,
        planId,
        billingType: billingType || "monthly",
      },
    });

  } catch (error) {
    console.error("Create order error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ✅ Verify Payment & Activate Plan
export const verifyPaymentAndActivate = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planId,
      billingType,
    } = req.body;

    const tenantId = req.tenantId;

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    // Payment verified → activate plan
    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        planId,
        planStatus:       "active",
        billingType:      billingType || "monthly",
        planActivatedAt:  new Date(),
        status:           "APPROVED",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Payment verified! Plan activated successfully.",
      data: {
        planId:      updatedTenant.planId,
        planStatus:  updatedTenant.planStatus,
        billingType: updatedTenant.billingType,
      },
    });

  } catch (error) {
    console.error("Verify payment error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};