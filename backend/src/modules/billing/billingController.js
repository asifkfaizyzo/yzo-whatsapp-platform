import prisma from '../../config/prisma.js';
import { generateInvoicePDFFromModel } from '../plans/invoiceService.js';
import {
  sendCancellationConfirmedEmail,
  sendCancellationAdminAlertEmail,
  sendReactivationConfirmedEmail,
  sendPauseAdminAlertEmail,
  sendResumeAdminAlertEmail,
  sendSubscriptionPausedEmail,
  sendSubscriptionResumedEmail
} from '../auth/emailService.js';
import { createAuditLog } from '../audit/auditLogService.js';
import { extractRequestMeta } from '../../lib/utils/requestMeta.js'; 
import { razorpay } from '../../config/razorpay.js';
import { createSuperAdminNotification } from '../SuperAdminNotifications/superAdminNotificationService.js';
import { emitToSuperAdmin } from '../../lib/socket.js';

export const cancelSubscription = async (req, res) => {
  const meta = extractRequestMeta(req);
  const { reason = 'User cancelled subscription', additionalComment } = req.body;

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId }
    });

    if (!tenant) {
      return res.status(404).json({ success: false, message: "Tenant not found" });
    }

    if (tenant.subscriptionStatus !== 'active' && tenant.subscriptionStatus !== 'trialing' && tenant.subscriptionStatus !== 'paused') {
      return res.status(400).json({
        success: false,
        message: "No active, trialing, or paused subscription to cancel"
      });
    }

    // 1. Attempt to cancel mandate on Razorpay if subscription ID exists
    if (tenant.razorpaySubscriptionId) {
      try {
        const rzpSubscription = await razorpay.subscriptions.fetch(tenant.razorpaySubscriptionId);
        if (rzpSubscription && !['cancelled', 'completed', 'expired'].includes(rzpSubscription.status)) {
          await razorpay.subscriptions.cancel(tenant.razorpaySubscriptionId, false);
          console.log(`✅ Cancelled Razorpay mandate for subscription ${tenant.razorpaySubscriptionId}`);
        }
      } catch (rzpErr) {
        console.warn("⚠️ Razorpay subscription cancellation notice (proceeding with local DB cancellation):", rzpErr?.error?.description || rzpErr?.message || rzpErr);
      }
    }

    // Calculate dynamic period end if missing
    let periodEnd = tenant.planPeriodEnd;
    if (!periodEnd && tenant.planActivatedAt) {
      const activatedAt = new Date(tenant.planActivatedAt);
      periodEnd = new Date(activatedAt);
      if (tenant.billingType === 'annual') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }
    }
    if (!periodEnd) {
      periodEnd = new Date();
      periodEnd.setDate(periodEnd.getDate() + 14);
    }

    const isTrialing = tenant.subscriptionStatus === 'trialing';

    const updatedTenant = await prisma.$transaction(async (tx) => {
      const updated = await tx.tenant.update({
        where: { id: tenant.id },
        data: {
          subscriptionStatus: isTrialing ? 'trialing' : 'cancel_at_period_end',
          autopayEnabled: false,
          cancelRequestedAt: new Date(),
          planPeriodEnd: periodEnd,
          cancellationReason: reason
        }
      });

      await tx.cancellationSurvey.upsert({
        where: { tenantId: tenant.id },
        create: {
          tenantId: tenant.id,
          reason: reason,
          additionalComment: additionalComment || null
        },
        update: {
          reason: reason,
          additionalComment: additionalComment || null,
          createdAt: new Date()
        }
      });

      return updated;
    });

    // Audit log
    await createAuditLog({
      actorId: tenant.id,
      actorType: 'TENANT',
      actorName: tenant.tenantName || tenant.email,
      actorEmail: tenant.email,
      action: 'PLAN_CANCELLED',
      module: 'BILLING',
      description: `Tenant "${tenant.tenantName}" cancelled recurring subscription/autopay`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      tenantId: tenant.id,
      metadata: {
        planName: tenant.currentPlan,
        reason,
        additionalComment: additionalComment || null,
        periodEndDate: updatedTenant.planPeriodEnd,
      },
    });

    // Send emails
    try {
      const frontendUrl = process.env.FRONTEND_URLS ? process.env.FRONTEND_URLS.split(',')[1] : 'http://localhost:5174';
      const reactivateLink = `${frontendUrl}/settings/billing`;
      const periodEndStr = updatedTenant.planPeriodEnd ? new Date(updatedTenant.planPeriodEnd).toLocaleDateString() : 'N/A';
      const deletionDate = updatedTenant.planPeriodEnd ? new Date(new Date(updatedTenant.planPeriodEnd).getTime() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString() : 'N/A';

      sendCancellationConfirmedEmail(tenant.email, {
        tenantName: tenant.tenantName || tenant.email,
        planName: tenant.currentPlan || (tenant.plan ? tenant.plan.name : "Pro"),
        periodEndDate: periodEndStr,
        dataDeletionDate: deletionDate,
        reactivateLink
      });

      sendCancellationAdminAlertEmail(process.env.ADMIN_EMAIL || 'admin@sudoreply.com', {
        companyName: tenant.tenantName || 'Tenant Company',
        email: tenant.email,
        planName: tenant.currentPlan || (tenant.plan ? tenant.plan.name : "Pro"),
        reason: reason,
        comment: additionalComment || "No comment",
        periodEndDate: periodEndStr
      });
    } catch (emailErr) {
      console.warn("Cancellation email delivery error:", emailErr.message);
    }

    // SuperAdmin In-App Real-time Notification
    try {
      const notification = await createSuperAdminNotification({
        type: "subscription_cancelled",
        title: "🚨 Subscription Cancelled",
        message: `${tenant.tenantName} cancelled their subscription (${tenant.currentPlan || 'Plan'}). Reason: ${reason}`,
        metadata: {
          tenantId: tenant.id,
          tenantName: tenant.tenantName,
          tenantEmail: tenant.email,
          planName: tenant.currentPlan,
          reason,
          additionalComment,
          planPeriodEnd: updatedTenant.planPeriodEnd,
        },
      });
      emitToSuperAdmin("superadmin_notification", { notification });
    } catch (notifErr) {
      console.warn("SuperAdmin notification failed for cancellation:", notifErr.message);
    }

    const accessLabel = isTrialing ? 'free trial' : 'subscription access';

    return res.status(200).json({
      success: true,
      message: `Autopay cancelled successfully. Your ${accessLabel} remains active until ${new Date(updatedTenant.planPeriodEnd).toLocaleDateString()}.`,
      periodEndDate: updatedTenant.planPeriodEnd
    });
  } catch (error) {
    console.error("Cancel subscription error:", error);
    return res.status(500).json({ success: false, message: "Server error during cancellation" });
  }
};

// Alias cancelAutopay
export const cancelAutopay = cancelSubscription;

// Reactivate Subscription plan
export const reactivateSubscription = async (req, res) => {
  try {
    const meta = extractRequestMeta(req);
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId }
    });

    if (!tenant) {
      return res.status(404).json({ success: false, message: "Tenant not found" });
    }

    if (tenant.subscriptionStatus !== 'cancel_at_period_end') {
      return res.status(400).json({
        success: false,
        message: "Subscription is not scheduled for cancellation"
      });
    }

    const updatedTenant = await prisma.$transaction(async (tx) => {
      const updated = await tx.tenant.update({
        where: { id: tenant.id },
        data: {
          subscriptionStatus: 'active',
          cancelRequestedAt: null,
          cancellationReason: null,
          reactivatedAt: new Date()
        }
      });

      await tx.cancellationSurvey.deleteMany({
        where: { tenantId: tenant.id }
      });

      return updated;
    });

    // Audit log
    await createAuditLog({
      actorId: tenant.id,
      actorType: 'TENANT',
      actorName: tenant.tenantName || tenant.email,
      actorEmail: tenant.email,
      action: 'PLAN_ACTIVATED',
      module: 'BILLING',
      description: `Tenant "${tenant.tenantName}" reactivated their subscription (cancelled cancellation)`,
      tenantId: tenant.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: {
        planName: tenant.currentPlan,
        reactivatedAt: updatedTenant.reactivatedAt,
        nextBillingDate: updatedTenant.planPeriodEnd,
      },
    });

    // SuperAdmin In-App Real-time Notification
    try {
      const notification = await createSuperAdminNotification({
        type: "subscription_reactivated",
        title: "🎉 Subscription Reactivated",
        message: `${tenant.tenantName} reactivated their subscription (${tenant.currentPlan || 'Plan'})`,
        metadata: {
          tenantId: tenant.id,
          tenantName: tenant.tenantName,
          tenantEmail: tenant.email,
          planName: tenant.currentPlan,
          reactivatedAt: updatedTenant.reactivatedAt,
        },
      });
      emitToSuperAdmin("superadmin_notification", { notification });
    } catch (notifErr) {
      console.warn("SuperAdmin notification failed for reactivation:", notifErr.message);
    }

    // 4. Tenant Confirmation Email
    try {
      sendReactivationConfirmedEmail(tenant.email, {
        name: tenant.tenantName,
        tenantName: tenant.tenantName,
        planName: tenant.currentPlan || "Pro",
      });
    } catch (emailErr) {
      console.warn("Reactivation confirmation email error:", emailErr.message);
    }

    return res.status(200).json({ success: true, message: "Subscription reactivated successfully" });
  } catch (error) {
    console.error("Reactivate subscription error:", error);
    return res.status(500).json({ success: false, message: "Server error during reactivation" });
  }
};

// ── Tenant Self-Service: Pause Subscription ──
export const pauseSubscription = async (req, res) => {
  const meta = extractRequestMeta(req);
  const { pauseDuration = "indefinite", reason = "Customer requested pause" } = req.body;

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
    });

    if (!tenant) {
      return res.status(404).json({ success: false, message: "Tenant not found" });
    }

    if (tenant.subscriptionStatus === "paused") {
      return res.status(400).json({
        success: false,
        message: "Subscription is already paused",
      });
    }

    if (!["active", "trialing", "cancel_at_period_end"].includes(tenant.subscriptionStatus)) {
      return res.status(400).json({
        success: false,
        message: "No active or trialing subscription to pause",
      });
    }

    // 1. Pause mandate on Razorpay
    if (tenant.razorpaySubscriptionId) {
      try {
        await razorpay.subscriptions.pause(tenant.razorpaySubscriptionId, { pause_at: "now" });
        console.log(`⏸️ Paused Razorpay subscription ${tenant.razorpaySubscriptionId}`);
      } catch (rzpErr) {
        console.warn("⚠️ Razorpay pause notice (proceeding with local DB pause):", rzpErr?.error?.description || rzpErr?.message);
      }
    }

    // 2. Update Tenant state in database
    const updatedTenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        subscriptionStatus: "paused",
        planStatus: "inactive",
        autopayEnabled: false,
      },
    });

    // 3. Audit Log
    await createAuditLog({
      actorId: tenant.id,
      actorType: "TENANT",
      actorName: tenant.tenantName || tenant.email,
      actorEmail: tenant.email,
      action: "PLAN_PAUSED",
      module: "BILLING",
      description: `Tenant "${tenant.tenantName}" paused their subscription (${pauseDuration})`,
      tenantId: tenant.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: {
        planName: tenant.currentPlan,
        pauseDuration,
        reason,
      },
    });

    // 4. Admin Alert Email
    const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER || 'admin@sudoreply.com';
    sendPauseAdminAlertEmail(adminEmail, {
      companyName: tenant.tenantName,
      tenantEmail: tenant.email,
      planName: tenant.currentPlan || "Active Plan",
      pauseDuration,
      reason,
    });

    // 5. SuperAdmin In-App Real-time Notification
    try {
      const notification = await createSuperAdminNotification({
        type: "subscription_paused",
        title: "⏸️ Subscription Paused",
        message: `${tenant.tenantName} paused their subscription (${pauseDuration})`,
        metadata: {
          tenantId: tenant.id,
          tenantName: tenant.tenantName,
          tenantEmail: tenant.email,
          planName: tenant.currentPlan,
          pauseDuration,
          reason,
        },
      });
      emitToSuperAdmin("superadmin_notification", { notification });
    } catch (notifErr) {
      console.warn("SuperAdmin notification failed for pause:", notifErr.message);
    }

    // 6. Tenant Confirmation Email
    try {
      sendSubscriptionPausedEmail(tenant.email, {
        tenantName: tenant.tenantName || tenant.email,
        planName: tenant.currentPlan || "Active Plan",
        pauseDuration,
      });
    } catch (emailErr) {
      console.warn("Pause tenant confirmation email error:", emailErr.message);
    }

    return res.status(200).json({
      success: true,
      message: "Your subscription has been paused. Your templates, numbers, and contacts are safely preserved.",
      data: updatedTenant,
    });
  } catch (error) {
    console.error("Pause subscription error:", error);
    return res.status(500).json({ success: false, message: "Failed to pause subscription" });
  }
};

// ── Tenant Self-Service: Resume Subscription ──
export const resumeSubscription = async (req, res) => {
  const meta = extractRequestMeta(req);

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
    });

    if (!tenant) {
      return res.status(404).json({ success: false, message: "Tenant not found" });
    }

    if (tenant.subscriptionStatus !== "paused") {
      return res.status(400).json({
        success: false,
        message: "Subscription is not currently paused",
      });
    }

    // 1. Resume mandate on Razorpay
    if (tenant.razorpaySubscriptionId) {
      try {
        await razorpay.subscriptions.resume(tenant.razorpaySubscriptionId, { resume_at: "now" });
        console.log(`✅ Resumed Razorpay subscription ${tenant.razorpaySubscriptionId}`);
      } catch (rzpErr) {
        console.warn("⚠️ Razorpay resume notice (proceeding with local DB resume):", rzpErr?.error?.description || rzpErr?.message);
      }
    }

    // 2. Reactivate Tenant in database
    const updatedTenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        subscriptionStatus: "active",
        planStatus: "active",
        autopayEnabled: true,
        dataDeletionDate: null,
        reactivatedAt: new Date(),
      },
    });

    // 3. Audit Log
    await createAuditLog({
      actorId: tenant.id,
      actorType: "TENANT",
      actorName: tenant.tenantName || tenant.email,
      actorEmail: tenant.email,
      action: "PLAN_RESUMED",
      module: "BILLING",
      description: `Tenant "${tenant.tenantName}" resumed their paused subscription`,
      tenantId: tenant.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: {
        planName: tenant.currentPlan,
        resumedAt: new Date(),
      },
    });

    // 4. Admin Alert Email
    const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER || 'admin@sudoreply.com';
    sendResumeAdminAlertEmail(adminEmail, {
      companyName: tenant.tenantName,
      tenantEmail: tenant.email,
      planName: tenant.currentPlan || "Active Plan",
    });

    // 5. SuperAdmin In-App Real-time Notification
    try {
      const notification = await createSuperAdminNotification({
        type: "subscription_resumed",
        title: "▶️ Subscription Resumed",
        message: `${tenant.tenantName} resumed their subscription (${tenant.currentPlan || 'Plan'})`,
        metadata: {
          tenantId: tenant.id,
          tenantName: tenant.tenantName,
          tenantEmail: tenant.email,
          planName: tenant.currentPlan,
          resumedAt: new Date(),
        },
      });
      emitToSuperAdmin("superadmin_notification", { notification });
    } catch (notifErr) {
      console.warn("SuperAdmin notification failed for resume:", notifErr.message);
    }

    // 6. Tenant Confirmation Email
    try {
      sendSubscriptionResumedEmail(tenant.email, {
        tenantName: tenant.tenantName || tenant.email,
        planName: tenant.currentPlan || "Active Plan",
      });
    } catch (emailErr) {
      console.warn("Resume tenant confirmation email error:", emailErr.message);
    }

    return res.status(200).json({
      success: true,
      message: "Subscription resumed successfully! Your platform features are active.",
      data: updatedTenant,
    });
  } catch (error) {
    console.error("Resume subscription error:", error);
    return res.status(500).json({ success: false, message: "Failed to resume subscription" });
  }
};

export const getBillingOverview = async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: {
        id: true,
        subscriptionStatus: true,
        currentPlan: true,
        plan: {
          select: { name: true }
        },
        hasUsedTrial: true,
        autopayEnabled: true,
        autopayMethod: true,
        trialExtendedCount: true,
        planPeriodStart: true,
        planPeriodEnd: true,
        cancelRequestedAt: true,
        dataDeletionDate: true,
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            invoiceNumber: true,
            planName: true,
            amount: true,
            currency: true,
            status: true,
            createdAt: true
          }
        }
      }
    });

    if (!tenant) {
      return res.status(404).json({ success: false, message: "Tenant not found" });
    }

    let status = tenant.subscriptionStatus;
    let dataDeletionDate = tenant.dataDeletionDate;
    const now = new Date();

    // Self-healing: if cancelled plan has reached its period end, expire it immediately
    if (status === 'cancel_at_period_end' && tenant.planPeriodEnd && new Date(tenant.planPeriodEnd) < now) {
      const computedDeletionDate = new Date(now.getTime() + 90 * 86400000);

      await prisma.tenant.update({
        where: { id: req.tenantId },
        data: {
          subscriptionStatus: 'expired',
          planStatus: 'inactive',
          dataDeletionDate: computedDeletionDate
        }
      });
      status = 'expired';
      dataDeletionDate = computedDeletionDate;
    }

    const formattedTenant = {
      subscriptionStatus: status,
      currentPlan: tenant.currentPlan || (tenant.plan ? tenant.plan.name : "Starter"),
      hasUsedTrial: tenant.hasUsedTrial || false,
      autopayEnabled: tenant.autopayEnabled || false,
      autopayMethod: tenant.autopayMethod || null,
      trialExtendedCount: tenant.trialExtendedCount || 0,
      planPeriodStart: tenant.planPeriodStart,
      planPeriodEnd: tenant.planPeriodEnd,
      cancelRequestedAt: tenant.cancelRequestedAt,
      dataDeletionDate: dataDeletionDate,
      invoices: tenant.invoices
    };

    return res.status(200).json({ success: true, data: formattedTenant });
  } catch (error) {
    console.error("Get billing overview error:", error);
    return res.status(500).json({ success: false, message: "Server error fetching billing details" });
  }
};

export const getInvoices = async (req, res) => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json({ success: true, data: invoices });
  } catch (error) {
    console.error("Get invoices error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch invoices" });
  }
};

export const downloadInvoicePdf = async (req, res) => {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    });
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
    const { filePath, invoiceNumber } = await generateInvoicePDFFromModel(invoice, tenant);
    return res.download(filePath, `${invoiceNumber}.pdf`);
  } catch (error) {
    console.error("Download invoice error:", error);
    return res.status(500).json({ success: false, message: "Failed to download invoice" });
  }
};