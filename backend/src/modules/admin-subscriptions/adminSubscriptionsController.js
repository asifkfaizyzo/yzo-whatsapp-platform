import crypto from 'crypto';
import prisma from '../../config/prisma.js';
import nodemailer from 'nodemailer';
import { calculateGST } from '../superadmin/superadminService.js';
import { sendInvoiceEmail } from '../auth/emailService.js';
import { generateInvoicePDFFromModel } from '../plans/invoiceService.js';
import { createAuditLog } from '../audit/auditLogService.js';
import { extractRequestMeta } from '../../lib/utils/requestMeta.js';
import { razorpay } from '../plans/planController.js';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendStatusUpdateEmail = async (email, companyName, status, extraNote = "") => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
    await transporter.sendMail({
      from: `"SudoReply System" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Subscription status updated: ${status}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px;">
          <h2>Subscription Notification</h2>
          <p>Hi ${companyName},</p>
          <p>We are writing to notify you that your subscription status on SudoReply has been updated to: <strong>${status}</strong>.</p>
          ${extraNote ? `<p>${extraNote}</p>` : ''}
          <p>If you have any questions, please reach out to info@sudoreply.com.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Error sending admin action status email:", err);
  }
};

export const getSubscriptions = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const { status, plan, search } = req.query;

  const where = {};
  if (status) where.subscriptionStatus = status;
  if (plan) {
    where.OR = [
      { currentPlan: { contains: plan, mode: 'insensitive' } },
      { plan: { name: { contains: plan, mode: 'insensitive' } } }
    ];
  }
  if (search) {
    where.OR = [
      { tenantName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } }
    ];
  }

  try {
    const [tenants, total] = await prisma.$transaction([
      prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          tenantName: true,
          email: true,
          currentPlan: true,
          plan: {
            select: { id: true, name: true, monthlyPrice: true }
          },
          subscriptionStatus: true,
          planStatus: true,
          autopayEnabled: true,
          hasUsedTrial: true,
          trialExtendedCount: true,
          planPeriodStart: true,
          planPeriodEnd: true,
          cancelRequestedAt: true,
          cancellationReason: true,
          dataDeletionDate: true,
          createdAt: true,
        }
      }),
      prisma.tenant.count({ where })
    ]);

    const formattedTenants = tenants.map(t => ({
      id: t.id,
      tenantName: t.tenantName,
      email: t.email,
      currentPlan: t.currentPlan || (t.plan ? t.plan.name : "Starter"),
      planId: t.plan?.id,
      subscriptionStatus: t.subscriptionStatus,
      planStatus: t.planStatus,
      autopayEnabled: t.autopayEnabled || false,
      hasUsedTrial: t.hasUsedTrial || false,
      trialExtendedCount: t.trialExtendedCount || 0,
      planPeriodStart: t.planPeriodStart,
      planPeriodEnd: t.planPeriodEnd,
      cancelRequestedAt: t.cancelRequestedAt,
      cancellationReason: t.cancellationReason,
      dataDeletionDate: t.dataDeletionDate,
      createdAt: t.createdAt,
    }));

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      data: {
        tenants: formattedTenants,
        total,
        page,
        totalPages
      }
    });
  } catch (error) {
    console.error("Get admin subscriptions error:", error);
    return res.status(500).json({ success: false, message: "Server error fetching subscriptions" });
  }
};

export const updateSubscription = async (req, res) => {
  const { tenantId } = req.params;
  const { action, extendDays, planId, billingType, note } = req.body;
  const meta = extractRequestMeta(req);

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      return res.status(404).json({ success: false, message: "Tenant not found" });
    }

    let updatedData = {};
    let notificationNote = "";
    const now = new Date();

    switch (action) {
      case 'pause':
        if (tenant.razorpaySubscriptionId) {
          try {
            await razorpay.subscriptions.pause(tenant.razorpaySubscriptionId, { pause_at: 'now' });
            console.log(`[Admin] Paused Razorpay subscription ${tenant.razorpaySubscriptionId}`);
          } catch (rzpErr) {
            console.warn(`[Admin] Razorpay pause notice for ${tenant.razorpaySubscriptionId}:`, rzpErr?.error?.description || rzpErr?.message);
          }
        }
        updatedData = { 
          subscriptionStatus: 'paused',
          planStatus: 'inactive',
          autopayEnabled: false,
        };
        notificationNote = "Your account has been paused by the system administrator.";
        break;

      case 'reactivate':
        if (tenant.razorpaySubscriptionId) {
          try {
            await razorpay.subscriptions.resume(tenant.razorpaySubscriptionId, { resume_at: 'now' });
            console.log(`[Admin] Resumed Razorpay subscription ${tenant.razorpaySubscriptionId}`);
          } catch (rzpErr) {
            console.warn(`[Admin] Razorpay resume notice for ${tenant.razorpaySubscriptionId}:`, rzpErr?.error?.description || rzpErr?.message);
          }
        }
        updatedData = { 
          subscriptionStatus: 'active',
          planStatus: 'active',
          autopayEnabled: true,
          dataDeletionDate: null,
          reactivatedAt: now,
        };
        notificationNote = "Your account is now active again. Enjoy full access!";
        break;

      case 'expire':
        updatedData = { 
          subscriptionStatus: 'expired',
          planStatus: 'inactive',
          dataDeletionDate: new Date(now.getTime() + 90 * 86400000)
        };
        notificationNote = "Your subscription has been terminated and set to expired. Your configuration data is retained for 90 days.";
        break;

      case 'extend_trial':
      case 'extend': {
        const parsedDays = parseInt(extendDays, 10);
        if (isNaN(parsedDays) || parsedDays < 1) {
          return res.status(400).json({ success: false, message: "extendDays must be a positive integer" });
        }
        const currentEnd = (tenant.planPeriodEnd && new Date(tenant.planPeriodEnd) > now)
          ? new Date(tenant.planPeriodEnd)
          : now;
        const newEnd = new Date(currentEnd.getTime() + parsedDays * 86400000);

        const isTrialing = tenant.subscriptionStatus === 'trialing' || action === 'extend_trial';

        updatedData = { 
          planPeriodEnd: newEnd,
          subscriptionStatus: isTrialing ? 'trialing' : 'active',
          planStatus: 'active',
          status: 'APPROVED',
          dataDeletionDate: null,
          trialExtendedCount: (tenant.trialExtendedCount || 0) + 1,
          trialExtendedByAdmin: req.superAdmin?.email || 'Super Admin',
        };
        notificationNote = `Your plan active period has been extended by ${parsedDays} days. It is now active until ${newEnd.toLocaleDateString()}.`;
        break;
      }

      case 'change_plan': {
        if (!planId) {
          return res.status(400).json({ success: false, message: "planId is required to change plan" });
        }
        const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
        if (!plan) {
          return res.status(404).json({ success: false, message: "Plan not found" });
        }
        const parsedDays = extendDays && !isNaN(extendDays) ? parseInt(extendDays, 10) : 30;
        const periodEnd = new Date(now.getTime() + parsedDays * 86400000);
        updatedData = {
          planId: plan.id,
          currentPlan: plan.name,
          planStatus: 'active',
          subscriptionStatus: 'active',
          status: 'APPROVED',
          billingType: billingType || tenant.billingType || 'monthly',
          planActivatedAt: now,
          planPeriodStart: now,
          planPeriodEnd: periodEnd,
          dataDeletionDate: null,
        };
        notificationNote = `Your plan has been updated to ${plan.name}, active until ${periodEnd.toLocaleDateString()}.`;
        break;
      }

      default:
        return res.status(400).json({ success: false, message: `Unknown action: ${action}` });
    }

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: updatedData
    });

    // Audit Log
    await createAuditLog({
      actorId: req.superAdmin?.id || 'SUPER_ADMIN',
      actorType: 'SUPER_ADMIN',
      actorName: req.superAdmin?.name || 'Super Admin',
      actorEmail: req.superAdmin?.email || 'admin@sudoreply.com',
      action: 'PLAN_CHANGED',
      module: 'BILLING',
      description: `Subscription action "${action}" executed for tenant "${tenant.tenantName}"`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      tenantId: tenant.id,
      metadata: { action, extendDays, note }
    });

    sendStatusUpdateEmail(tenant.email, tenant.tenantName || tenant.email, updated.subscriptionStatus, notificationNote);

    return res.status(200).json({ success: true, message: "Action completed successfully", data: updated });
  } catch (error) {
    console.error("Admin update subscription error:", error);
    return res.status(500).json({ success: false, message: "Server error updating subscription" });
  }
};

// ── Manual Plan Activation (Offline Payment / Bank Transfer) ──
export const manualPlanActivation = async (req, res) => {
  const { tenantId } = req.params;
  const { 
    planId, 
    billingType = 'monthly', 
    durationDays = 30, 
    paymentRef, 
    amount, 
    paymentMethod = 'offline_bank_transfer', 
    notes 
  } = req.body;
  const meta = extractRequestMeta(req);

  // 1. Strict Validation Layer
  const validationErrors = [];
  if (!planId || typeof planId !== 'string') {
    validationErrors.push('planId is required');
  }

  if (amount !== undefined && amount !== null && amount !== '') {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      validationErrors.push('amount must be a positive number');
    }
  }

  const parsedDurationDays = parseInt(durationDays, 10);
  if (isNaN(parsedDurationDays) || parsedDurationDays < 1 || parsedDurationDays > 3650) {
    validationErrors.push('durationDays must be an integer between 1 and 3650');
  }

  const validPaymentMethods = [
    'offline_bank_transfer', 'cash', 'direct_upi', 'cheque', 'imps', 'neft', 'rtgs'
  ];
  if (!validPaymentMethods.includes(paymentMethod.toLowerCase())) {
    validationErrors.push(`paymentMethod must be one of: ${validPaymentMethods.join(', ')}`);
  }

  if (validationErrors.length > 0) {
    return res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Invalid input data',
      errors: validationErrors,
    });
  }

  try {
    const [tenant, plan] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId } }),
      prisma.subscriptionPlan.findUnique({ where: { id: planId } }),
    ]);

    if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found" });
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });

    // 2. Idempotency Check: Prevent duplicate payment records for same reference
    if (paymentRef) {
      const existingPayment = await prisma.payment.findFirst({
        where: {
          tenantId: tenant.id,
          offlineReference: paymentRef,
          status: 'SUCCESS',
        }
      });
      if (existingPayment) {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_PAYMENT_REF',
          message: `A payment with reference "${paymentRef}" has already been recorded for this tenant.`,
          data: { paymentId: existingPayment.id }
        });
      }
    }

    // 3. Prevent Double Billing: Cancel any active Razorpay subscription before overriding
    if (tenant.razorpaySubscriptionId && tenant.autopayEnabled) {
      try {
        const rzpSub = await razorpay.subscriptions.fetch(tenant.razorpaySubscriptionId);
        if (!['cancelled', 'completed', 'expired'].includes(rzpSub.status)) {
          await razorpay.subscriptions.cancel(tenant.razorpaySubscriptionId, false);
        }
      } catch (subCancelErr) {
        console.warn(`Could not cancel Razorpay subscription ${tenant.razorpaySubscriptionId}:`, subCancelErr.message);
      }
    }

    // 4. GST & Pricing Calculation (Cleanly computed prior to opening transaction)
    const periodStart = new Date();
    const periodEnd = new Date(periodStart.getTime() + parsedDurationDays * 86400000);
    const rawBaseAmount = amount 
      ? parseFloat(amount) 
      : (billingType === 'annual' && plan.annualPrice ? plan.annualPrice : plan.monthlyPrice);
    const gstCalc = await calculateGST(rawBaseAmount);

    // 5. Generate Collision-Safe Unique Invoice Number
    const invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const generatedPaymentId = paymentRef || `OFFLINE_PAY_${Date.now()}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // 6. Execute Atomic Transaction
    const result = await prisma.$transaction(async (tx) => {
      // A. Update Tenant to Active
      const updatedTenant = await tx.tenant.update({
        where: { id: tenantId },
        data: {
          planId: plan.id,
          currentPlan: plan.name,
          billingType,
          planActivatedAt: periodStart,
          planPeriodStart: periodStart,
          planPeriodEnd: periodEnd,
          subscriptionStatus: 'active',
          planStatus: 'active',
          status: 'APPROVED',
          dataDeletionDate: null,
          cancelRequestedAt: null,
          cancellationReason: null,
          razorpaySubscriptionId: null,
          autopayEnabled: false,
          autopayMethod: null,
        }
      });

      // B. Insert Payment Record (Directly feeds Super Admin Revenue Hub)
      const payment = await tx.payment.create({
        data: {
          tenantId: tenant.id,
          razorpayOrderId: null,
          razorpayPaymentId: generatedPaymentId,
          razorpaySignature: 'OFFLINE_VERIFIED_BY_ADMIN',
          paymentType: 'OFFLINE',
          offlineReference: paymentRef || null,
          planId: plan.id,
          planName: plan.name,
          billingType,
          baseAmount: gstCalc.baseAmount,
          gstPercent: gstCalc.gstPercent || 18,
          gstAmount: gstCalc.gstAmount || 0,
          totalAmount: gstCalc.totalAmount,
          currency: 'INR',
          paymentMethod: paymentMethod.toLowerCase(),
          status: 'SUCCESS',
          paidAt: periodStart,
        }
      });

      // C. Create Official Invoice
      const invoice = await tx.invoice.create({
        data: {
          tenantId: tenant.id,
          invoiceNumber,
          planName: plan.name,
          amount: gstCalc.totalAmount,
          baseAmount: gstCalc.baseAmount,
          gstAmount: gstCalc.gstAmount,
          gstPercent: gstCalc.gstPercent,
          status: 'paid',
          currency: 'INR',
          billingPeriodStart: periodStart,
          billingPeriodEnd: periodEnd,
          paymentMethodBrand: paymentMethod.toUpperCase(),
          paymentMethodLast4: null,
          offlineReference: paymentRef || null,
        }
      });

      // D. Create Audit Log
      await tx.auditLog.create({
        data: {
          actorId: req.superAdmin?.id || 'SUPER_ADMIN',
          actorType: 'SUPER_ADMIN',
          actorName: req.superAdmin?.name || 'Super Admin',
          actorEmail: req.superAdmin?.email || 'admin@sudoreply.com',
          action: 'PLAN_ACTIVATED',
          module: 'BILLING',
          description: `Manual offline plan activation for "${tenant.tenantName}" (${plan.name}) — Ref: ${paymentRef || 'N/A'}, Total: ₹${gstCalc.totalAmount}`,
          tenantId: tenant.id,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          metadata: { paymentId: payment.id, invoiceId: invoice.id, durationDays: parsedDurationDays, notes }
        }
      });

      return { updatedTenant, payment, invoice };
    });

    // 7. Generate PDF and Send Invoice Email
    try {
      const { filePath, fileUrl } = await generateInvoicePDFFromModel(result.invoice, tenant);
      await prisma.invoice.update({
        where: { id: result.invoice.id },
        data: { pdfUrl: fileUrl }
      });

      await sendInvoiceEmail(tenant.email, {
        invoiceNumber: result.invoice.invoiceNumber,
        amount: gstCalc.totalAmount,
        planName: plan.name,
        periodEnd: periodEnd.toLocaleDateString(),
        pdfPath: filePath,
      });
    } catch (emailErr) {
      console.error(`Invoice delivery warning for ${tenant.email}:`, emailErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Plan ${plan.name} manually activated for ${parsedDurationDays} days. Revenue updated.`,
      data: result
    });
  } catch (error) {
    console.error("Manual plan activation error:", error);
    return res.status(500).json({ success: false, message: "Failed to manually activate plan: " + error.message });
  }
};