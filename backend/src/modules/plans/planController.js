import * as planService from "./planService.js";
import {
  createPlanSchema,
  updatePlanSchema,
  createFeatureSchema,
} from "./planValidation.js";

import Razorpay from "razorpay";
import crypto from "crypto";
import prisma from "../../config/prisma.js";

import { generateInvoicePDF } from "./invoiceService.js";
import { sendInvoiceEmail } from "../auth/emailService.js";

import { createSuperAdminNotification } from "../superAdminNotifications/superAdminNotificationService.js";
import { emitToSuperAdmin } from "../../lib/socket.js";

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

    if (
      !process.env.RAZORPAY_KEY_ID ||
      !process.env.RAZORPAY_KEY_SECRET ||
      process.env.RAZORPAY_KEY_ID.includes("xxxx")
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Razorpay API keys are not configured in backend/.env. Please set valid RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
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
      receipt: `rcpt_${Date.now()}_${tenantId.slice(0, 8)}`,
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

    // 1. Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      await prisma.payment.updateMany({
        where: { razorpayOrderId: razorpay_order_id },
        data: { status: "FAILED" },
      });
      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    // 2. Get plan details
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    // 3. Get tenant details
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    // 4. Calculate amounts
    const baseAmount =
      billingType === "annual" && plan.annualPrice
        ? plan.annualPrice
        : plan.monthlyPrice;

    const gstPercent = 18;
    const gstAmount = parseFloat(((baseAmount * gstPercent) / 100).toFixed(2));
    const totalAmount = parseFloat((baseAmount + gstAmount).toFixed(2));

    // 5. Get payment method from Razorpay
    let paymentMethod = null;
    try {
      const rzpPayment = await razorpay.payments.fetch(razorpay_payment_id);
      paymentMethod = rzpPayment.method || null;
    } catch (e) {}

    // 6. Save Payment record
    const payment = await prisma.payment.create({
      data: {
        tenantId,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        planId,
        planName: plan.name,
        billingType: billingType || "monthly",
        baseAmount,
        gstPercent,
        gstAmount,
        totalAmount,
        currency: "INR",
        paymentMethod,
        status: "SUCCESS",
        paidAt: new Date(),
      },
    });

    // 7. Activate plan on Tenant
    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        planId,
        planStatus: "active",
        billingType: billingType || "monthly",
        planActivatedAt: new Date(),
        status: "APPROVED",
      },
    });

    
    // ─────────────────────────────────────────────
    // 🔔 STEP 7.5 — Notify SuperAdmin (NEW - 3 lines)
    // ─────────────────────────────────────────────
    try {
      const notification = await createSuperAdminNotification({
        type: "tenant_payment",
        title: "💰 Payment Received",
        message: `${tenant.tenantName} paid ₹${totalAmount} for ${plan.name} (${billingType || "monthly"})`,
        metadata: {
          tenantId: tenant.id,
          tenantName: tenant.tenantName,
          planId: plan.id,
          planName: plan.name,
          amount: totalAmount,
          baseAmount,
          gstAmount,
          billingType: billingType || "monthly",
          paymentId: payment.id,
          razorpayPaymentId: razorpay_payment_id,
        },
      });

      // Real-time push to admin dashboard bell
      emitToSuperAdmin("superadmin_notification", { notification });

      console.log("✅ SuperAdmin notified of payment:", payment.id);
    } catch (notifyErr) {
      // ⚠️ Never block payment response for notification failure
      console.error("❌ SuperAdmin notification failed:", notifyErr.message);
    }
    // ─────────────────────────────────────────────

    // 8. Generate Invoice PDF + Send Email (non-blocking)
    generateInvoicePDF(payment, tenant)
      .then(async ({ filePath, fileUrl, invoiceNumber }) => {
        // Save invoice URL to payment record
        await prisma.payment.update({
          where: { id: payment.id },
          data: { invoiceUrl: fileUrl },
        });

        // Send invoice email
        await sendInvoiceEmail(
          tenant.email,
          tenant.tenantName,
          invoiceNumber,
          filePath
        );

        console.log(`✅ Invoice generated: ${invoiceNumber}`);
      })
      .catch((err) => {
        console.error("❌ Invoice generation error:", err);
      });

    // 9. Return success immediately (don't wait for PDF)
    return res.status(200).json({
      success: true,
      message: "Payment verified! Plan activated successfully.",
      data: {
        planId: updatedTenant.planId,
        planStatus: updatedTenant.planStatus,
        billingType: updatedTenant.billingType,
        paymentId: payment.id,
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



// ✅ NEW — Get Billing Details for Tenant Dashboard
export const getBillingDetails = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    // 1. Get tenant with current plan
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            monthlyPrice: true,
            annualPrice: true,
            maxAgents: true,
            description: true,
          },
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }

    // 2. Get payment history (latest first)
    const payments = await prisma.payment.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        razorpayOrderId: true,
        razorpayPaymentId: true,
        planName: true,
        billingType: true,
        baseAmount: true,
        gstPercent: true,
        gstAmount: true,
        totalAmount: true,
        currency: true,
        paymentMethod: true,
        status: true,
        paidAt: true,
        createdAt: true,
      },
    });

    // 3. Calculate next renewal date
    let nextRenewalDate = null;
    if (tenant.planActivatedAt && tenant.planStatus === "active") {
      const activatedAt = new Date(tenant.planActivatedAt);
      if (tenant.billingType === "annual") {
        nextRenewalDate = new Date(activatedAt);
        nextRenewalDate.setFullYear(nextRenewalDate.getFullYear() + 1);
      } else {
        nextRenewalDate = new Date(activatedAt);
        nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 1);
      }
    }

    // 4. Build current plan price display
    let currentPrice = null;
    if (tenant.plan) {
      const baseAmount =
        tenant.billingType === "annual" && tenant.plan.annualPrice
          ? tenant.plan.annualPrice
          : tenant.plan.monthlyPrice;
      const gstAmount = parseFloat(((baseAmount * 18) / 100).toFixed(2));
      currentPrice = {
        base: baseAmount,
        gst: gstAmount,
        total: parseFloat((baseAmount + gstAmount).toFixed(2)),
      };
    }

    return res.status(200).json({
      success: true,
      data: {
        currentPlan: tenant.plan
          ? {
              id: tenant.plan.id,
              name: tenant.plan.name,
              description: tenant.plan.description,
              billingType: tenant.billingType,
              planStatus: tenant.planStatus,
              activatedAt: tenant.planActivatedAt,
              nextRenewalDate,
              maxAgents: tenant.plan.maxAgents,
              price: currentPrice,
            }
          : null,
        payments,
      },
    });
  } catch (error) {
    console.error("Get billing details error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



// ✅ Download Invoice
export const downloadInvoice = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const tenantId = req.tenantId;

    // 1. Find payment
    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        tenantId,           // ← Security: only own payments
        status: "SUCCESS",
      },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // 2. Check if invoice exists
    if (!payment.invoiceUrl) {
      // Generate on the fly if not exists
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
      });
      const { filePath, fileUrl, invoiceNumber } = await generateInvoicePDF(
        payment,
        tenant
      );
      // Save URL
      await prisma.payment.update({
        where: { id: paymentId },
        data: { invoiceUrl: fileUrl },
      });

      payment.invoiceUrl = fileUrl;
    }
    // 3. Return invoice URL
    return res.status(200).json({
      success: true,
      data: {
        //Backend URL is set in .env file, if not set, fallback to localhost:5000
        invoiceUrl: `${process.env.BACKEND_URL || "http://localhost:5000"}${payment.invoiceUrl}`,
      },
    });
  } catch (error) {
    console.error("Download invoice error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};