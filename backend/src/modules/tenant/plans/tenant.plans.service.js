// backend/src/modules/tenant/plans/tenant.plans.service.js (do not remove this comment)
import crypto from "crypto";
import { Prisma, AuditAction, AuditModule } from "@prisma/client";
import prisma from "../../../config/prisma.js";
import razorpay from "../../../config/razorpay.js";
import { ENTITLEMENT_ARRAY } from "../../../lib/entitlements/registry.js";
import { grantCredits } from "../../../lib/entitlements/usage.service.js";
import { calculateGST as rawCalculateGST } from "../../../lib/billing.js";
import {
  generateInvoiceNumber,
  generateInvoicePDF,
  getInvoiceSettings,
} from "../../../lib/invoice.js";
import {
  addCycleDuration,
  addDays,
  assertPlanPurchasable,
  cancelRazorpaySubscriptionBestEffort,
  computeActivationPeriod,
  getOrCreateRazorpayPlanForSubscriptionPlan,
  getPlanPriceForCycle,
  isPlanOfferExpired,
} from "../../../lib/billingPeriod.js";
import { logTenantAudit } from "../../audit/tenant.audit.js";
import { createSuperAdminNotification } from "../../superadmin-notifications/superadminNotification.service.js";
import { sendInvoiceEmail } from "../../email/index.js";
import { HttpError } from "../../../lib/utils/http.error.js";
import logger from "../../../config/logger.js";

const getGSTSettings = getInvoiceSettings;

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

/**
 * Constant-time HMAC-SHA256 signature check for Razorpay payloads.
 */
export function verifyRazorpayHmac(payload, signature) {
  if (!payload || !signature || !process.env.RAZORPAY_KEY_SECRET) {
    return false;
  }
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(payload)
    .digest("hex");

  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(String(signature), "utf8");
  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Synchronously computes GST breakdown using a pre-fetched GST reference sample.
 */
function computePriceBreakdown(
  baseAmount,
  gstRef,
  monthsInCycle = 1,
  originalAmount = null,
) {
  if (baseAmount === null || baseAmount === undefined) {
    return null;
  }

  const base = Number(baseAmount);
  const taxRate = gstRef.gstRegistered ? Number(gstRef.taxRate || 0) : 0;
  const taxAmount = gstRef.gstRegistered
    ? Math.round(base * (taxRate / 100) * 100) / 100
    : 0;
  const totalAmount = Math.round((base + taxAmount) * 100) / 100;
  const monthlyEquivalent = Math.round((base / monthsInCycle) * 100) / 100;

  let originalBase =
    originalAmount !== null && originalAmount !== undefined
      ? Number(originalAmount)
      : null;
  let savingsPercent = null;
  if (originalBase !== null && originalBase > base && originalBase > 0) {
    savingsPercent = Math.round(((originalBase - base) / originalBase) * 100);
  } else {
    originalBase = null;
  }

  return {
    baseAmount: base,
    taxRate,
    taxAmount,
    totalAmount,
    monthlyEquivalent,
    originalBaseAmount: originalBase,
    savingsPercent,
    currency: gstRef.currency || "INR",
    taxLabel: gstRef.taxLabel || "GST",
    gstRegistered: Boolean(gstRef.gstRegistered),
  };
}

/**
 * Merges a plan's stored features JSON with ENTITLEMENT_ARRAY defaults so every
 * entitlement key is guaranteed present.
 */
function buildPlanEntitlements(featuresJson) {
  const raw =
    featuresJson &&
    typeof featuresJson === "object" &&
    !Array.isArray(featuresJson)
      ? featuresJson
      : {};

  const mergedFeatures = {};
  const structured = [];

  for (const def of ENTITLEMENT_ARRAY) {
    const val = raw[def.key] !== undefined ? raw[def.key] : def.defaultValue;
    mergedFeatures[def.key] = val;
    structured.push({
      key: def.key,
      label: def.label,
      category: def.category,
      type: def.type,
      unit: def.unit || null,
      value: val,
    });
  }

  return { mergedFeatures, structured };
}

/**
 * Formats a SubscriptionPlan row for public or tenant catalog consumption.
 */
function formatPlanForCatalog(
  plan,
  gstRef,
  { isCurrentPlan = false, isCustomForTenant = false, now = new Date() } = {},
) {
  const { mergedFeatures, structured } = buildPlanEntitlements(plan.features);
  const offerExpired = isPlanOfferExpired(plan, now);

  const monthlyPricing = computePriceBreakdown(
    plan.monthlyPrice,
    gstRef,
    1,
    plan.originalMonthlyPrice,
  );
  const quarterlyPricing = computePriceBreakdown(
    plan.quarterlyPrice,
    gstRef,
    3,
    plan.originalQuarterlyPrice,
  );
  const annualPricing = computePriceBreakdown(
    plan.annualPrice,
    gstRef,
    12,
    plan.originalAnnualPrice,
  );

  const availableBillingCycles = [];
  if (monthlyPricing) availableBillingCycles.push("MONTHLY");
  if (quarterlyPricing) availableBillingCycles.push("QUARTERLY");
  if (annualPricing) availableBillingCycles.push("ANNUAL");

  const isSelfServePurchasable =
    plan.status === "ACTIVE" &&
    plan.planType !== "CUSTOM" &&
    plan.visibility !== "ADMIN_ONLY" &&
    (!offerExpired || isCurrentPlan);

  return {
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    description: plan.description,
    status: plan.status,
    planType: plan.planType,
    visibility: plan.visibility,
    sortOrder: plan.sortOrder,
    isPopular: plan.isPopular,
    badgeText: plan.badgeText,
    monthlyPrice: plan.monthlyPrice,
    quarterlyPrice: plan.quarterlyPrice,
    annualPrice: plan.annualPrice,
    originalMonthlyPrice: plan.originalMonthlyPrice,
    originalQuarterlyPrice: plan.originalQuarterlyPrice,
    originalAnnualPrice: plan.originalAnnualPrice,
    offerValidUntil: plan.offerValidUntil,
    offerExpired,
    hasTrial: plan.hasTrial,
    trialDays: plan.trialDays,
    availableBillingCycles,
    pricing: {
      MONTHLY: monthlyPricing,
      QUARTERLY: quarterlyPricing,
      ANNUAL: annualPricing,
    },
    features: mergedFeatures,
    entitlements: structured,
    isCurrentPlan,
    isCustomForTenant,
    isSelfServePurchasable,
    requiresOfflineActivation:
      plan.planType === "CUSTOM" || plan.visibility === "ADMIN_ONLY",
  };
}

/**
 * Formats an active PlanAddOn row for catalog display.
 */
function formatAddOnForCatalog(addOn, gstRef) {
  const cycleMonths =
    addOn.billingCycle === "ANNUAL"
      ? 12
      : addOn.billingCycle === "QUARTERLY"
        ? 3
        : 1;

  return {
    id: addOn.id,
    name: addOn.name,
    slug: addOn.slug,
    description: addOn.description,
    type: addOn.type,
    entitlementKey: addOn.entitlementKey,
    amountPerUnit: addOn.amountPerUnit,
    price: addOn.price,
    billingCycle: addOn.billingCycle,
    sortOrder: addOn.sortOrder,
    pricing: computePriceBreakdown(addOn.price, gstRef, cycleMonths, null),
  };
}

/**
 * Formats a TenantSubscription row into a clean summary object.
 */
export function formatCurrentSubscriptionSummary(sub) {
  if (!sub) return null;

  return {
    id: sub.id,
    tenantId: sub.tenantId,
    planId: sub.planId,
    currentPlan: sub.plan?.name || sub.currentPlan || null,
    planSlug: sub.plan?.slug || null,
    billingCycle: sub.billingCycle,
    subscriptionStatus: sub.subscriptionStatus,
    planActivatedAt: sub.planActivatedAt,
    planPeriodStart: sub.planPeriodStart,
    planPeriodEnd: sub.planPeriodEnd,
    autopayEnabled: sub.autopayEnabled,
    razorpaySubscriptionId: sub.razorpaySubscriptionId,
    pendingPlanId: sub.pendingPlanId,
    pendingBillingCycle: sub.pendingBillingCycle,
    pendingPlan: sub.pendingPlan
      ? {
          id: sub.pendingPlan.id,
          name: sub.pendingPlan.name,
          slug: sub.pendingPlan.slug,
        }
      : null,
    gracePeriodDays: sub.gracePeriodDays,
    gracePeriodEnd: sub.gracePeriodEnd,
    graceDebtDays: sub.graceDebtDays,
    freeUntilDate: sub.freeUntilDate,
    cancelRequestedAt: sub.cancelRequestedAt,
    cancellationReason: sub.cancellationReason,
    dataDeletionDate: sub.dataDeletionDate,
  };
}

/**
 * Public catalog: returns all ACTIVE, PUBLIC, non-expired REGULAR/PROMO plans
 * plus active add-ons and tax context.
 */
export async function listPublicPlansService() {
  const now = new Date();
  const [plans, addOns, gstRef] = await Promise.all([
    prisma.subscriptionPlan.findMany({
      where: {
        status: "ACTIVE",
        visibility: "PUBLIC",
        planType: { in: ["REGULAR", "PROMO"] },
        OR: [{ offerValidUntil: null }, { offerValidUntil: { gt: now } }],
      },
      orderBy: [{ sortOrder: "asc" }, { monthlyPrice: "asc" }],
    }),
    prisma.planAddOn.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
    }),
    calculateGST(100),
  ]);

  return {
    plans: plans.map((p) => formatPlanForCatalog(p, gstRef, { now })),
    addOns: addOns.map((a) => formatAddOnForCatalog(a, gstRef)),
    tax: {
      taxRate: gstRef.gstRegistered ? gstRef.taxRate : 0,
      taxLabel: gstRef.taxLabel,
      gstRegistered: gstRef.gstRegistered,
      currency: gstRef.currency,
    },
  };
}

/**
 * Public single-plan lookup by ID or slug.
 * Supports PUBLIC and HIDDEN_LINK_ONLY active non-expired plans (for promo links).
 */
export async function getPublicPlanByIdService(idOrSlug) {
  const now = new Date();
  const plan = await prisma.subscriptionPlan.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
  });

  if (
    !plan ||
    plan.status !== "ACTIVE" ||
    !["PUBLIC", "HIDDEN_LINK_ONLY"].includes(plan.visibility) ||
    !["REGULAR", "PROMO"].includes(plan.planType) ||
    isPlanOfferExpired(plan, now)
  ) {
    throw new HttpError(
      404,
      "Plan not found or promotional offer has expired.",
      "PLAN_NOT_FOUND",
    );
  }

  const gstRef = await calculateGST(100);

  return {
    plan: formatPlanForCatalog(plan, gstRef, { now }),
    tax: {
      taxRate: gstRef.gstRegistered ? gstRef.taxRate : 0,
      taxLabel: gstRef.taxLabel,
      gstRegistered: gstRef.gstRegistered,
      currency: gstRef.currency,
    },
  };
}

/**
 * Authenticated tenant catalog:
 * - Public active non-expired plans
 * - Tenant's current plan (even if HIDDEN_LINK_ONLY, CUSTOM, INACTIVE, or expired offer)
 * - Any ACTIVE CUSTOM plans specifically created for this tenant (customTenantId === tenantId)
 * - Active add-ons catalog
 * - Current subscription state & trial eligibility
 */
export async function listTenantPlansService(tenantId) {
  const now = new Date();

  const [
    tenant,
    publicPlans,
    customPlansForTenant,
    addOns,
    paidPaymentCount,
    gstRef,
  ] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        email: true,
        status: true,
        subscription: {
          include: {
            plan: true,
            pendingPlan: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
      },
    }),
    prisma.subscriptionPlan.findMany({
      where: {
        status: "ACTIVE",
        visibility: "PUBLIC",
        planType: { in: ["REGULAR", "PROMO"] },
        OR: [{ offerValidUntil: null }, { offerValidUntil: { gt: now } }],
      },
      orderBy: [{ sortOrder: "asc" }, { monthlyPrice: "asc" }],
    }),
    prisma.subscriptionPlan.findMany({
      where: {
        status: "ACTIVE",
        planType: "CUSTOM",
        customTenantId: tenantId,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    prisma.planAddOn.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
    }),
    prisma.payment.count({
      where: { tenantId, status: "SUCCESS" },
    }),
    calculateGST(100),
  ]);

  if (!tenant) {
    throw new HttpError(404, "Tenant not found.", "TENANT_NOT_FOUND");
  }

  const sub = tenant.subscription;
  const currentPlanId = sub?.planId || null;

  const normalizedEmail = (tenant.email || "").trim().toLowerCase();
  const trialRegistryEntry = normalizedEmail
    ? await prisma.trialEmailRegistry.findUnique({
        where: { email: normalizedEmail },
      })
    : null;

  const trialEligible = Boolean(
    !trialRegistryEntry &&
    !sub?.planActivatedAt &&
    paidPaymentCount === 0 &&
    (!sub || ["pending", "inactive"].includes(sub.subscriptionStatus)),
  );

  const seenPlanIds = new Set();
  const formattedPlans = [];

  for (const p of publicPlans) {
    seenPlanIds.add(p.id);
    formattedPlans.push(
      formatPlanForCatalog(p, gstRef, {
        isCurrentPlan: p.id === currentPlanId,
        isCustomForTenant: false,
        now,
      }),
    );
  }

  if (sub?.plan && !seenPlanIds.has(sub.plan.id)) {
    seenPlanIds.add(sub.plan.id);
    formattedPlans.unshift(
      formatPlanForCatalog(sub.plan, gstRef, {
        isCurrentPlan: true,
        isCustomForTenant: sub.plan.customTenantId === tenantId,
        now,
      }),
    );
  }

  for (const cp of customPlansForTenant) {
    if (!seenPlanIds.has(cp.id)) {
      seenPlanIds.add(cp.id);
      formattedPlans.push(
        formatPlanForCatalog(cp, gstRef, {
          isCurrentPlan: cp.id === currentPlanId,
          isCustomForTenant: true,
          now,
        }),
      );
    }
  }

  return {
    plans: formattedPlans,
    addOns: addOns.map((a) => formatAddOnForCatalog(a, gstRef)),
    trialEligible,
    currentSubscription: formatCurrentSubscriptionSummary(sub),
    tax: {
      taxRate: gstRef.gstRegistered ? gstRef.taxRate : 0,
      taxLabel: gstRef.taxLabel,
      gstRegistered: gstRef.gstRegistered,
      currency: gstRef.currency,
    },
  };
}

/**
 * Starts an instant, cardless free trial on a trial-enabled plan.
 */
export async function startTrialService(tenantId, { planId }, meta = {}) {
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "tenant_subscription" WHERE "tenantId" = ${tenantId} FOR UPDATE`,
    );

    const [tenant, plan, paidCount] = await Promise.all([
      tx.tenant.findUnique({
        where: { id: tenantId },
        include: { subscription: true },
      }),
      tx.subscriptionPlan.findUnique({
        where: { id: planId },
      }),
      tx.payment.count({
        where: { tenantId, status: "SUCCESS" },
      }),
    ]);

    if (!tenant) {
      throw new HttpError(404, "Tenant not found.", "TENANT_NOT_FOUND");
    }

    assertPlanPurchasable(plan, { isSamePlanRenewal: false, now });

    if (!plan.hasTrial || (plan.trialDays || 0) <= 0) {
      throw new HttpError(
        400,
        `The "${plan.name}" plan does not offer a free trial.`,
        "PLAN_NO_TRIAL",
      );
    }

    const sub = tenant.subscription;
    if (
      sub?.planActivatedAt ||
      paidCount > 0 ||
      (sub && !["pending", "inactive"].includes(sub.subscriptionStatus))
    ) {
      throw new HttpError(
        403,
        "Free trial is only available for new accounts that have not previously started a trial or subscription.",
        "TRIAL_NOT_ELIGIBLE",
      );
    }

    const normalizedEmail = (tenant.email || "").trim().toLowerCase();
    if (!normalizedEmail) {
      throw new HttpError(
        400,
        "A valid tenant email address is required to start a free trial.",
        "EMAIL_REQUIRED",
      );
    }

    const existingTrialEmail = await tx.trialEmailRegistry.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingTrialEmail) {
      throw new HttpError(
        403,
        "A free trial has already been claimed with this email address.",
        "TRIAL_ALREADY_USED",
      );
    }

    await tx.trialEmailRegistry.create({
      data: {
        email: normalizedEmail,
        usedAt: now,
      },
    });

    const trialDays = Number(plan.trialDays || 14);
    const periodStart = now;
    const periodEnd = addDays(now, trialDays);

    if (["PENDING", "ONBOARDING"].includes(tenant.status)) {
      await tx.tenant.update({
        where: { id: tenantId },
        data: { status: "APPROVED" },
      });
    }

    const updatedSub = await tx.tenantSubscription.upsert({
      where: { tenantId },
      update: {
        planId: plan.id,
        currentPlan: plan.name,
        billingCycle: "MONTHLY",
        subscriptionStatus: "trialing",
        planPeriodStart: periodStart,
        planPeriodEnd: periodEnd,
        autopayEnabled: false,
        razorpaySubscriptionId: null,
        pendingPlanId: null,
        pendingBillingCycle: null,
        gracePeriodEnd: null,
        graceDebtDays: 0,
        graceDebtPlanPrice: null,
        cancelRequestedAt: null,
        cancellationReason: null,
        dataDeletionDate: null,
      },
      create: {
        tenantId,
        planId: plan.id,
        currentPlan: plan.name,
        billingCycle: "MONTHLY",
        subscriptionStatus: "trialing",
        planPeriodStart: periodStart,
        planPeriodEnd: periodEnd,
        autopayEnabled: false,
      },
      include: {
        plan: true,
        pendingPlan: { select: { id: true, name: true, slug: true } },
      },
    });

    return { tenant, plan, updatedSub, trialDays, periodEnd };
  });

  await logTenantAudit({
    tenantId,
    actorType: "TENANT",
    actorId: meta.actorId || tenantId,
    actorName:
      meta.actorName || result.tenant.businessName || result.tenant.email,
    action: AuditAction.TRIAL_STARTED,
    module: AuditModule.BILLING,
    targetId: result.plan.id,
    targetRef: result.plan.name,
    ipAddress: meta.ipAddress || null,
    userAgent: meta.userAgent || null,
    details: {
      planId: result.plan.id,
      planName: result.plan.name,
      planSlug: result.plan.slug,
      trialDays: result.trialDays,
      trialEndsAt: result.periodEnd,
    },
  });

  await createSuperAdminNotification({
    type: "trial_started",
    title: "Free Trial Started",
    message: `${result.tenant.businessName || result.tenant.email} started a ${
      result.trialDays
    }-day free trial on the ${result.plan.name} plan.`,
    tenantId,
    metadata: {
      planId: result.plan.id,
      planName: result.plan.name,
      trialDays: result.trialDays,
      trialEndsAt: result.periodEnd,
    },
  });

  return {
    subscription: formatCurrentSubscriptionSummary(result.updatedSub),
    plan: {
      id: result.plan.id,
      name: result.plan.name,
      slug: result.plan.slug,
    },
    trialDays: result.trialDays,
    trialEndsAt: result.periodEnd,
  };
}

/**
 * Schedules a plan or billing-cycle change to take effect at the end of the
 * current paid billing period (no proration).
 */
export async function schedulePlanChangeService(
  tenantId,
  { planId, billingCycle },
  meta = {},
) {
  const now = new Date();

  const [tenant, targetPlan] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        subscription: {
          include: { plan: true },
        },
      },
    }),
    prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    }),
  ]);

  if (!tenant) {
    throw new HttpError(404, "Tenant not found.", "TENANT_NOT_FOUND");
  }

  const sub = tenant.subscription;
  if (
    !sub ||
    !["active", "cancel_at_period_end"].includes(sub.subscriptionStatus) ||
    !sub.planPeriodEnd ||
    new Date(sub.planPeriodEnd).getTime() <= now.getTime()
  ) {
    throw new HttpError(
      409,
      "Scheduled plan changes are only available for active paid subscriptions with an ongoing billing period.",
      "SUBSCRIPTION_NOT_ACTIVE",
    );
  }

  assertPlanPurchasable(targetPlan, { isSamePlanRenewal: false, now });
  getPlanPriceForCycle(targetPlan, billingCycle);

  if (sub.planId === targetPlan.id && sub.billingCycle === billingCycle) {
    throw new HttpError(
      409,
      "You are already on this plan and billing cycle.",
      "ALREADY_ON_PLAN_CYCLE",
    );
  }

  const updatedSub = await prisma.tenantSubscription.update({
    where: { tenantId },
    data: {
      pendingPlanId: targetPlan.id,
      pendingBillingCycle: billingCycle,
    },
    include: {
      plan: true,
      pendingPlan: { select: { id: true, name: true, slug: true } },
    },
  });

  await logTenantAudit({
    tenantId,
    actorType: "TENANT",
    actorId: meta.actorId || tenantId,
    actorName: meta.actorName || tenant.businessName || tenant.email,
    action: AuditAction.PLAN_CHANGE_SCHEDULED,
    module: AuditModule.BILLING,
    targetId: targetPlan.id,
    targetRef: targetPlan.name,
    ipAddress: meta.ipAddress || null,
    userAgent: meta.userAgent || null,
    details: {
      fromPlanId: sub.planId,
      fromPlanName: sub.plan?.name || sub.currentPlan,
      fromBillingCycle: sub.billingCycle,
      toPlanId: targetPlan.id,
      toPlanName: targetPlan.name,
      toBillingCycle: billingCycle,
      effectiveAt: sub.planPeriodEnd,
    },
  });

  return {
    subscription: formatCurrentSubscriptionSummary(updatedSub),
    effectiveAt: sub.planPeriodEnd,
  };
}

/**
 * Cancels a previously scheduled period-end plan change.
 */
export async function clearScheduledPlanChangeService(tenantId, meta = {}) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscription: {
        include: {
          plan: true,
          pendingPlan: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });

  if (!tenant) {
    throw new HttpError(404, "Tenant not found.", "TENANT_NOT_FOUND");
  }

  const sub = tenant.subscription;
  if (!sub?.pendingPlanId) {
    throw new HttpError(
      409,
      "There is no scheduled plan change to cancel.",
      "NO_PENDING_PLAN_CHANGE",
    );
  }

  const previousPending = {
    pendingPlanId: sub.pendingPlanId,
    pendingPlanName: sub.pendingPlan?.name || null,
    pendingBillingCycle: sub.pendingBillingCycle,
  };

  const updatedSub = await prisma.tenantSubscription.update({
    where: { tenantId },
    data: {
      pendingPlanId: null,
      pendingBillingCycle: null,
    },
    include: {
      plan: true,
      pendingPlan: { select: { id: true, name: true, slug: true } },
    },
  });

  await logTenantAudit({
    tenantId,
    actorType: "TENANT",
    actorId: meta.actorId || tenantId,
    actorName: meta.actorName || tenant.businessName || tenant.email,
    action: AuditAction.PLAN_CHANGE_CANCELLED,
    module: AuditModule.BILLING,
    targetId: previousPending.pendingPlanId,
    targetRef: previousPending.pendingPlanName,
    ipAddress: meta.ipAddress || null,
    userAgent: meta.userAgent || null,
    details: previousPending,
  });

  return {
    subscription: formatCurrentSubscriptionSummary(updatedSub),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 4B — ONE-TIME ORDER CHECKOUT, AUTOPAY SUBSCRIPTION & SHARED FULFILLMENT
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Consolidates bundled add-on items by addOnId so duplicate entries are summed.
 */
function consolidateBundledAddOns(addOns = []) {
  const map = new Map();
  for (const item of addOns) {
    if (!item?.addOnId) continue;
    const prev = map.get(item.addOnId) || 0;
    const nextQty = Math.min(
      100,
      prev + Math.max(1, Number(item.quantity || 1)),
    );
    map.set(item.addOnId, nextQty);
  }
  return Array.from(map.entries()).map(([addOnId, quantity]) => ({
    addOnId,
    quantity,
  }));
}

/**
 * Best-effort helper to generate PDF and send invoice email outside the DB transaction.
 */
async function generateAndEmailInvoiceBestEffort(invoice, tenant, gstSettings) {
  try {
    const { filePath, fileUrl, url } = await generateInvoicePDF(
      invoice,
      tenant,
      gstSettings,
    );

    if (tenant?.email) {
      await sendInvoiceEmail(tenant.email, {
        businessName: tenant.businessName,
        invoiceNumber: invoice.invoiceNumber,
        planName: invoice.planName || "SudoReply Subscription",
        billingType: invoice.billingCycle,
        baseAmount: invoice.baseAmount,
        taxRate: invoice.taxRate,
        taxAmount: invoice.taxAmount,
        gstPercent: invoice.taxRate,
        gstAmount: invoice.taxAmount,
        gstType: gstSettings?.gstType || null,
        gstNumber: gstSettings?.gstNumber || null,
        sacCode: gstSettings?.sacCode || null,
        totalAmount: invoice.amount,
        paidAt: invoice.paidAt || invoice.createdAt,
        periodStart: invoice.billingPeriodStart,
        periodEnd: invoice.billingPeriodEnd,
        invoiceUrl: fileUrl || url || invoice.invoiceUrl,
        pdfPath: filePath,
      });
    }
  } catch (err) {
    logger.error("Non-fatal invoice PDF/email error", {
      invoiceId: invoice?.id,
      invoiceNumber: invoice?.invoiceNumber,
      tenantId: tenant?.id,
      error: err?.message,
    });
  }
}

/**
 * POST /tenant/plans/create-order
 * Creates a Razorpay one-time Order for a SubscriptionPlan (and optional bundled Add-Ons / Top-Ups).
 */
export async function createPlanOrderService(
  tenantId,
  { planId, billingCycle, addOns = [] },
) {
  const now = new Date();

  const [tenant, plan] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription: true },
    }),
    prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    }),
  ]);

  if (!tenant) {
    throw new HttpError(404, "Tenant not found.", "TENANT_NOT_FOUND");
  }

  const isSamePlanRenewal = tenant.subscription?.planId === plan?.id;
  assertPlanPurchasable(plan, { isSamePlanRenewal, now });

  const planBaseAmount = getPlanPriceForCycle(plan, billingCycle);
  if (planBaseAmount <= 0) {
    throw new HttpError(
      400,
      "Cannot create a payment order for a zero-price plan cycle.",
      "INVALID_PLAN_PRICE",
    );
  }

  const planGst = await calculateGST(planBaseAmount);

  const consolidatedAddOns = consolidateBundledAddOns(addOns);
  const bundledLineItems = [];

  if (consolidatedAddOns.length > 0) {
    const addOnIds = consolidatedAddOns.map((a) => a.addOnId);
    const dbAddOns = await prisma.planAddOn.findMany({
      where: { id: { in: addOnIds } },
    });
    const addOnById = new Map(dbAddOns.map((a) => [a.id, a]));

    for (const item of consolidatedAddOns) {
      const addOn = addOnById.get(item.addOnId);
      if (!addOn || !addOn.isActive) {
        throw new HttpError(
          400,
          `Add-on "${item.addOnId}" is not found or no longer active.`,
          "ADDON_NOT_AVAILABLE",
        );
      }

      const unitPrice = Number(addOn.price || 0);
      if (unitPrice <= 0) {
        throw new HttpError(
          400,
          `Add-on "${addOn.name}" has an invalid price.`,
          "INVALID_ADDON_PRICE",
        );
      }

      const lineBaseAmount = Math.round(unitPrice * item.quantity * 100) / 100;
      const lineGst = await calculateGST(lineBaseAmount);

      bundledLineItems.push({
        addOn,
        quantity: item.quantity,
        purchaseType: addOn.type === "ONE_TIME_TOPUP" ? "TOPUP" : "ADDON",
        billingCycle:
          addOn.type === "ONE_TIME_TOPUP" ? "ONE_TIME" : addOn.billingCycle,
        gst: lineGst,
      });
    }
  }

  const combinedBaseAmount =
    Math.round(
      (planGst.baseAmount +
        bundledLineItems.reduce((sum, li) => sum + li.gst.baseAmount, 0)) *
        100,
    ) / 100;
  const combinedTaxAmount =
    Math.round(
      (planGst.taxAmount +
        bundledLineItems.reduce((sum, li) => sum + li.gst.taxAmount, 0)) *
        100,
    ) / 100;
  const combinedTotalAmount =
    Math.round(
      (planGst.totalAmount +
        bundledLineItems.reduce((sum, li) => sum + li.gst.totalAmount, 0)) *
        100,
    ) / 100;

  const amountInPaise = Math.round(combinedTotalAmount * 100);

  const order = await razorpay.orders.create({
    amount: amountInPaise,
    currency: "INR",
    receipt: `pln_${tenantId.slice(0, 8)}_${Date.now()}`,
    notes: {
      kind: "PLAN_ORDER",
      tenantId,
      planId: plan.id,
      planName: plan.name,
      billingCycle,
      bundledAddOnCount: String(bundledLineItems.length),
      baseAmount: String(combinedBaseAmount),
      taxRate: String(planGst.taxRate),
      taxAmount: String(combinedTaxAmount),
      totalAmount: String(combinedTotalAmount),
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        tenantId,
        planId: plan.id,
        purchaseType: "PLAN",
        razorpayOrderId: order.id,
        baseAmount: planGst.baseAmount,
        taxRate: planGst.taxRate,
        taxAmount: planGst.taxAmount,
        amount: planGst.totalAmount,
        currency: "INR",
        status: "PENDING",
        billingCycle,
        metadata: {
          planName: plan.name,
          planSlug: plan.slug,
          billingCycle,
          bundledAddOnCount: bundledLineItems.length,
        },
      },
    });

    for (const li of bundledLineItems) {
      await tx.payment.create({
        data: {
          tenantId,
          addOnId: li.addOn.id,
          purchaseType: li.purchaseType,
          razorpayOrderId: order.id,
          baseAmount: li.gst.baseAmount,
          taxRate: li.gst.taxRate,
          taxAmount: li.gst.taxAmount,
          amount: li.gst.totalAmount,
          currency: "INR",
          status: "PENDING",
          billingCycle: li.billingCycle,
          metadata: {
            bundledWithPlanId: plan.id,
            addOnName: li.addOn.name,
            addOnSlug: li.addOn.slug,
            entitlementKey: li.addOn.entitlementKey,
            amountPerUnit: li.addOn.amountPerUnit,
            quantity: li.quantity,
          },
        },
      });
    }
  });

  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    key: process.env.RAZORPAY_KEY_ID,
    planId: plan.id,
    planName: plan.name,
    billingCycle,
    planBreakdown: {
      baseAmount: planGst.baseAmount,
      taxRate: planGst.taxRate,
      taxAmount: planGst.taxAmount,
      totalAmount: planGst.totalAmount,
    },
    bundledAddOns: bundledLineItems.map((li) => ({
      addOnId: li.addOn.id,
      name: li.addOn.name,
      type: li.addOn.type,
      quantity: li.quantity,
      baseAmount: li.gst.baseAmount,
      taxAmount: li.gst.taxAmount,
      totalAmount: li.gst.totalAmount,
    })),
    baseAmount: combinedBaseAmount,
    taxRate: planGst.taxRate,
    taxAmount: combinedTaxAmount,
    totalAmount: combinedTotalAmount,
    taxLabel: planGst.taxLabel,
    gstRegistered: planGst.gstRegistered,
    prefill: {
      name: tenant.businessName,
      email: tenant.email,
      contact: tenant.phone || "",
    },
  };
}

/**
 * Shared idempotent order-fulfillment engine for a PLAN order (and any bundled add-on/top-up rows).
 * Used by both POST /tenant/plans/verify-order and the Razorpay order.paid / payment.captured webhook.
 */
export async function fulfillPlanOrderByOrderId({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature = null,
  paymentMethod = null,
  expectedTenantId = null,
  address = null,
  phone = null,
  meta = {},
}) {
  const existingPayments = await prisma.payment.findMany({
    where: { razorpayOrderId },
    orderBy: { createdAt: "asc" },
  });

  const planPaymentPreview = existingPayments.find(
    (p) => p.purchaseType === "PLAN",
  );

  if (!planPaymentPreview) {
    return { handled: false };
  }

  if (expectedTenantId && planPaymentPreview.tenantId !== expectedTenantId) {
    throw new HttpError(
      403,
      "This payment order does not belong to your account.",
      "ORDER_TENANT_MISMATCH",
    );
  }

  let resolvedPaymentMethod = paymentMethod;
  if (!resolvedPaymentMethod && razorpayPaymentId) {
    try {
      const rzpPayment = await razorpay.payments.fetch(razorpayPaymentId);
      resolvedPaymentMethod = rzpPayment?.method || null;
    } catch (err) {
      logger.warn("Could not fetch payment method from Razorpay", {
        razorpayPaymentId,
        error: err?.message,
      });
    }
  }

  const now = new Date();
  const tenantId = planPaymentPreview.tenantId;

  const txResult = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "tenant_subscription" WHERE "tenantId" = ${tenantId} FOR UPDATE`,
    );
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "payments" WHERE "id" = ${planPaymentPreview.id} FOR UPDATE`,
    );

    const payments = await tx.payment.findMany({
      where: { razorpayOrderId },
      orderBy: { createdAt: "asc" },
    });

    const planPayment = payments.find((p) => p.purchaseType === "PLAN");
    const bundledPayments = payments.filter((p) => p.purchaseType !== "PLAN");

    if (planPayment.status === "SUCCESS") {
      const [currentSub, existingInvoice] = await Promise.all([
        tx.tenantSubscription.findUnique({
          where: { tenantId },
          include: {
            plan: true,
            pendingPlan: { select: { id: true, name: true, slug: true } },
          },
        }),
        tx.invoice.findFirst({
          where: { paymentId: planPayment.id },
        }),
      ]);

      return {
        alreadyProcessed: true,
        updatedSub: currentSub,
        planInvoice: existingInvoice,
        bundledInvoices: [],
      };
    }

    const [tenant, plan] = await Promise.all([
      tx.tenant.findUnique({
        where: { id: tenantId },
        include: {
          subscription: {
            include: { plan: true },
          },
        },
      }),
      tx.subscriptionPlan.findUnique({
        where: { id: planPayment.planId },
      }),
    ]);

    if (!tenant) {
      throw new HttpError(404, "Tenant not found.", "TENANT_NOT_FOUND");
    }
    if (!plan) {
      throw new HttpError(404, "Plan not found.", "PLAN_NOT_FOUND");
    }

    const sub = tenant.subscription;
    const previousPlanId = sub?.planId || null;
    const previousPlanName = sub?.plan?.name || sub?.currentPlan || null;
    const oldRazorpaySubscriptionId = sub?.razorpaySubscriptionId || null;

    const billingCycle = planPayment.billingCycle || "MONTHLY";
    const activation = computeActivationPeriod({
      sub,
      newPlan: plan,
      billingCycle,
      now,
    });

    const tenantUpdateData = {};
    if (address) tenantUpdateData.address = address.trim();
    if (phone) tenantUpdateData.phone = phone.trim();
    if (["PENDING", "ONBOARDING"].includes(tenant.status)) {
      tenantUpdateData.status = "APPROVED";
    }

    const updatedTenant =
      Object.keys(tenantUpdateData).length > 0
        ? await tx.tenant.update({
            where: { id: tenantId },
            data: tenantUpdateData,
          })
        : tenant;

    const updatedSub = await tx.tenantSubscription.upsert({
      where: { tenantId },
      update: {
        planId: plan.id,
        currentPlan: plan.name,
        billingCycle,
        subscriptionStatus: "active",
        planActivatedAt: sub?.planActivatedAt || now,
        planPeriodStart: activation.periodStart,
        planPeriodEnd: activation.periodEnd,
        autopayEnabled: false,
        razorpaySubscriptionId: null,
        pendingPlanId: null,
        pendingBillingCycle: null,
        gracePeriodEnd: null,
        graceDebtDays: 0,
        graceDebtPlanPrice: null,
        cancelRequestedAt: null,
        cancellationReason: null,
        dataDeletionDate: null,
      },
      create: {
        tenantId,
        planId: plan.id,
        currentPlan: plan.name,
        billingCycle,
        subscriptionStatus: "active",
        planActivatedAt: now,
        planPeriodStart: activation.periodStart,
        planPeriodEnd: activation.periodEnd,
        autopayEnabled: false,
      },
      include: {
        plan: true,
        pendingPlan: { select: { id: true, name: true, slug: true } },
      },
    });

    await tx.cancellationSurvey.deleteMany({ where: { tenantId } });

    const planInvoiceNumber = await generateInvoiceNumber(tx);
    const planInvoiceUrl = `/invoices/${planInvoiceNumber}.pdf`;

    await tx.payment.update({
      where: { id: planPayment.id },
      data: {
        razorpayPaymentId,
        razorpaySignature,
        status: "SUCCESS",
        paymentMethod: resolvedPaymentMethod,
        invoiceNumber: planInvoiceNumber,
        invoiceUrl: planInvoiceUrl,
      },
    });

    const planInvoice = await tx.invoice.create({
      data: {
        tenantId,
        invoiceNumber: planInvoiceNumber,
        paymentId: planPayment.id,
        planSlug: plan.slug,
        planName: plan.name,
        billingCycle,
        purchaseType: "PLAN",
        baseAmount: planPayment.baseAmount,
        taxRate: planPayment.taxRate,
        taxAmount: planPayment.taxAmount,
        amount: planPayment.amount,
        currency: planPayment.currency || "INR",
        status: "paid",
        paidAt: now,
        billingPeriodStart: activation.periodStart,
        billingPeriodEnd: activation.periodEnd,
        invoiceUrl: planInvoiceUrl,
      },
    });

    const bundledInvoices = [];
    const fulfilledAddOns = [];

    for (const bp of bundledPayments) {
      if (bp.status === "SUCCESS") continue;

      const addOn = bp.addOnId
        ? await tx.planAddOn.findUnique({ where: { id: bp.addOnId } })
        : null;

      const quantity = Math.max(1, Number(bp.metadata?.quantity || 1));
      const bundledInvNumber = await generateInvoiceNumber(tx);
      const bundledInvUrl = `/invoices/${bundledInvNumber}.pdf`;
      const bundledRzpPaymentId = `${razorpayPaymentId}:BUNDLED:${bp.id}`;

      await tx.payment.update({
        where: { id: bp.id },
        data: {
          razorpayPaymentId: bundledRzpPaymentId,
          razorpaySignature,
          status: "SUCCESS",
          paymentMethod: resolvedPaymentMethod,
          invoiceNumber: bundledInvNumber,
          invoiceUrl: bundledInvUrl,
        },
      });

      if (bp.purchaseType === "TOPUP" || addOn?.type === "ONE_TIME_TOPUP") {
        const entitlementKey =
          addOn?.entitlementKey || bp.metadata?.entitlementKey;
        const amountPerUnit = Number(
          addOn?.amountPerUnit ?? bp.metadata?.amountPerUnit ?? 0,
        );
        const totalCredits = amountPerUnit * quantity;

        if (entitlementKey && totalCredits > 0) {
          await grantCredits(tenantId, entitlementKey, totalCredits, tx);
        }

        const topupInvoice = await tx.invoice.create({
          data: {
            tenantId,
            invoiceNumber: bundledInvNumber,
            paymentId: bp.id,
            planSlug: addOn?.slug || bp.metadata?.addOnSlug || "topup",
            planName: addOn?.name || bp.metadata?.addOnName || "Credit Top-Up",
            billingCycle: "ONE_TIME",
            purchaseType: "TOPUP",
            baseAmount: bp.baseAmount,
            taxRate: bp.taxRate,
            taxAmount: bp.taxAmount,
            amount: bp.amount,
            currency: bp.currency || "INR",
            status: "paid",
            paidAt: now,
            billingPeriodStart: now,
            billingPeriodEnd: null,
            invoiceUrl: bundledInvUrl,
          },
        });

        bundledInvoices.push(topupInvoice);
        fulfilledAddOns.push({
          purchaseType: "TOPUP",
          addOnId: addOn?.id || bp.addOnId,
          addOnName: addOn?.name || bp.metadata?.addOnName,
          entitlementKey,
          quantity,
          totalCredits,
          amount: bp.amount,
          invoiceNumber: bundledInvNumber,
        });
      } else {
        const addOnCycle =
          addOn?.billingCycle || bp.billingCycle || billingCycle;
        const addOnExpiresAt =
          addOnCycle === billingCycle
            ? activation.periodEnd
            : addCycleDuration(now, addOnCycle);

        await tx.tenantAddOn.create({
          data: {
            tenantId,
            addOnId: addOn?.id || bp.addOnId,
            quantity,
            status: "active",
            source: "PURCHASE",
            startsAt: now,
            expiresAt: addOnExpiresAt,
          },
        });

        const addOnInvoice = await tx.invoice.create({
          data: {
            tenantId,
            invoiceNumber: bundledInvNumber,
            paymentId: bp.id,
            planSlug: addOn?.slug || bp.metadata?.addOnSlug || "addon",
            planName: addOn?.name || bp.metadata?.addOnName || "Plan Add-On",
            billingCycle: addOnCycle,
            purchaseType: "ADDON",
            baseAmount: bp.baseAmount,
            taxRate: bp.taxRate,
            taxAmount: bp.taxAmount,
            amount: bp.amount,
            currency: bp.currency || "INR",
            status: "paid",
            paidAt: now,
            billingPeriodStart: now,
            billingPeriodEnd: addOnExpiresAt,
            invoiceUrl: bundledInvUrl,
          },
        });

        bundledInvoices.push(addOnInvoice);
        fulfilledAddOns.push({
          purchaseType: "ADDON",
          addOnId: addOn?.id || bp.addOnId,
          addOnName: addOn?.name || bp.metadata?.addOnName,
          entitlementKey: addOn?.entitlementKey || bp.metadata?.entitlementKey,
          quantity,
          expiresAt: addOnExpiresAt,
          amount: bp.amount,
          invoiceNumber: bundledInvNumber,
        });
      }
    }

    return {
      alreadyProcessed: false,
      updatedTenant,
      updatedSub,
      plan,
      billingCycle,
      activation,
      previousPlanId,
      previousPlanName,
      oldRazorpaySubscriptionId,
      planPayment,
      planInvoice,
      bundledInvoices,
      fulfilledAddOns,
    };
  });

  if (txResult.alreadyProcessed) {
    return {
      handled: true,
      alreadyProcessed: true,
      subscription: formatCurrentSubscriptionSummary(txResult.updatedSub),
      invoice: txResult.planInvoice,
    };
  }

  if (txResult.oldRazorpaySubscriptionId) {
    await cancelRazorpaySubscriptionBestEffort(
      txResult.oldRazorpaySubscriptionId,
      { atCycleEnd: false },
    );
  }

  const gstSettings = await getGSTSettings();
  await generateAndEmailInvoiceBestEffort(
    txResult.planInvoice,
    txResult.updatedTenant,
    gstSettings,
  );
  for (const bInv of txResult.bundledInvoices) {
    await generateAndEmailInvoiceBestEffort(
      bInv,
      txResult.updatedTenant,
      gstSettings,
    );
  }

  const actorName =
    meta.actorName ||
    txResult.updatedTenant.businessName ||
    txResult.updatedTenant.email;

  await logTenantAudit({
    tenantId,
    actorType: meta.actorType || "TENANT",
    actorId: meta.actorId || tenantId,
    actorName,
    action: AuditAction.PAYMENT_SUCCESS,
    module: AuditModule.BILLING,
    targetId: txResult.planPayment.id,
    targetRef: txResult.planInvoice.invoiceNumber,
    ipAddress: meta.ipAddress || null,
    userAgent: meta.userAgent || null,
    details: {
      planId: txResult.plan.id,
      planName: txResult.plan.name,
      billingCycle: txResult.billingCycle,
      amount: txResult.planPayment.amount,
      invoiceNumber: txResult.planInvoice.invoiceNumber,
      razorpayOrderId,
      razorpayPaymentId,
      paymentMethod: resolvedPaymentMethod,
      bundledItemsCount: txResult.fulfilledAddOns.length,
    },
  });

  const isPlanSwitch = Boolean(
    txResult.previousPlanId && txResult.previousPlanId !== txResult.plan.id,
  );

  await logTenantAudit({
    tenantId,
    actorType: meta.actorType || "TENANT",
    actorId: meta.actorId || tenantId,
    actorName,
    action: isPlanSwitch
      ? AuditAction.PLAN_CHANGED
      : AuditAction.PLAN_ACTIVATED,
    module: AuditModule.BILLING,
    targetId: txResult.plan.id,
    targetRef: txResult.plan.name,
    ipAddress: meta.ipAddress || null,
    userAgent: meta.userAgent || null,
    details: {
      previousPlanId: txResult.previousPlanId,
      previousPlanName: txResult.previousPlanName,
      newPlanId: txResult.plan.id,
      newPlanName: txResult.plan.name,
      billingCycle: txResult.billingCycle,
      periodStart: txResult.activation.periodStart,
      periodEnd: txResult.activation.periodEnd,
      wasExtended: txResult.activation.wasExtended,
      debtDaysDeducted: txResult.activation.debtDaysDeducted,
      debtForgiven: txResult.activation.debtForgiven,
    },
  });

  for (const item of txResult.fulfilledAddOns) {
    await logTenantAudit({
      tenantId,
      actorType: meta.actorType || "TENANT",
      actorId: meta.actorId || tenantId,
      actorName,
      action:
        item.purchaseType === "TOPUP"
          ? AuditAction.TOPUP_PURCHASED
          : AuditAction.ADDON_PURCHASED,
      module: AuditModule.BILLING,
      targetId: item.addOnId,
      targetRef: item.addOnName,
      ipAddress: meta.ipAddress || null,
      userAgent: meta.userAgent || null,
      details: item,
    });
  }

  await createSuperAdminNotification({
    type: "payment_received",
    title: txResult.activation.wasExtended
      ? "Plan Extended"
      : isPlanSwitch
        ? "Plan Switched"
        : "New Plan Activated",
    message: `${
      txResult.updatedTenant.businessName || txResult.updatedTenant.email
    } paid ₹${txResult.planInvoice.amount} for the ${txResult.plan.name} (${
      txResult.billingCycle
    }) plan.`,
    tenantId,
    metadata: {
      planId: txResult.plan.id,
      planName: txResult.plan.name,
      billingCycle: txResult.billingCycle,
      amount: txResult.planInvoice.amount,
      invoiceNumber: txResult.planInvoice.invoiceNumber,
      bundledAddOns: txResult.fulfilledAddOns,
    },
  });

  return {
    handled: true,
    alreadyProcessed: false,
    subscription: formatCurrentSubscriptionSummary(txResult.updatedSub),
    invoice: txResult.planInvoice,
    bundledInvoices: txResult.bundledInvoices,
    wasExtended: txResult.activation.wasExtended,
    debtDaysDeducted: txResult.activation.debtDaysDeducted,
    debtForgiven: txResult.activation.debtForgiven,
  };
}

/**
 * POST /tenant/plans/verify-order
 * Verifies the Razorpay Order signature and activates/extends the tenant's plan.
 */
export async function verifyPlanOrderService(
  tenantId,
  {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    address,
    phone,
  },
  meta = {},
) {
  const isValid = verifyRazorpayHmac(
    `${razorpay_order_id}|${razorpay_payment_id}`,
    razorpay_signature,
  );

  if (!isValid) {
    await prisma.payment.updateMany({
      where: {
        razorpayOrderId: razorpay_order_id,
        tenantId,
        status: "PENDING",
      },
      data: { status: "FAILED" },
    });

    await logTenantAudit({
      tenantId,
      actorType: "TENANT",
      actorId: meta.actorId || tenantId,
      actorName: meta.actorName || null,
      action: AuditAction.PAYMENT_FAILED,
      module: AuditModule.BILLING,
      targetRef: razorpay_order_id,
      ipAddress: meta.ipAddress || null,
      userAgent: meta.userAgent || null,
      details: {
        reason: "Signature verification failed",
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
      },
    });

    throw new HttpError(
      400,
      "Payment verification failed — invalid signature.",
      "INVALID_PAYMENT_SIGNATURE",
    );
  }

  const fulfilled = await fulfillPlanOrderByOrderId({
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature,
    expectedTenantId: tenantId,
    address,
    phone,
    meta,
  });

  if (!fulfilled.handled) {
    throw new HttpError(
      404,
      "Matching plan payment order was not found.",
      "ORDER_NOT_FOUND",
    );
  }

  return fulfilled;
}

/**
 * POST /tenant/plans/create-subscription
 * Creates a Razorpay recurring Subscription for a SubscriptionPlan (MONTHLY, QUARTERLY, ANNUAL).
 */
export async function createPlanSubscriptionService(
  tenantId,
  { planId, billingCycle },
) {
  const now = new Date();

  const [tenant, plan] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription: true },
    }),
    prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    }),
  ]);

  if (!tenant) {
    throw new HttpError(404, "Tenant not found.", "TENANT_NOT_FOUND");
  }

  const isSamePlanRenewal = tenant.subscription?.planId === plan?.id;
  assertPlanPurchasable(plan, { isSamePlanRenewal, now });

  const baseAmount = getPlanPriceForCycle(plan, billingCycle);
  if (baseAmount <= 0) {
    throw new HttpError(
      400,
      "Recurring autopay cannot be created for a zero-price plan cycle.",
      "INVALID_PLAN_PRICE",
    );
  }

  const gst = await calculateGST(baseAmount);
  let rzpPlanId = await getOrCreateRazorpayPlanForSubscriptionPlan(
    plan,
    billingCycle,
    false,
  );

  const totalCount =
    billingCycle === "ANNUAL" ? 5 : billingCycle === "QUARTERLY" ? 20 : 60;

  const subPayload = {
    plan_id: rzpPlanId,
    total_count: totalCount,
    quantity: 1,
    customer_notify: 1,
    notes: {
      kind: "PLAN",
      tenantId,
      planId: plan.id,
      planName: plan.name,
      billingCycle,
      baseAmount: String(gst.baseAmount),
      taxRate: String(gst.taxRate),
      taxAmount: String(gst.taxAmount),
      totalAmount: String(gst.totalAmount),
    },
  };

  let rzpSubscription;
  try {
    rzpSubscription = await razorpay.subscriptions.create(subPayload);
  } catch (err) {
    if (err?.statusCode === 400 && err?.error?.code === "BAD_REQUEST_ERROR") {
      logger.warn(
        "Stale Razorpay plan ID detected — recreating plan and retrying subscription create",
        {
          planId: plan.id,
          billingCycle,
          staleRzpPlanId: rzpPlanId,
        },
      );
      rzpPlanId = await getOrCreateRazorpayPlanForSubscriptionPlan(
        plan,
        billingCycle,
        true,
      );
      subPayload.plan_id = rzpPlanId;
      rzpSubscription = await razorpay.subscriptions.create(subPayload);
    } else {
      throw err;
    }
  }

  return {
    subscriptionId: rzpSubscription.id,
    key: process.env.RAZORPAY_KEY_ID,
    planId: plan.id,
    planName: plan.name,
    billingCycle,
    baseAmount: gst.baseAmount,
    taxRate: gst.taxRate,
    taxAmount: gst.taxAmount,
    totalAmount: gst.totalAmount,
    taxLabel: gst.taxLabel,
    gstRegistered: gst.gstRegistered,
    currency: "INR",
    prefill: {
      name: tenant.businessName,
      email: tenant.email,
      contact: tenant.phone || "",
    },
  };
}

/**
 * POST /tenant/plans/verify-subscription
 * Verifies a Razorpay recurring Subscription checkout signature and activates autopay.
 */
export async function verifyPlanSubscriptionService(
  tenantId,
  {
    razorpay_payment_id,
    razorpay_subscription_id,
    razorpay_signature,
    planId,
    billingCycle,
    address,
    phone,
  },
  meta = {},
) {
  const isValid = verifyRazorpayHmac(
    `${razorpay_payment_id}|${razorpay_subscription_id}`,
    razorpay_signature,
  );

  if (!isValid) {
    await logTenantAudit({
      tenantId,
      actorType: "TENANT",
      actorId: meta.actorId || tenantId,
      actorName: meta.actorName || null,
      action: AuditAction.PAYMENT_FAILED,
      module: AuditModule.BILLING,
      targetRef: razorpay_subscription_id,
      ipAddress: meta.ipAddress || null,
      userAgent: meta.userAgent || null,
      details: {
        reason: "Subscription signature verification failed",
        razorpaySubscriptionId: razorpay_subscription_id,
        razorpayPaymentId: razorpay_payment_id,
      },
    });

    throw new HttpError(
      400,
      "Subscription verification failed — invalid signature.",
      "INVALID_PAYMENT_SIGNATURE",
    );
  }

  let paymentMethod = "autopay";
  try {
    const rzpPayment = await razorpay.payments.fetch(razorpay_payment_id);
    paymentMethod = rzpPayment?.method || "autopay";
  } catch (err) {
    logger.warn("Could not fetch subscription payment method from Razorpay", {
      razorpayPaymentId: razorpay_payment_id,
      error: err?.message,
    });
  }

  const now = new Date();

  const txResult = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "tenant_subscription" WHERE "tenantId" = ${tenantId} FOR UPDATE`,
    );

    const existingPayment = await tx.payment.findUnique({
      where: { razorpayPaymentId: razorpay_payment_id },
    });

    if (existingPayment && existingPayment.status === "SUCCESS") {
      const [currentSub, existingInvoice] = await Promise.all([
        tx.tenantSubscription.findUnique({
          where: { tenantId },
          include: {
            plan: true,
            pendingPlan: { select: { id: true, name: true, slug: true } },
          },
        }),
        tx.invoice.findFirst({
          where: { paymentId: existingPayment.id },
        }),
      ]);

      return {
        alreadyProcessed: true,
        updatedSub: currentSub,
        invoice: existingInvoice,
      };
    }

    const [tenant, plan] = await Promise.all([
      tx.tenant.findUnique({
        where: { id: tenantId },
        include: {
          subscription: {
            include: { plan: true },
          },
        },
      }),
      tx.subscriptionPlan.findUnique({
        where: { id: planId },
      }),
    ]);

    if (!tenant) {
      throw new HttpError(404, "Tenant not found.", "TENANT_NOT_FOUND");
    }

    const sub = tenant.subscription;
    const isSamePlanRenewal = sub?.planId === plan?.id;
    assertPlanPurchasable(plan, { isSamePlanRenewal, now });

    const baseAmount = getPlanPriceForCycle(plan, billingCycle);
    const gst = await calculateGST(baseAmount);

    const previousPlanId = sub?.planId || null;
    const previousPlanName = sub?.plan?.name || sub?.currentPlan || null;
    const oldRazorpaySubscriptionId =
      sub?.razorpaySubscriptionId &&
      sub.razorpaySubscriptionId !== razorpay_subscription_id
        ? sub.razorpaySubscriptionId
        : null;

    const activation = computeActivationPeriod({
      sub,
      newPlan: plan,
      billingCycle,
      now,
    });

    const tenantUpdateData = {};
    if (address) tenantUpdateData.address = address.trim();
    if (phone) tenantUpdateData.phone = phone.trim();
    if (["PENDING", "ONBOARDING"].includes(tenant.status)) {
      tenantUpdateData.status = "APPROVED";
    }

    const updatedTenant =
      Object.keys(tenantUpdateData).length > 0
        ? await tx.tenant.update({
            where: { id: tenantId },
            data: tenantUpdateData,
          })
        : tenant;

    const invoiceNumber = await generateInvoiceNumber(tx);
    const invoiceUrl = `/invoices/${invoiceNumber}.pdf`;

    const paymentRecord = existingPayment
      ? await tx.payment.update({
          where: { id: existingPayment.id },
          data: {
            razorpaySignature: razorpay_signature,
            status: "SUCCESS",
            paymentMethod,
            invoiceNumber,
            invoiceUrl,
          },
        })
      : await tx.payment.create({
          data: {
            tenantId,
            planId: plan.id,
            purchaseType: "PLAN",
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
            baseAmount: gst.baseAmount,
            taxRate: gst.taxRate,
            taxAmount: gst.taxAmount,
            amount: gst.totalAmount,
            currency: "INR",
            status: "SUCCESS",
            paymentMethod,
            billingCycle,
            invoiceNumber,
            invoiceUrl,
            notes: razorpay_subscription_id,
            metadata: {
              planName: plan.name,
              planSlug: plan.slug,
              billingCycle,
              razorpaySubscriptionId: razorpay_subscription_id,
            },
          },
        });

    const invoice = await tx.invoice.create({
      data: {
        tenantId,
        invoiceNumber,
        paymentId: paymentRecord.id,
        planSlug: plan.slug,
        planName: plan.name,
        billingCycle,
        purchaseType: "PLAN",
        baseAmount: gst.baseAmount,
        taxRate: gst.taxRate,
        taxAmount: gst.taxAmount,
        amount: gst.totalAmount,
        currency: "INR",
        status: "paid",
        paidAt: now,
        billingPeriodStart: activation.periodStart,
        billingPeriodEnd: activation.periodEnd,
        invoiceUrl,
      },
    });

    const updatedSub = await tx.tenantSubscription.upsert({
      where: { tenantId },
      update: {
        planId: plan.id,
        currentPlan: plan.name,
        billingCycle,
        subscriptionStatus: "active",
        planActivatedAt: sub?.planActivatedAt || now,
        planPeriodStart: activation.periodStart,
        planPeriodEnd: activation.periodEnd,
        autopayEnabled: true,
        razorpaySubscriptionId: razorpay_subscription_id,
        pendingPlanId: null,
        pendingBillingCycle: null,
        gracePeriodEnd: null,
        graceDebtDays: 0,
        graceDebtPlanPrice: null,
        cancelRequestedAt: null,
        cancellationReason: null,
        dataDeletionDate: null,
      },
      create: {
        tenantId,
        planId: plan.id,
        currentPlan: plan.name,
        billingCycle,
        subscriptionStatus: "active",
        planActivatedAt: now,
        planPeriodStart: activation.periodStart,
        planPeriodEnd: activation.periodEnd,
        autopayEnabled: true,
        razorpaySubscriptionId: razorpay_subscription_id,
      },
      include: {
        plan: true,
        pendingPlan: { select: { id: true, name: true, slug: true } },
      },
    });

    await tx.cancellationSurvey.deleteMany({ where: { tenantId } });

    return {
      alreadyProcessed: false,
      updatedTenant,
      updatedSub,
      plan,
      billingCycle,
      activation,
      previousPlanId,
      previousPlanName,
      oldRazorpaySubscriptionId,
      paymentRecord,
      invoice,
    };
  });

  if (txResult.alreadyProcessed) {
    return {
      alreadyProcessed: true,
      subscription: formatCurrentSubscriptionSummary(txResult.updatedSub),
      invoice: txResult.invoice,
    };
  }

  if (txResult.oldRazorpaySubscriptionId) {
    await cancelRazorpaySubscriptionBestEffort(
      txResult.oldRazorpaySubscriptionId,
      { atCycleEnd: false },
    );
  }

  const gstSettings = await getGSTSettings();
  await generateAndEmailInvoiceBestEffort(
    txResult.invoice,
    txResult.updatedTenant,
    gstSettings,
  );

  const actorName =
    meta.actorName ||
    txResult.updatedTenant.businessName ||
    txResult.updatedTenant.email;

  await logTenantAudit({
    tenantId,
    actorType: "TENANT",
    actorId: meta.actorId || tenantId,
    actorName,
    action: AuditAction.PAYMENT_SUCCESS,
    module: AuditModule.BILLING,
    targetId: txResult.paymentRecord.id,
    targetRef: txResult.invoice.invoiceNumber,
    ipAddress: meta.ipAddress || null,
    userAgent: meta.userAgent || null,
    details: {
      planId: txResult.plan.id,
      planName: txResult.plan.name,
      billingCycle: txResult.billingCycle,
      amount: txResult.invoice.amount,
      invoiceNumber: txResult.invoice.invoiceNumber,
      razorpaySubscriptionId: razorpay_subscription_id,
      razorpayPaymentId: razorpay_payment_id,
      paymentMethod,
      autopay: true,
    },
  });

  const isPlanSwitch = Boolean(
    txResult.previousPlanId && txResult.previousPlanId !== txResult.plan.id,
  );

  await logTenantAudit({
    tenantId,
    actorType: "TENANT",
    actorId: meta.actorId || tenantId,
    actorName,
    action: isPlanSwitch
      ? AuditAction.PLAN_CHANGED
      : AuditAction.PLAN_ACTIVATED,
    module: AuditModule.BILLING,
    targetId: txResult.plan.id,
    targetRef: txResult.plan.name,
    ipAddress: meta.ipAddress || null,
    userAgent: meta.userAgent || null,
    details: {
      previousPlanId: txResult.previousPlanId,
      previousPlanName: txResult.previousPlanName,
      newPlanId: txResult.plan.id,
      newPlanName: txResult.plan.name,
      billingCycle: txResult.billingCycle,
      autopayEnabled: true,
      razorpaySubscriptionId: razorpay_subscription_id,
      periodStart: txResult.activation.periodStart,
      periodEnd: txResult.activation.periodEnd,
      wasExtended: txResult.activation.wasExtended,
      debtDaysDeducted: txResult.activation.debtDaysDeducted,
      debtForgiven: txResult.activation.debtForgiven,
    },
  });

  await createSuperAdminNotification({
    type: "payment_received",
    title: "Autopay Subscription Activated",
    message: `${
      txResult.updatedTenant.businessName || txResult.updatedTenant.email
    } activated ${txResult.plan.name} (${
      txResult.billingCycle
    } Autopay) — ₹${txResult.invoice.amount}.`,
    tenantId,
    metadata: {
      planId: txResult.plan.id,
      planName: txResult.plan.name,
      billingCycle: txResult.billingCycle,
      amount: txResult.invoice.amount,
      invoiceNumber: txResult.invoice.invoiceNumber,
      razorpaySubscriptionId: razorpay_subscription_id,
    },
  });

  return {
    alreadyProcessed: false,
    subscription: formatCurrentSubscriptionSummary(txResult.updatedSub),
    invoice: txResult.invoice,
    wasExtended: txResult.activation.wasExtended,
    debtDaysDeducted: txResult.activation.debtDaysDeducted,
    debtForgiven: txResult.activation.debtForgiven,
  };
}
