import * as planService from "./planService.js";
import {
  createPlanSchema,
  updatePlanSchema,
  createFeatureSchema,
} from "./planValidation.js";

import Razorpay from "razorpay";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import prisma from "../../config/prisma.js";
import { generateInvoicePDF } from "./invoiceService.js";
import { sendInvoiceEmail } from "../auth/emailService.js";

import { createSuperAdminNotification } from "../SuperAdminNotifications/superAdminNotificationService.js";
import { emitToSuperAdmin } from "../../lib/socket.js";
import { createAuditLog } from '../audit/auditLogService.js';
import { extractRequestMeta } from '../../lib/utils/requestMeta.js';
import { calculateGST } from "../superadmin/superadminService.js";

// ✅ Initialize Razorpay with fallback placeholders to prevent startup crashes
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret',
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


// Create Razorpay Order & Lock DB Record
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
        message: "Razorpay API keys are not configured in backend/.env",
      });
    }

    // 1. Get plan & verify it is ACTIVE
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    if (plan.status !== "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: "This plan is no longer available for purchase.",
      });
    }

    // 2. Calculate prices (Base + 18% GST)
    const validBillingType = billingType === "annual" ? "annual" : "monthly";
    const baseAmount =
      validBillingType === "annual" && plan.annualPrice
        ? plan.annualPrice
        : plan.monthlyPrice;

    const gstCalc     = await calculateGST(baseAmount);
    const gstPercent  = gstCalc.gstPercent;
    const gstAmount   = gstCalc.gstAmount;
    const totalAmount = gstCalc.totalAmount;

    // Razorpay amount is in PAISE (₹1 = 100 paise)
    const amountInPaise = Math.round(totalAmount * 100);

    // 3. Create order in Razorpay
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `rcpt_${Date.now()}_${tenantId.slice(0, 8)}`,
      notes: {
        tenantId,
        planId,
        billingType: validBillingType,
      },
    });

    // 4. Create PENDING Payment record in DB (Locks Order to Plan ID & Amount)
    await prisma.payment.create({
      data: {
        tenantId,
        razorpayOrderId: order.id,
        planId,
        planName: plan.name,
        billingType: validBillingType,
        baseAmount,
        gstPercent,
        gstAmount,
        totalAmount,
        currency: "INR",
        status: "PENDING",
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        orderId: order.id,
        amount: amountInPaise,
        currency: order.currency,
        planName: plan.name,
        planId,
        billingType: validBillingType,
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
      const meta = extractRequestMeta(req);
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planId,
      billingType,
    } = req.body;

    const tenantId = req.tenantId;

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !planId) {
      return res.status(400).json({
        success: false,
        message: "Missing required payment fields",
      });
    }

    // Validate billing type
    const validBillingType =
      billingType === "annual" || billingType === "monthly"
        ? billingType
        : "monthly";

    // 1. Get plan details
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    // 2. Get tenant details
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }

    // 3. Calculate amounts early (needed for failed payment logging)
    const baseAmount =
      validBillingType === "annual" && plan.annualPrice
        ? plan.annualPrice
        : plan.monthlyPrice;

    const gstCalc     = await calculateGST(baseAmount);
    const gstPercent  = gstCalc.gstPercent;
    const gstAmount   = gstCalc.gstAmount;
    const totalAmount = gstCalc.totalAmount;

    // 4. Verify signature FIRST
    const sigBody = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sigBody.toString())
      .digest("hex");

    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const sigBuf = Buffer.from(razorpay_signature, 'utf8');

    if (expectedBuf.length !== sigBuf.length || !crypto.timingSafeEqual(expectedBuf, sigBuf)) {
      try {
        await prisma.payment.create({
          data: {
            tenantId,
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
            planId,
            planName: plan.name,
            billingType: validBillingType,
            baseAmount,
            gstPercent,
            gstAmount,
            totalAmount,
            currency: "INR",
            status: "FAILED",
          },
        });

    await createAuditLog({
      actorId:     tenantId,
      actorType:   'TENANT',
      actorName:   tenant.tenantName || tenant.email,
      actorEmail:  tenant.email,
      action:      'PAYMENT_FAILED',
      module:      'BILLING',
      description: `Payment verification failed for tenant "${tenant.tenantName}" — invalid signature`,
      ipAddress:   meta.ipAddress,
      userAgent:   meta.userAgent,
      tenantId:    tenantId,
      metadata: {
        planName:        plan.name,
        billingType:     validBillingType,
        totalAmount,
        razorpayOrderId: razorpay_order_id,
        reason:          'invalid_signature',
      },
    });

      } catch (logErr) {
        console.error("Failed to log failed payment:", logErr);
      }

      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    // 4.5 SECURITY CHECK: Verify order exists, belongs to tenant, and planId matches original order
    const pendingPayment = await prisma.payment.findUnique({
      where: { razorpayOrderId: razorpay_order_id },
    });

    if (!pendingPayment) {
      return res.status(404).json({
        success: false,
        message: "Order record not found or expired.",
      });
    }

    if (pendingPayment.tenantId !== tenantId) {
      console.error(
        `[SECURITY ALERT] Tenant ID mismatch for order ${razorpay_order_id}. Expected: ${pendingPayment.tenantId}, Attempted by: ${tenantId}`
      );
      return res.status(403).json({
        success: false,
        message: "Security Error: You are not authorized to verify this payment order.",
      });
    }

    if (pendingPayment.planId !== planId) {
      console.error(
        `[SECURITY ALERT] Plan ID mismatch for tenant ${tenantId}. Expected: ${pendingPayment.planId}, Got: ${planId}`
      );
      return res.status(400).json({
        success: false,
        message: "Security Error: Plan ID does not match original order.",
      });
    }

    // 5. Idempotency check (AFTER signature passes)
    if (pendingPayment.status === "SUCCESS") {
      return res.status(200).json({
        success: true,
        message: "Payment already verified! Plan is active.",
        data: {
          planId: pendingPayment.planId,
          planName: pendingPayment.planName,
          planStatus: tenant.planStatus,
          currentPlan: tenant.currentPlan,
          billingType: pendingPayment.billingType,
          planPeriodStart: tenant.planPeriodStart,
          planPeriodEnd: tenant.planPeriodEnd,
          paymentId: pendingPayment.id,
          totalAmount: Number(pendingPayment.totalAmount),
        },
      });
    }

    const existingPayment = await prisma.payment.findFirst({
      where: {
        razorpayPaymentId: razorpay_payment_id,
        status: "SUCCESS",
      },
    });

    if (existingPayment) {
      return res.status(200).json({
        success: true,
        message: "Payment already verified! Plan is active.",
        data: {
          planId: existingPayment.planId,
          planName: existingPayment.planName,
          planStatus: tenant.planStatus,
          currentPlan: tenant.currentPlan,
          billingType: existingPayment.billingType,
          planPeriodStart: tenant.planPeriodStart,
          planPeriodEnd: tenant.planPeriodEnd,
          paymentId: existingPayment.id,
          totalAmount: Number(existingPayment.totalAmount),
        },
      });
    }

    // 6. Calculate billing period dates
    const isSamePlan = tenant.planId === planId;
    const isSameBillingType = tenant.billingType === validBillingType;
    const isCurrentPlanActive =
      tenant.subscriptionStatus === "active" ||
      tenant.subscriptionStatus === "cancel_at_period_end";
    const isNotExpired =
      tenant.planPeriodEnd && new Date(tenant.planPeriodEnd) > new Date();

    let periodStart = new Date();
    let periodEnd = new Date(periodStart);

    if (validBillingType === "annual") {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const wasExtended =
      isSamePlan && isSameBillingType && isCurrentPlanActive && isNotExpired;

    if (wasExtended) {
      periodStart = new Date(tenant.planPeriodEnd);
      const existingEnd = new Date(tenant.planPeriodEnd);
      if (validBillingType === "annual") {
        existingEnd.setFullYear(existingEnd.getFullYear() + 1);
      } else {
        existingEnd.setMonth(existingEnd.getMonth() + 1);
      }
      periodEnd = existingEnd;

      console.log(
        `[planController] Cumulative extension for tenant ${tenantId}: ` +
        `${tenant.planPeriodEnd.toISOString()} → ${periodEnd.toISOString()}`
      );
    }

    // 7. Atomic transaction
    const { payment, updatedTenant, alreadyProcessed } = await prisma.$transaction(async (tx) => {
      const currentP = await tx.payment.findUnique({
        where: { razorpayOrderId: razorpay_order_id },
      });

      if (currentP && currentP.status === "SUCCESS") {
        const currentT = await tx.tenant.findUnique({ where: { id: tenantId } });
        return { payment: currentP, updatedTenant: currentT, alreadyProcessed: true };
      }

      const createdPayment = await tx.payment.update({
        where: { razorpayOrderId: razorpay_order_id },
        data: {
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          status: "SUCCESS",
          paidAt: new Date(),
        },
      });

      const updated = await tx.tenant.update({
        where: { id: tenantId },
        data: {
          planId,
          planStatus: "active",
          billingType: validBillingType,
          planActivatedAt: periodStart,
          status: "APPROVED",
          subscriptionStatus: "active",
          currentPlan: plan.name,
          planPeriodStart: periodStart,
          planPeriodEnd: periodEnd,
          cancelRequestedAt: null,
          cancellationReason: null,
          dataDeletionDate: null,
          ...(req.body.address ? { address: req.body.address } : {}),
          ...(req.body.phone ? { phone: req.body.phone } : {}),
        },
      });

      return { payment: createdPayment, updatedTenant: updated, alreadyProcessed: false };
    });

    if (alreadyProcessed) {
      return res.status(200).json({
        success: true,
        message: "Payment already verified! Plan is active.",
        data: {
          planId: payment.planId,
          planName: payment.planName,
          planStatus: updatedTenant.planStatus,
          currentPlan: updatedTenant.currentPlan,
          billingType: payment.billingType,
          planPeriodStart: updatedTenant.planPeriodStart,
          planPeriodEnd: updatedTenant.planPeriodEnd,
          paymentId: payment.id,
          totalAmount: Number(payment.totalAmount),
        },
      });
    }

    // ✅ PAYMENT_SUCCESS audit log
    const auditResult1 = await createAuditLog({
      actorId:     tenantId,
      actorType:   'TENANT',
      actorName:   tenant.tenantName || tenant.email,
      actorEmail:  tenant.email,
      action:      'PAYMENT_SUCCESS',
      module:      'BILLING',
      description: `Tenant "${tenant.tenantName}" paid ₹${totalAmount} for ${plan.name} (${validBillingType})`,
      tenantId:    tenantId,
      ipAddress:   meta.ipAddress ?? null,
      userAgent:   meta.userAgent ?? null, 
      metadata: {
        planName:          plan.name,
        billingType:       validBillingType,
        baseAmount,
        gstAmount,
        totalAmount,
        razorpayOrderId:   razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        wasExtended,
        planPeriodStart:   updatedTenant.planPeriodStart,
        planPeriodEnd:     updatedTenant.planPeriodEnd,
      },
    });

    // ✅ PLAN_ACTIVATED audit log
    const auditResult2 = await createAuditLog({
      actorId:     tenantId,
      actorType:   'TENANT',
      actorName:   tenant.tenantName || tenant.email,
      actorEmail:  tenant.email,
      action:      'PLAN_ACTIVATED',
      module:      'BILLING',
      description: wasExtended
        ? `Tenant "${tenant.tenantName}" extended ${plan.name} plan (${validBillingType})`
        : `Tenant "${tenant.tenantName}" activated ${plan.name} plan (${validBillingType})`,
      tenantId:    tenantId,
      ipAddress:   meta.ipAddress ?? null,
      userAgent:   meta.userAgent ?? null, 
      metadata: {
        planName:        plan.name,
        billingType:     validBillingType,
        totalAmount,
        wasExtended,
        planPeriodStart: updatedTenant.planPeriodStart,
        planPeriodEnd:   updatedTenant.planPeriodEnd,
      },
    });


    // 8. Fetch payment method in background (non-blocking)
    razorpay.payments
      .fetch(razorpay_payment_id)
      .then(async (rzpPayment) => {
        if (rzpPayment?.method) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: { paymentMethod: rzpPayment.method },
          });
        }
      })
      .catch((e) => {
        console.warn("⚠️ Could not fetch payment method:", e.message);
      });


    // 9. SuperAdmin notification (non-blocking)
    try {
      const notification = await createSuperAdminNotification({
        type: "tenant_payment",
        title: "💰 Payment Received",
        message: `${tenant.tenantName} paid ₹${totalAmount} for ${plan.name} (${validBillingType})`,
        metadata: {
          tenantId: updatedTenant.id,
          tenantName: tenant.tenantName,
          planId: plan.id,
          planName: plan.name,
          amount: totalAmount,
          baseAmount,
          gstAmount,
          billingType: validBillingType,
          paymentId: payment.id,
          razorpayPaymentId: razorpay_payment_id,
          planPeriodEnd: updatedTenant.planPeriodEnd,
          wasExtended,
        },
      });
      emitToSuperAdmin("superadmin_notification", { notification });
    } catch (notifyErr) {
      console.error("❌ SuperAdmin notification failed:", notifyErr.message);
    }

    // 10. Invoice PDF + email (non-blocking)
    generateInvoicePDF(payment, tenant)
      .then(async ({ filePath, fileUrl, invoiceNumber }) => {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { invoiceUrl: fileUrl },
        });
        await sendInvoiceEmail(
          tenant.email,
          tenant.tenantName,
          invoiceNumber,
          filePath
        );
      })
      .catch((err) => {
        console.error("❌ Invoice generation error:", err);
      });

    // 11. Return success immediately
    return res.status(200).json({
      success: true,
      message: wasExtended
        ? "Plan extended successfully!"
        : "Payment verified! Plan activated successfully.",
      data: {
        planId: updatedTenant.planId,
        planName: updatedTenant.currentPlan,
        planStatus: updatedTenant.planStatus,
        currentPlan: updatedTenant.currentPlan,
        billingType: updatedTenant.billingType,
        planPeriodStart: updatedTenant.planPeriodStart,
        planPeriodEnd: updatedTenant.planPeriodEnd,
        paymentId: payment.id,
        totalAmount,
        wasExtended,
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

    let status = tenant.subscriptionStatus;
    let planStatus = tenant.planStatus;
    let dataDeletionDate = tenant.dataDeletionDate;

    // Self-healing: if cancelled plan has reached its period end, expire it immediately
    if (status === 'cancel_at_period_end' && tenant.planPeriodEnd && new Date(tenant.planPeriodEnd) < new Date()) {
      const computedDeletionDate = new Date();
      computedDeletionDate.setDate(computedDeletionDate.getDate() + 90);

      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          subscriptionStatus: 'expired',
          planStatus: 'inactive',
          dataDeletionDate: computedDeletionDate
        }
      });
      status = 'expired';
      planStatus = 'inactive';
      dataDeletionDate = computedDeletionDate;
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
    const gstCalc = await calculateGST(baseAmount);
    currentPrice = {
    base:       baseAmount,
    gst:        gstCalc.gstAmount,
    total:      gstCalc.totalAmount,
    gstEnabled: gstCalc.gstEnabled,
    gstPercent: gstCalc.gstPercent,
    };
    }

    let currentPlanResponse = null;
    if (tenant.plan) {
      currentPlanResponse = {
        id: tenant.plan.id,
        name: tenant.plan.name,
        description: tenant.plan.description,
        billingType: tenant.billingType,
        planStatus: planStatus,
        activatedAt: tenant.planActivatedAt,
        nextRenewalDate: tenant.planPeriodEnd || nextRenewalDate,
        maxAgents: tenant.plan.maxAgents,
        price: currentPrice,
        // Added fields
        subscriptionStatus: status,
        planPeriodEnd: tenant.planPeriodEnd,
        cancelRequestedAt: tenant.cancelRequestedAt,
        dataDeletionDate: dataDeletionDate,
      };
    } else if (planStatus === 'enterprise_active') {
      currentPlanResponse = {
        id: "enterprise",
        name: "Enterprise Plan",
        description: "Dedicated resources, custom API volume, and priority enterprise channels.",
        billingType: "custom",
        planStatus: "active",
        activatedAt: tenant.planActivatedAt || tenant.createdAt,
        nextRenewalDate: null,
        maxAgents: "Unlimited",
        price: null,
        // Added fields
        subscriptionStatus: status,
        planPeriodEnd: tenant.planPeriodEnd,
        cancelRequestedAt: tenant.cancelRequestedAt,
        dataDeletionDate: dataDeletionDate,
      };
    }

    return res.status(200).json({
      success: true,
      data: {
        currentPlan: currentPlanResponse,
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

    let filePath;
    let fileName;

    // 2. Check if invoice exists
    if (!payment.invoiceUrl) {
      // Generate on the fly if not exists
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
      });
      const generated = await generateInvoicePDF(
        payment,
        tenant
      );
      filePath = generated.filePath;
      fileName = `${generated.invoiceNumber}.pdf`;

      // Save URL
      await prisma.payment.update({
        where: { id: paymentId },
        data: { invoiceUrl: generated.fileUrl },
      });
    } else {
      filePath = path.join(process.cwd(), payment.invoiceUrl);
      fileName = path.basename(payment.invoiceUrl);

      // If file missing on disk, regenerate
      if (!fs.existsSync(filePath)) {
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
        });
        const generated = await generateInvoicePDF(payment, tenant);
        filePath = generated.filePath;
        fileName = `${generated.invoiceNumber}.pdf`;
      }
    }

    // 3. Stream PDF directly
    return res.download(filePath, fileName);
  } catch (error) {
    console.error("Download invoice error:", error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
};