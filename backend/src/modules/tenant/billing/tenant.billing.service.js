// backend/src/modules/tenant/billing/tenant.billing.service.js (do not remove this comment)
import fs from "fs";
import path from "path";
import { AuditAction, AuditModule } from "@prisma/client";
import prisma from "../../../config/prisma.js";
import razorpay from "../../../config/razorpay.js";
import { getUsageSummary } from "../../../lib/entitlements/usage.service.js";
import { calculateGST as rawCalculateGST } from "../../../lib/billing.js";
import {
  generateInvoicePDF,
  getInvoiceSettings,
} from "../../../lib/invoice.js";
import {
  cancelRazorpaySubscriptionBestEffort,
  DAY_MS,
  getPlanPriceForCycle,
} from "../../../lib/billingPeriod.js";
import { logTenantAudit } from "../../audit/tenant.audit.js";

const INVOICE_DIR = path.resolve("uploads/invoices");

async function calculateGST(amount) {
  const res = await rawCalculateGST(amount);
  const taxRate = Number(res.taxRate ?? res.gstPercent ?? 0);
  const taxAmount = Number(res.taxAmount ?? res.gstAmount ?? 0);
  return {
    ...res,
    baseAmount: Number(res.baseAmount ?? amount ?? 0),
    taxRate,
    taxAmount,
    totalAmount: Number(res.totalAmount ?? 0),
    gstRegistered:
      res.gstRegistered !== undefined
        ? Boolean(res.gstRegistered)
        : taxRate > 0,
    taxLabel: res.taxLabel || "GST",
    currency: res.currency || "INR",
  };
}

async function getGSTSettings() {
  const [settings, sample] = await Promise.all([
    getInvoiceSettings(),
    rawCalculateGST(100),
  ]);
  const taxRate = Number(
    settings?.taxRate ??
      settings?.gstPercent ??
      sample?.taxRate ??
      sample?.gstPercent ??
      0,
  );
  const gstRegistered =
    settings?.gstRegistered !== undefined
      ? Boolean(settings.gstRegistered)
      : taxRate > 0;
  return {
    ...settings,
    taxRate,
    gstRegistered,
    taxLabel: settings?.taxLabel || "GST",
    currency: settings?.currency || "INR",
  };
}
import { createSuperAdminNotification } from "../../superadmin-notifications/superadminNotification.service.js";
import {
  sendCancellationConfirmedEmail,
  sendCancellationAdminAlertEmail,
  sendReactivationConfirmedEmail,
  sendSubscriptionPausedEmail,
  sendSubscriptionResumedEmail,
} from "../../email/index.js";
import { HttpError } from "../../../lib/utils/http.error.js";
import logger from "../../../config/logger.js";

/**
 * GET /tenant/billing/overview (and /tenant/billing/details)
 * Pure read-only billing dashboard payload with subscription status, plan pricing,
 * pending scheduled change, grace state, resolved entitlements + usage summary,
 * active add-ons, credit pools, recent invoices, and recent payments.
 */
export async function getBillingOverviewService(tenantId) {
  const now = new Date();

  const [tenant, tenantAddOns, invoices, payments, gstSettings] =
    await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          businessName: true,
          email: true,
          phone: true,
          address: true,
          status: true,
          createdAt: true,
          subscription: {
            include: {
              plan: true,
              pendingPlan: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  monthlyPrice: true,
                  quarterlyPrice: true,
                  annualPrice: true,
                },
              },
            },
          },
        },
      }),
      prisma.tenantAddOn.findMany({
        where: {
          tenantId,
          status: { in: ["active", "cancel_at_period_end"] },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        include: { addOn: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.invoice.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
      prisma.payment.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
      getGSTSettings(),
    ]);

  if (!tenant) {
    throw new HttpError(404, "Tenant not found.", "TENANT_NOT_FOUND");
  }

  const sub = tenant.subscription;

  let usageSummary = null;
  try {
    usageSummary = await getUsageSummary(tenantId);
  } catch (err) {
    logger.warn("Could not compute usage summary in billing overview", {
      tenantId,
      error: err?.message,
    });
  }

  let daysRemaining = 0;
  if (sub?.planPeriodEnd) {
    const diff = new Date(sub.planPeriodEnd).getTime() - now.getTime();
    daysRemaining = Math.max(0, Math.ceil(diff / DAY_MS));
  }

  const isInGracePeriod = Boolean(
    sub?.subscriptionStatus === "payment_failed" &&
    sub?.gracePeriodEnd &&
    new Date(sub.gracePeriodEnd).getTime() > now.getTime(),
  );

  let graceDaysRemaining = 0;
  if (isInGracePeriod && sub?.gracePeriodEnd) {
    const diff = new Date(sub.gracePeriodEnd).getTime() - now.getTime();
    graceDaysRemaining = Math.max(0, Math.ceil(diff / DAY_MS));
  }

  const isFreeOverrideActive = Boolean(
    sub?.freeUntilDate && new Date(sub.freeUntilDate).getTime() > now.getTime(),
  );

  let currentCyclePricing = null;
  if (sub?.plan && sub.billingCycle && sub.billingCycle !== "ONE_TIME") {
    try {
      const basePrice = getPlanPriceForCycle(sub.plan, sub.billingCycle);
      currentCyclePricing = await calculateGST(basePrice);
    } catch {
      currentCyclePricing = null;
    }
  }

  return {
    tenant: {
      id: tenant.id,
      businessName: tenant.businessName,
      email: tenant.email,
      phone: tenant.phone,
      address: tenant.address,
      status: tenant.status,
      createdAt: tenant.createdAt,
    },
    subscription: {
      id: sub?.id || null,
      planId: sub?.planId || null,
      currentPlan: sub?.plan?.name || sub?.currentPlan || null,
      planSlug: sub?.plan?.slug || null,
      billingCycle: sub?.billingCycle || null,
      subscriptionStatus: sub?.subscriptionStatus || "inactive",
      planActivatedAt: sub?.planActivatedAt || null,
      planPeriodStart: sub?.planPeriodStart || null,
      planPeriodEnd: sub?.planPeriodEnd || null,
      daysRemaining,
      autopayEnabled: Boolean(sub?.autopayEnabled),
      razorpaySubscriptionId: sub?.razorpaySubscriptionId || null,
      pendingPlanId: sub?.pendingPlanId || null,
      pendingBillingCycle: sub?.pendingBillingCycle || null,
      pendingPlan: sub?.pendingPlan || null,
      isInGracePeriod,
      gracePeriodDays: sub?.gracePeriodDays ?? null,
      gracePeriodEnd: sub?.gracePeriodEnd || null,
      graceDaysRemaining,
      graceDebtDays: sub?.graceDebtDays || 0,
      isFreeOverrideActive,
      freeUntilDate: sub?.freeUntilDate || null,
      freeAccessNote: sub?.freeAccessNote || null,
      cancelRequestedAt: sub?.cancelRequestedAt || null,
      cancellationReason: sub?.cancellationReason || null,
      dataDeletionDate: sub?.dataDeletionDate || null,
      pricing: currentCyclePricing,
    },
    planDetails: sub?.plan
      ? {
          id: sub.plan.id,
          name: sub.plan.name,
          slug: sub.plan.slug,
          description: sub.plan.description,
          planType: sub.plan.planType,
          visibility: sub.plan.visibility,
          monthlyPrice: sub.plan.monthlyPrice,
          quarterlyPrice: sub.plan.quarterlyPrice,
          annualPrice: sub.plan.annualPrice,
          features: sub.plan.features,
        }
      : null,
    entitlements: usageSummary?.entitlements || usageSummary || null,
    usage: usageSummary?.usage || usageSummary || null,
    usageWindow: usageSummary?.usageWindow || null,
    creditPools: usageSummary?.creditPools || {},
    activeAddOns: tenantAddOns.map((ta) => ({
      id: ta.id,
      addOnId: ta.addOnId,
      name: ta.addOn?.name || null,
      slug: ta.addOn?.slug || null,
      type: ta.addOn?.type || null,
      entitlementKey: ta.addOn?.entitlementKey || null,
      amountPerUnit: ta.addOn?.amountPerUnit || 0,
      quantity: ta.quantity,
      totalGranted:
        Number(ta.addOn?.amountPerUnit || 0) * Number(ta.quantity || 1),
      billingCycle: ta.addOn?.billingCycle || null,
      status: ta.status,
      source: ta.source,
      autopayEnabled: Boolean(
        ta.razorpaySubscriptionId && ta.status === "active",
      ),
      startsAt: ta.startsAt,
      expiresAt: ta.expiresAt,
      cancelledAt: ta.cancelledAt,
    })),
    invoices,
    payments,
    tax: {
      taxRate: gstSettings.gstRegistered ? gstSettings.taxRate : 0,
      taxLabel: gstSettings.taxLabel,
      gstRegistered: gstSettings.gstRegistered,
      gstNumber: gstSettings.gstNumber || null,
      sacCode: gstSettings.sacCode || null,
      currency: gstSettings.currency || "INR",
    },
  };
}

/**
 * POST /tenant/billing/cancel (and /tenant/billing/cancel-autopay)
 * Cancels the tenant's base subscription at period end (or keeps trialing until trial end).
 */
export async function cancelSubscriptionService(
  tenantId,
  {
    reason,
    feedback = null,
    wouldReturn = null,
    missingFeature = null,
    switchedTo = null,
    priceFeedback = null,
    rating = null,
  },
  meta = {},
) {
  const now = new Date();

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscription: {
        include: { plan: true },
      },
    },
  });

  if (!tenant) {
    throw new HttpError(404, "Tenant not found.", "TENANT_NOT_FOUND");
  }

  const sub = tenant.subscription;
  if (!sub) {
    throw new HttpError(
      400,
      "No subscription record found for this account.",
      "SUBSCRIPTION_NOT_FOUND",
    );
  }

  if (sub.subscriptionStatus === "cancel_at_period_end") {
    throw new HttpError(
      409,
      "Your subscription is already scheduled for cancellation at the end of the current period.",
      "ALREADY_CANCEL_SCHEDULED",
    );
  }

  if (
    sub.subscriptionStatus === "trialing" &&
    sub.cancelRequestedAt &&
    !sub.autopayEnabled
  ) {
    throw new HttpError(
      409,
      "Your free trial is already scheduled to end on the expiry date.",
      "ALREADY_CANCEL_SCHEDULED",
    );
  }

  if (!["active", "trialing", "paused"].includes(sub.subscriptionStatus)) {
    throw new HttpError(
      409,
      `Cannot cancel a subscription with status "${sub.subscriptionStatus}".`,
      "INVALID_SUBSCRIPTION_STATE",
    );
  }

  if (sub.razorpaySubscriptionId) {
    await cancelRazorpaySubscriptionBestEffort(sub.razorpaySubscriptionId, {
      atCycleEnd: false,
    });
  }

  const newStatus =
    sub.subscriptionStatus === "trialing" ? "trialing" : "cancel_at_period_end";

  const updatedSub = await prisma.$transaction(async (tx) => {
    const updated = await tx.tenantSubscription.update({
      where: { tenantId },
      data: {
        subscriptionStatus: newStatus,
        autopayEnabled: false,
        pendingPlanId: null,
        pendingBillingCycle: null,
        cancelRequestedAt: now,
        cancellationReason: reason,
      },
      include: { plan: true },
    });

    await tx.cancellationSurvey.upsert({
      where: { tenantId },
      update: {
        reason,
        feedback,
        wouldReturn,
        missingFeature,
        switchedTo,
        priceFeedback,
        rating,
        planAtCancel: sub.plan?.name || sub.currentPlan || null,
        billingType: sub.billingCycle || null,
      },
      create: {
        tenantId,
        reason,
        feedback,
        wouldReturn,
        missingFeature,
        switchedTo,
        priceFeedback,
        rating,
        planAtCancel: sub.plan?.name || sub.currentPlan || null,
        billingType: sub.billingCycle || null,
      },
    });

    return updated;
  });

  const planDisplayName =
    updatedSub.plan?.name || updatedSub.currentPlan || "Subscription";

  await logTenantAudit({
    tenantId,
    actorType: "TENANT",
    actorId: meta.actorId || tenantId,
    actorName: meta.actorName || tenant.businessName || tenant.email,
    action: AuditAction.PLAN_CANCELLED,
    module: AuditModule.BILLING,
    targetId: updatedSub.planId,
    targetRef: planDisplayName,
    ipAddress: meta.ipAddress || null,
    userAgent: meta.userAgent || null,
    details: {
      planId: updatedSub.planId,
      planName: planDisplayName,
      billingCycle: updatedSub.billingCycle,
      reason,
      feedback,
      rating,
      wouldReturn,
      previousStatus: sub.subscriptionStatus,
      newStatus,
      accessUntil: updatedSub.planPeriodEnd,
    },
  });

  try {
    if (tenant.email) {
      await sendCancellationConfirmedEmail(tenant.email, {
        tenantName: tenant.businessName || tenant.email,
        planName: planDisplayName,
        accessUntil: updatedSub.planPeriodEnd,
        reason,
      });
    }

    const adminEmail = process.env.SUPER_ADMIN_EMAIL || process.env.SMTP_FROM_EMAIL;
    if (adminEmail) {
      await sendCancellationAdminAlertEmail(adminEmail, {
        companyName: tenant.businessName || tenant.email,
        tenantEmail: tenant.email,
        planName: planDisplayName,
        billingType: updatedSub.billingCycle,
        reason,
        feedback,
        wouldReturn,
        missingFeature,
        switchedTo,
        priceFeedback,
        rating,
        accessUntil: updatedSub.planPeriodEnd,
      });
    }
  } catch (err) {
    logger.warn("Non-fatal cancellation email warning", {
      tenantId,
      error: err?.message,
    });
  }

  await createSuperAdminNotification({
    type: "subscription_cancelled",
    title: "Subscription Cancelled",
    message: `${
      tenant.businessName || tenant.email
    } cancelled their ${planDisplayName} plan. Reason: ${reason}`,
    tenantId,
    metadata: {
      planId: updatedSub.planId,
      planName: planDisplayName,
      billingCycle: updatedSub.billingCycle,
      reason,
      rating,
      wouldReturn,
      accessUntil: updatedSub.planPeriodEnd,
    },
  });

  return {
    subscriptionStatus: updatedSub.subscriptionStatus,
    autopayEnabled: updatedSub.autopayEnabled,
    accessUntil: updatedSub.planPeriodEnd,
    cancelRequestedAt: updatedSub.cancelRequestedAt,
    cancellationReason: updatedSub.cancellationReason,
  };
}

/**
 * POST /tenant/billing/reactivate
 * Undoes a scheduled cancellation while the paid period is still active.
 */
export async function reactivateSubscriptionService(tenantId, meta = {}) {
  const now = new Date();

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscription: {
        include: { plan: true },
      },
    },
  });

  if (!tenant) {
    throw new HttpError(404, "Tenant not found.", "TENANT_NOT_FOUND");
  }

  const sub = tenant.subscription;
  if (!sub || sub.subscriptionStatus !== "cancel_at_period_end") {
    throw new HttpError(
      409,
      "Only subscriptions scheduled for cancellation at period end can be reactivated.",
      "INVALID_SUBSCRIPTION_STATE",
    );
  }

  if (
    sub.planPeriodEnd &&
    new Date(sub.planPeriodEnd).getTime() <= now.getTime()
  ) {
    throw new HttpError(
      400,
      "Your billing period has already ended. Please renew or purchase a plan.",
      "PERIOD_ALREADY_ENDED",
    );
  }

  const updatedSub = await prisma.$transaction(async (tx) => {
    const updated = await tx.tenantSubscription.update({
      where: { tenantId },
      data: {
        subscriptionStatus: "active",
        cancelRequestedAt: null,
        cancellationReason: null,
      },
      include: { plan: true },
    });

    await tx.cancellationSurvey.deleteMany({ where: { tenantId } });
    return updated;
  });

  const planDisplayName =
    updatedSub.plan?.name || updatedSub.currentPlan || "Subscription";

  await logTenantAudit({
    tenantId,
    actorType: "TENANT",
    actorId: meta.actorId || tenantId,
    actorName: meta.actorName || tenant.businessName || tenant.email,
    action: AuditAction.SUBSCRIPTION_REACTIVATED,
    module: AuditModule.BILLING,
    targetId: updatedSub.planId,
    targetRef: planDisplayName,
    ipAddress: meta.ipAddress || null,
    userAgent: meta.userAgent || null,
    details: {
      planId: updatedSub.planId,
      planName: planDisplayName,
      planPeriodEnd: updatedSub.planPeriodEnd,
    },
  });

  try {
    if (tenant.email) {
      await sendReactivationConfirmedEmail(tenant.email, {
        tenantName: tenant.businessName || tenant.email,
        planName: planDisplayName,
        periodEnd: updatedSub.planPeriodEnd,
      });
    }
  } catch (err) {
    logger.warn("Non-fatal reactivation email warning", {
      tenantId,
      error: err?.message,
    });
  }

  await createSuperAdminNotification({
    type: "subscription_reactivated",
    title: "Subscription Reactivated",
    message: `${
      tenant.businessName || tenant.email
    } reactivated their ${planDisplayName} plan.`,
    tenantId,
    metadata: {
      planId: updatedSub.planId,
      planName: planDisplayName,
      periodEnd: updatedSub.planPeriodEnd,
    },
  });

  return {
    subscriptionStatus: updatedSub.subscriptionStatus,
    planPeriodEnd: updatedSub.planPeriodEnd,
    autopayEnabled: updatedSub.autopayEnabled,
  };
}

/**
 * POST /tenant/billing/pause
 * Pauses an active/trialing/cancel_at_period_end subscription.
 */
export async function pauseSubscriptionService(tenantId, meta = {}) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscription: {
        include: { plan: true },
      },
    },
  });

  if (!tenant) {
    throw new HttpError(404, "Tenant not found.", "TENANT_NOT_FOUND");
  }

  const sub = tenant.subscription;
  if (
    !sub ||
    !["active", "trialing", "cancel_at_period_end"].includes(
      sub.subscriptionStatus,
    )
  ) {
    throw new HttpError(
      409,
      `Cannot pause a subscription with status "${
        sub?.subscriptionStatus || "none"
      }".`,
      "INVALID_SUBSCRIPTION_STATE",
    );
  }

  if (sub.razorpaySubscriptionId) {
    try {
      await razorpay.subscriptions.pause(sub.razorpaySubscriptionId, {
        pause_at: "now",
      });
    } catch (err) {
      logger.warn("Razorpay subscription pause warning", {
        tenantId,
        razorpaySubscriptionId: sub.razorpaySubscriptionId,
        error: err?.error?.description || err?.message,
      });
    }
  }

  const updatedSub = await prisma.tenantSubscription.update({
    where: { tenantId },
    data: {
      subscriptionStatus: "paused",
      autopayEnabled: false,
    },
    include: { plan: true },
  });

  const planDisplayName =
    updatedSub.plan?.name || updatedSub.currentPlan || "Subscription";

  await logTenantAudit({
    tenantId,
    actorType: "TENANT",
    actorId: meta.actorId || tenantId,
    actorName: meta.actorName || tenant.businessName || tenant.email,
    action: AuditAction.SUBSCRIPTION_PAUSED,
    module: AuditModule.BILLING,
    targetId: updatedSub.planId,
    targetRef: planDisplayName,
    ipAddress: meta.ipAddress || null,
    userAgent: meta.userAgent || null,
    details: {
      previousStatus: sub.subscriptionStatus,
      planId: updatedSub.planId,
      planName: planDisplayName,
    },
  });

  try {
    if (tenant.email) {
      await sendSubscriptionPausedEmail(tenant.email, {
        tenantName: tenant.businessName || tenant.email,
        planName: planDisplayName,
        periodEnd: updatedSub.planPeriodEnd,
      });
    }
  } catch (err) {
    logger.warn("Non-fatal pause email warning", {
      tenantId,
      error: err?.message,
    });
  }

  await createSuperAdminNotification({
    type: "subscription_paused",
    title: "Subscription Paused",
    message: `${
      tenant.businessName || tenant.email
    } paused their ${planDisplayName} plan.`,
    tenantId,
    metadata: {
      planId: updatedSub.planId,
      planName: planDisplayName,
    },
  });

  return {
    subscriptionStatus: updatedSub.subscriptionStatus,
    autopayEnabled: updatedSub.autopayEnabled,
  };
}

/**
 * POST /tenant/billing/resume
 * Resumes a paused subscription.
 */
export async function resumeSubscriptionService(tenantId, meta = {}) {
  const now = new Date();

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscription: {
        include: { plan: true },
      },
    },
  });

  if (!tenant) {
    throw new HttpError(404, "Tenant not found.", "TENANT_NOT_FOUND");
  }

  const sub = tenant.subscription;
  if (!sub || sub.subscriptionStatus !== "paused") {
    throw new HttpError(
      409,
      "Only paused subscriptions can be resumed.",
      "INVALID_SUBSCRIPTION_STATE",
    );
  }

  if (
    sub.planPeriodEnd &&
    new Date(sub.planPeriodEnd).getTime() <= now.getTime()
  ) {
    throw new HttpError(
      400,
      "Your billing period has ended while paused. Please renew or purchase a plan.",
      "PERIOD_ALREADY_ENDED",
    );
  }

  let rzpResumedActive = false;
  if (sub.razorpaySubscriptionId && !sub.cancelRequestedAt) {
    try {
      const rzpSub = await razorpay.subscriptions.fetch(
        sub.razorpaySubscriptionId,
      );
      if (rzpSub.status === "paused") {
        await razorpay.subscriptions.resume(sub.razorpaySubscriptionId, {
          resume_at: "now",
        });
        rzpResumedActive = true;
      } else if (rzpSub.status === "active") {
        rzpResumedActive = true;
      }
    } catch (err) {
      logger.error("Failed to resume Razorpay subscription", {
        tenantId,
        razorpaySubscriptionId: sub.razorpaySubscriptionId,
        error: err?.error?.description || err?.message,
      });
      throw new HttpError(
        502,
        "Could not resume autopay with payment gateway. Please try again or contact support.",
        "PAYMENT_GATEWAY_ERROR",
      );
    }
  }

  const restoredStatus = sub.cancelRequestedAt
    ? "cancel_at_period_end"
    : sub.planActivatedAt
      ? "active"
      : "trialing";

  const updatedSub = await prisma.tenantSubscription.update({
    where: { tenantId },
    data: {
      subscriptionStatus: restoredStatus,
      autopayEnabled: Boolean(rzpResumedActive && restoredStatus === "active"),
    },
    include: { plan: true },
  });

  const planDisplayName =
    updatedSub.plan?.name || updatedSub.currentPlan || "Subscription";

  await logTenantAudit({
    tenantId,
    actorType: "TENANT",
    actorId: meta.actorId || tenantId,
    actorName: meta.actorName || tenant.businessName || tenant.email,
    action: AuditAction.SUBSCRIPTION_REACTIVATED,
    module: AuditModule.BILLING,
    targetId: updatedSub.planId,
    targetRef: planDisplayName,
    ipAddress: meta.ipAddress || null,
    userAgent: meta.userAgent || null,
    details: {
      action: "resumed_from_paused",
      restoredStatus,
      autopayEnabled: updatedSub.autopayEnabled,
    },
  });

  try {
    if (tenant.email) {
      await sendSubscriptionResumedEmail(tenant.email, {
        tenantName: tenant.businessName || tenant.email,
        planName: planDisplayName,
        periodEnd: updatedSub.planPeriodEnd,
      });
    }
  } catch (err) {
    logger.warn("Non-fatal resume email warning", {
      tenantId,
      error: err?.message,
    });
  }

  await createSuperAdminNotification({
    type: "subscription_resumed",
    title: "Subscription Resumed",
    message: `${
      tenant.businessName || tenant.email
    } resumed their ${planDisplayName} plan.`,
    tenantId,
    metadata: {
      planId: updatedSub.planId,
      planName: planDisplayName,
      restoredStatus,
    },
  });

  return {
    subscriptionStatus: updatedSub.subscriptionStatus,
    autopayEnabled: updatedSub.autopayEnabled,
    planPeriodEnd: updatedSub.planPeriodEnd,
  };
}

/**
 * GET /tenant/billing/invoices
 */
export async function listTenantInvoicesService(
  tenantId,
  { page = 1, limit = 20, status, purchaseType },
) {
  const where = { tenantId };
  if (status) where.status = status;
  if (purchaseType) where.purchaseType = purchaseType;

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.invoice.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * GET /tenant/billing/payments
 */
export async function listTenantPaymentsService(
  tenantId,
  { page = 1, limit = 20, status, purchaseType },
) {
  const where = { tenantId };
  if (status) where.status = status;
  if (purchaseType) where.purchaseType = purchaseType;

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.payment.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Resolves and ensures the PDF file exists on disk for a tenant's Invoice.
 */
async function resolveInvoicePdfPath(invoice, tenant) {
  let filePath = path.join(INVOICE_DIR, `${invoice.invoiceNumber}.pdf`);
  if (!fs.existsSync(filePath)) {
    const gstSettings = await getGSTSettings();
    const generated = await generateInvoicePDF(invoice, tenant, gstSettings);
    filePath = generated.filePath;
  }
  return {
    filePath,
    fileName: `${invoice.invoiceNumber}.pdf`,
  };
}

/**
 * GET /tenant/billing/invoices/:invoiceId/download
 * Resolves an Invoice by id or invoiceNumber for the authenticated tenant and returns its PDF path.
 */
export async function getTenantInvoicePdfByInvoiceIdService(
  tenantId,
  invoiceIdOrNumber,
) {
  const [tenant, invoice] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.invoice.findFirst({
      where: {
        tenantId,
        OR: [{ id: invoiceIdOrNumber }, { invoiceNumber: invoiceIdOrNumber }],
      },
    }),
  ]);

  if (!tenant) {
    throw new HttpError(404, "Tenant not found.", "TENANT_NOT_FOUND");
  }
  if (!invoice) {
    throw new HttpError(404, "Invoice not found.", "INVOICE_NOT_FOUND");
  }

  return resolveInvoicePdfPath(invoice, tenant);
}

/**
 * GET /tenant/billing/payments/:paymentId/invoice
 * Resolves an Invoice linked to a Payment row for the authenticated tenant and returns its PDF path.
 */
export async function getTenantInvoicePdfByPaymentIdService(
  tenantId,
  paymentId,
) {
  const [tenant, payment] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.payment.findFirst({
      where: { id: paymentId, tenantId },
    }),
  ]);

  if (!tenant) {
    throw new HttpError(404, "Tenant not found.", "TENANT_NOT_FOUND");
  }
  if (!payment || payment.status !== "SUCCESS") {
    throw new HttpError(
      404,
      "Completed payment record not found.",
      "PAYMENT_NOT_FOUND",
    );
  }

  let invoice = await prisma.invoice.findFirst({
    where: {
      tenantId,
      OR: [
        { paymentId: payment.id },
        ...(payment.invoiceNumber
          ? [{ invoiceNumber: payment.invoiceNumber }]
          : []),
      ],
    },
  });

  if (!invoice && payment.invoiceNumber) {
    invoice = await prisma.invoice.create({
      data: {
        tenantId,
        invoiceNumber: payment.invoiceNumber,
        paymentId: payment.id,
        planName:
          payment.metadata?.planName ||
          payment.metadata?.addOnName ||
          "SudoReply Subscription",
        planSlug:
          payment.metadata?.planSlug || payment.metadata?.addOnSlug || null,
        billingCycle: payment.billingCycle,
        purchaseType: payment.purchaseType || "PLAN",
        baseAmount: payment.baseAmount,
        taxRate: payment.taxRate,
        taxAmount: payment.taxAmount,
        amount: payment.amount,
        currency: payment.currency || "INR",
        status: "paid",
        paidAt: payment.createdAt,
        invoiceUrl: `/invoices/${payment.invoiceNumber}.pdf`,
      },
    });
  }

  if (!invoice) {
    throw new HttpError(
      404,
      "Invoice not found for this payment.",
      "INVOICE_NOT_FOUND",
    );
  }

  return resolveInvoicePdfPath(invoice, tenant);
}
