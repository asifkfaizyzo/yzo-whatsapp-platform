import * as planService from "./planService.js";
import {
  createPlanSchema,
  updatePlanSchema,
  createFeatureSchema,
} from "./planValidation.js";

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
import { razorpay, getRazorpay } from "../../config/razorpay.js";

// ✅ Export Razorpay instance from centralized config
export { razorpay, getRazorpay };

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
    const pendingPayment = await prisma.payment.findFirst({
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
        where: { id: pendingPayment.id },
      });

      if (currentP && currentP.status === "SUCCESS") {
        const currentT = await tx.tenant.findUnique({ where: { id: tenantId } });
        return { payment: currentP, updatedTenant: currentT, alreadyProcessed: true };
      }

      const createdPayment = await tx.payment.update({
        where: { id: pendingPayment.id },
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

// Helper to fetch or dynamically create/recreate Razorpay Plan ID
const getOrCreateRazorpayPlan = async (plan, billingType, forceRecreate = false) => {
  let rzpPlanId = billingType === "annual" ? plan.razorpayAnnualPlanId : plan.razorpayMonthlyPlanId;

  if (!rzpPlanId || forceRecreate) {
    const amount = billingType === "annual" && plan.annualPrice ? plan.annualPrice : plan.monthlyPrice;
    const gstCalc = await calculateGST(amount);
    const totalAmountInPaise = Math.round(gstCalc.totalAmount * 100);

    const createdRzpPlan = await razorpay.plans.create({
      period: billingType === "annual" ? "yearly" : "monthly",
      interval: 1,
      item: {
        name: `${plan.name} (${billingType === "annual" ? "Annual" : "Monthly"})`,
        amount: totalAmountInPaise,
        currency: "INR",
        description: `${plan.name} Plan recurring subscription`,
      },
    });
    rzpPlanId = createdRzpPlan.id;

    // Persist generated plan ID in database
    await prisma.subscriptionPlan.update({
      where: { id: plan.id },
      data: billingType === "annual"
        ? { razorpayAnnualPlanId: rzpPlanId }
        : { razorpayMonthlyPlanId: rzpPlanId },
    });
  }

  return rzpPlanId;
};

// ── Create Recurring Subscription with Free Trial ──
export const createSubscriptionTrial = async (req, res) => {
  const { planId, billingType = 'monthly' } = req.body;
  const tenantId = req.tenantId;

  if (!planId) {
    return res.status(400).json({
      success: false,
      message: "planId is required",
    });
  }

  try {
    const [tenant, plan] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId } }),
      prisma.subscriptionPlan.findUnique({ where: { id: planId } })
    ]);

    if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found" });
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });

    // Anti-Abuse Check: Has tenant already used free trial?
    if (tenant.hasUsedTrial) {
      return res.status(403).json({
        success: false,
        code: 'TRIAL_ALREADY_USED',
        message: 'You have already used your free trial on this account. Please select a paid subscription plan.'
      });
    }

    // Plan Eligibility Check
    if (!plan.hasTrial) {
      return res.status(400).json({
        success: false,
        code: 'PLAN_NO_TRIAL',
        message: 'This plan does not offer a free trial. Please proceed to direct checkout.'
      });
    }

    // Reuse existing subscription if in created/authenticated state (prevents orphan accumulation)
    if (tenant.razorpaySubscriptionId) {
      try {
        const existingSub = await razorpay.subscriptions.fetch(tenant.razorpaySubscriptionId);
        if (['created', 'authenticated'].includes(existingSub.status)) {
          return res.status(200).json({
            success: true,
            subscriptionId: existingSub.id,
            keyId: process.env.RAZORPAY_KEY_ID,
            reused: true,
          });
        }
      } catch (fetchErr) {
        console.warn("Stale subscription ID in DB, creating fresh subscription");
      }
    }

    // Ensure Razorpay Plan ID exists, or create dynamically on Razorpay
    let rzpPlanId = await getOrCreateRazorpayPlan(plan, billingType);

    const trialDays = plan.trialDays || 14;
    const startAt = Math.floor((Date.now() + trialDays * 86400000) / 1000);

    let subscription;
    try {
      subscription = await razorpay.subscriptions.create({
        plan_id: rzpPlanId,
        total_count: billingType === 'annual' ? 5 : 12,
        quantity: 1,
        start_at: startAt,
        customer_notify: 1,
        notes: { tenantId: tenant.id, planId: plan.id, billingType }
      });
    } catch (subErr) {
      if (
        subErr?.error?.description?.includes('invalid or could not be found') ||
        subErr?.error?.code === 'BAD_REQUEST_ERROR' ||
        subErr?.statusCode === 400
      ) {
        console.warn("⚠️ Razorpay Plan ID not found in current environment. Re-creating plan on Razorpay...");
        rzpPlanId = await getOrCreateRazorpayPlan(plan, billingType, true);
        subscription = await razorpay.subscriptions.create({
          plan_id: rzpPlanId,
          total_count: billingType === 'annual' ? 5 : 12,
          quantity: 1,
          start_at: startAt,
          customer_notify: 1,
          notes: { tenantId: tenant.id, planId: plan.id, billingType }
        });
      } else {
        throw subErr;
      }
    }

    // Save ID immediately to link to tenant
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { razorpaySubscriptionId: subscription.id }
    });

    return res.status(200).json({
      success: true,
      subscriptionId: subscription.id,
      keyId: process.env.RAZORPAY_KEY_ID,
      trialDays,
    });
  } catch (error) {
    console.error("Create subscription trial error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create subscription trial",
    });
  }
};

// ── Verify Mandate Signature & Formally Activate Trial ──
export const verifySubscriptionTrial = async (req, res) => {
  const { 
    razorpay_payment_id, 
    razorpay_subscription_id, 
    razorpay_signature 
  } = req.body;
  const tenantId = req.tenantId;

  if (!razorpay_subscription_id || !razorpay_signature) {
    return res.status(400).json({
      success: false,
      code: 'MISSING_VERIFICATION_FIELDS',
      message: 'Subscription ID and signature are required'
    });
  }

  try {
    // 1. Verify Razorpay signature
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_payment_id || ''}|${razorpay_subscription_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_SIGNATURE',
        message: 'Payment verification failed. Invalid signature.'
      });
    }

    // 2. Fetch subscription from Razorpay to confirm status
    const rzpSubscription = await razorpay.subscriptions.fetch(razorpay_subscription_id);

    if (!['authenticated', 'active', 'created'].includes(rzpSubscription.status)) {
      return res.status(400).json({
        success: false,
        code: 'MANDATE_NOT_AUTHENTICATED',
        message: 'Mandate authorization is pending or failed.'
      });
    }

    // 3. Atomically activate trial
    const tenant = await prisma.tenant.findUnique({ 
      where: { id: tenantId },
      include: { plan: true }
    });

    if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found" });

    const planId = tenant.planId || rzpSubscription.notes?.planId;
    let chosenPlan = tenant.plan;
    if (!chosenPlan && planId) {
      chosenPlan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    }

    const trialDays = chosenPlan?.trialDays || 14;
    const periodStart = new Date();
    const periodEnd = new Date(periodStart.getTime() + trialDays * 86400000);

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        planId: chosenPlan ? chosenPlan.id : tenant.planId,
        currentPlan: chosenPlan ? chosenPlan.name : tenant.currentPlan,
        subscriptionStatus: 'trialing',
        planStatus: 'active',
        status: 'APPROVED',
        hasUsedTrial: true,
        trialPlanId: chosenPlan ? chosenPlan.id : null,
        autopayEnabled: true,
        autopayMethod: rzpSubscription.payment_method || 'card',
        razorpaySubscriptionId: razorpay_subscription_id,
        planPeriodStart: periodStart,
        planPeriodEnd: periodEnd,
        dataDeletionDate: null,
      }
    });

    return res.status(200).json({
      success: true,
      message: `Your ${trialDays}-day free trial has started. Autopay enabled.`,
      trialEndsAt: periodEnd,
      data: {
        planId: updated.planId,
        planName: updated.currentPlan,
        subscriptionStatus: updated.subscriptionStatus,
        planStatus: updated.planStatus,
        planPeriodEnd: updated.planPeriodEnd,
      }
    });
  } catch (error) {
    console.error("Verify subscription trial error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Create Paid Recurring Subscription (Autopay with immediate Cycle 1 debit) ──
export const createPaidSubscription = async (req, res) => {
  const { planId, billingType = "monthly" } = req.body;
  const tenantId = req.tenantId;

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true },
    });

    if (!tenant) {
      return res.status(404).json({ success: false, message: "Tenant not found" });
    }

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return res.status(404).json({ success: false, message: "Plan not found" });
    }

    if (plan.status !== "ACTIVE") {
      return res.status(400).json({ success: false, message: "This plan is no longer available for purchase." });
    }

    // Ensure Razorpay Plan ID exists, or create dynamically on Razorpay
    let rzpPlanId = await getOrCreateRazorpayPlan(plan, billingType);

    // Calculate upfront amount for client info
    const amount = billingType === "annual" && plan.annualPrice ? plan.annualPrice : plan.monthlyPrice;
    const gstCalc = await calculateGST(amount);

    // Create Subscription without start_at => Cycle 1 is charged upfront immediately
    let subscription;
    try {
      subscription = await razorpay.subscriptions.create({
        plan_id: rzpPlanId,
        total_count: billingType === "annual" ? 5 : 60,
        quantity: 1,
        customer_notify: 1,
        notes: {
          tenantId: tenant.id,
          planId: plan.id,
          billingType,
        },
      });
    } catch (subErr) {
      // If plan ID in DB was from Test mode or invalid on Razorpay, recreate on Razorpay and retry
      if (
        subErr?.error?.description?.includes('invalid or could not be found') ||
        subErr?.error?.code === 'BAD_REQUEST_ERROR' ||
        subErr?.statusCode === 400
      ) {
        console.warn("⚠️ Razorpay Plan ID not found in current environment. Re-creating plan on Razorpay...");
        rzpPlanId = await getOrCreateRazorpayPlan(plan, billingType, true);
        subscription = await razorpay.subscriptions.create({
          plan_id: rzpPlanId,
          total_count: billingType === "annual" ? 5 : 60,
          quantity: 1,
          customer_notify: 1,
          notes: {
            tenantId: tenant.id,
            planId: plan.id,
            billingType,
          },
        });
      } else {
        throw subErr;
      }
    }

    return res.status(200).json({
      success: true,
      subscriptionId: subscription.id,
      keyId: process.env.RAZORPAY_KEY_ID,
      amount: Math.round(gstCalc.totalAmount * 100),
      currency: "INR",
    });
  } catch (error) {
    console.error("Create paid subscription error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Verify Paid Subscription (Signature Verification, Payment Capture & Activation) ──
export const verifyPaidSubscription = async (req, res) => {
  const {
    razorpay_payment_id,
    razorpay_subscription_id,
    razorpay_signature,
    planId,
    billingType = "monthly",
    address,
    phone,
  } = req.body;
  const tenantId = req.tenantId;

  if (!razorpay_subscription_id || !razorpay_signature || !razorpay_payment_id) {
    return res.status(400).json({
      success: false,
      code: "MISSING_VERIFICATION_FIELDS",
      message: "Payment ID, Subscription ID, and signature are required",
    });
  }

  try {
    // 1. Verify HMAC SHA256 signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        code: "INVALID_SIGNATURE",
        message: "Payment verification failed. Invalid signature.",
      });
    }

    // 2. Fetch payment details from Razorpay
    let paymentDetails = null;
    try {
      paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
    } catch (payFetchErr) {
      console.warn("Failed to fetch payment details directly from Razorpay:", payFetchErr.message);
    }

    // 3. Find tenant and chosen plan
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true },
    });

    if (!tenant) {
      return res.status(404).json({ success: false, message: "Tenant not found" });
    }

    const targetPlanId = planId || tenant.planId;
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: targetPlanId },
    });

    if (!plan) {
      return res.status(404).json({ success: false, message: "Plan not found" });
    }

    // Cancel previous Razorpay mandate if upgrading/changing plans to prevent duplicate autopays
    const previousSubscriptionId = tenant.razorpaySubscriptionId;
    if (previousSubscriptionId && previousSubscriptionId !== razorpay_subscription_id) {
      try {
        const oldSub = await razorpay.subscriptions.fetch(previousSubscriptionId);
        if (oldSub && !["cancelled", "completed", "expired"].includes(oldSub.status)) {
          await razorpay.subscriptions.cancel(previousSubscriptionId, false);
          console.log(`✅ Automatically cancelled previous Razorpay mandate ${previousSubscriptionId} upon plan upgrade`);
        }
      } catch (oldSubErr) {
        console.warn(`⚠️ Notice cancelling previous Razorpay mandate ${previousSubscriptionId}:`, oldSubErr?.error?.description || oldSubErr?.message);
      }
    }

    const validBillingType = billingType === "annual" ? "annual" : "monthly";
    const basePrice = validBillingType === "annual" && plan.annualPrice ? plan.annualPrice : plan.monthlyPrice;
    const gstCalc = await calculateGST(basePrice);
    const totalAmount = paymentDetails?.amount ? paymentDetails.amount / 100 : gstCalc.totalAmount;

    // 4. Calculate cumulative billing period dates
    const isCurrentPlanActive =
      tenant.subscriptionStatus === "active" ||
      tenant.subscriptionStatus === "trialing" ||
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

    // Rollover remaining days if already active or trialing
    if (isCurrentPlanActive && isNotExpired && tenant.planPeriodEnd) {
      periodStart = new Date(tenant.planPeriodEnd);
      const existingEnd = new Date(tenant.planPeriodEnd);
      if (validBillingType === "annual") {
        existingEnd.setFullYear(existingEnd.getFullYear() + 1);
      } else {
        existingEnd.setMonth(existingEnd.getMonth() + 1);
      }
      periodEnd = existingEnd;
    }

    const invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    // 5. Atomic Transaction: Payment + Invoice + Tenant Update
    const { payment, updatedTenant } = await prisma.$transaction(async (tx) => {
      // Create Payment Record
      const createdPayment = await tx.payment.create({
        data: {
          tenantId,
          razorpayPaymentId: razorpay_payment_id,
          razorpayOrderId: paymentDetails?.order_id || null,
          razorpaySignature: razorpay_signature,
          paymentType: "ONLINE",
          planId: plan.id,
          planName: plan.name,
          billingType: validBillingType,
          baseAmount: gstCalc.baseAmount,
          gstPercent: gstCalc.gstPercent || 18,
          gstAmount: gstCalc.gstAmount || 0,
          totalAmount: totalAmount,
          currency: paymentDetails?.currency || "INR",
          paymentMethod: paymentDetails?.method || "card",
          status: "SUCCESS",
          paidAt: new Date(),
        },
      });

      // Create Invoice Record
      await tx.invoice.create({
        data: {
          tenantId,
          invoiceNumber,
          planName: plan.name,
          amount: totalAmount,
          baseAmount: gstCalc.baseAmount,
          gstAmount: gstCalc.gstAmount,
          gstPercent: gstCalc.gstPercent,
          status: "paid",
          currency: paymentDetails?.currency || "INR",
          billingPeriodStart: periodStart,
          billingPeriodEnd: periodEnd,
          paymentMethodBrand: paymentDetails?.method?.toUpperCase() || "AUTOPAY",
          paymentMethodLast4: paymentDetails?.card?.last4 || null,
        },
      });

      // Update Tenant
      const upd = await tx.tenant.update({
        where: { id: tenantId },
        data: {
          planId: plan.id,
          currentPlan: plan.name,
          planStatus: "active",
          subscriptionStatus: "active",
          billingType: validBillingType,
          status: "APPROVED",
          autopayEnabled: true,
          autopayMethod: paymentDetails?.method || "card",
          razorpaySubscriptionId: razorpay_subscription_id,
          planActivatedAt: periodStart,
          planPeriodStart: periodStart,
          planPeriodEnd: periodEnd,
          cancelRequestedAt: null,
          cancellationReason: null,
          dataDeletionDate: null,
          ...(address ? { address } : {}),
          ...(phone ? { phone } : {}),
        },
      });

      return { payment: createdPayment, updatedTenant: upd };
    });

    // 6. Generate GST Invoice PDF & Send Email
    try {
      const { filePath, fileUrl } = await generateInvoicePDF(payment, updatedTenant);
      await prisma.payment.update({
        where: { id: payment.id },
        data: { invoiceUrl: fileUrl },
      });

      await sendInvoiceEmail(tenant.email, {
        invoiceNumber,
        amount: totalAmount,
        planName: plan.name,
        periodEnd: periodEnd.toLocaleDateString(),
        pdfPath: filePath,
      });
    } catch (invErr) {
      console.error("Invoice PDF generation/email error:", invErr.message);
    }

    // 7. Audit Log
    const meta = extractRequestMeta(req);
    await createAuditLog({
      actorId: tenantId,
      actorType: "TENANT",
      actorName: tenant.tenantName || tenant.email,
      actorEmail: tenant.email,
      action: "PLAN_UPGRADED",
      module: "BILLING",
      description: `Tenant "${tenant.tenantName}" subscribed to "${plan.name}" with Autopay enabled (${validBillingType}).`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      tenantId: tenantId,
      metadata: {
        planName: plan.name,
        billingType: validBillingType,
        totalAmount,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySubscriptionId: razorpay_subscription_id,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Successfully subscribed to ${plan.name} Plan with Autopay!`,
      data: {
        planId: plan.id,
        planName: plan.name,
        planStatus: updatedTenant.planStatus,
        subscriptionStatus: updatedTenant.subscriptionStatus,
        billingType: updatedTenant.billingType,
        planPeriodStart: updatedTenant.planPeriodStart,
        planPeriodEnd: updatedTenant.planPeriodEnd,
        paymentId: payment.id,
        totalAmount: totalAmount,
      },
    });
  } catch (error) {
    console.error("Verify paid subscription error:", error);
    return res.status(500).json({ success: false, message: error.message });
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
        hasUsedTrial: tenant.hasUsedTrial || false,
        autopayEnabled: tenant.autopayEnabled || false,
        autopayMethod: tenant.autopayMethod || null,
        trialExtendedCount: tenant.trialExtendedCount || 0,
        subscriptionStatus: status,
        planPeriodEnd: tenant.planPeriodEnd,
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