// backend/src/modules/tenant/plans/tenant.plans.service.js (do not remove this comment)
import { Prisma, AuditAction, AuditModule } from "@prisma/client";
import prisma from "../../../config/prisma.js";
import { ENTITLEMENT_ARRAY } from "../../../config/entitlements.config.js";
import {
  addDays,
  assertPlanPurchasable,
  getPlanPriceForCycle,
  isPlanOfferExpired,
} from "../../../lib/billingPeriod.js";
import { calculateGST } from "../../superadmin/settings/sradmin.settings.service.js";
import { logTenantAudit } from "../../audit/tenant.audit.js";
import { createSuperAdminNotification } from "../../superadmin-notifications/superadminNotification.service.js";
import { HttpError } from "../../../utils/httpError.js";

/**
 * Synchronously computes GST breakdown using a pre-fetched GST reference sample.
 */
function computePriceBreakdown(baseAmount, gstRef, monthsInCycle = 1, originalAmount = null) {
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
    featuresJson && typeof featuresJson === "object" && !Array.isArray(featuresJson)
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
  { isCurrentPlan = false, isCustomForTenant = false, now = new Date() } = {}
) {
  const { mergedFeatures, structured } = buildPlanEntitlements(plan.features);
  const offerExpired = isPlanOfferExpired(plan, now);

  const monthlyPricing = computePriceBreakdown(
    plan.monthlyPrice,
    gstRef,
    1,
    plan.originalMonthlyPrice
  );
  const quarterlyPricing = computePriceBreakdown(
    plan.quarterlyPrice,
    gstRef,
    3,
    plan.originalQuarterlyPrice
  );
  const annualPricing = computePriceBreakdown(
    plan.annualPrice,
    gstRef,
    12,
    plan.originalAnnualPrice
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
function formatCurrentSubscriptionSummary(sub) {
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
      "PLAN_NOT_FOUND"
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

  const [tenant, publicPlans, customPlansForTenant, addOns, paidPaymentCount, gstRef] =
    await Promise.all([
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
      (!sub || ["pending", "inactive"].includes(sub.subscriptionStatus))
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
      })
    );
  }

  if (sub?.plan && !seenPlanIds.has(sub.plan.id)) {
    seenPlanIds.add(sub.plan.id);
    formattedPlans.unshift(
      formatPlanForCatalog(sub.plan, gstRef, {
        isCurrentPlan: true,
        isCustomForTenant: sub.plan.customTenantId === tenantId,
        now,
      })
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
        })
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
 * Enforces one-trial-per-email via TrialEmailRegistry and prevents trial restart
 * after any previous trial or paid activation.
 */
export async function startTrialService(tenantId, { planId }, meta = {}) {
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "tenant_subscription" WHERE "tenantId" = ${tenantId} FOR UPDATE`
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
        "PLAN_NO_TRIAL"
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
        "TRIAL_NOT_ELIGIBLE"
      );
    }

    const normalizedEmail = (tenant.email || "").trim().toLowerCase();
    if (!normalizedEmail) {
      throw new HttpError(
        400,
        "A valid tenant email address is required to start a free trial.",
        "EMAIL_REQUIRED"
      );
    }

    const existingTrialEmail = await tx.trialEmailRegistry.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingTrialEmail) {
      throw new HttpError(
        403,
        "A free trial has already been claimed with this email address.",
        "TRIAL_ALREADY_USED"
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
  meta = {}
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
      "SUBSCRIPTION_NOT_ACTIVE"
    );
  }

  assertPlanPurchasable(targetPlan, { isSamePlanRenewal: false, now });
  getPlanPriceForCycle(targetPlan, billingCycle);

  if (sub.planId === targetPlan.id && sub.billingCycle === billingCycle) {
    throw new HttpError(
      409,
      "You are already on this plan and billing cycle.",
      "ALREADY_ON_PLAN_CYCLE"
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
      "NO_PENDING_PLAN_CHANGE"
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