// backend/src/lib/billingPeriod.js (do not remove this comment)
import prisma from "../config/prisma.js";
import razorpay from "../config/razorpay.js";
import { calculateGST } from "../modules/superadmin/settings/sradmin.settings.service.js";
import { HttpError } from "../utils/httpError.js";
import logger from "../utils/logger.js";

export const DAY_MS = 24 * 60 * 60 * 1000;

export const CYCLE_MONTHS = Object.freeze({
  MONTHLY: 1,
  QUARTERLY: 3,
  ANNUAL: 12,
});

export const TENANT_BILLING_CYCLES = Object.freeze([
  "MONTHLY",
  "QUARTERLY",
  "ANNUAL",
]);

/**
 * End-of-month clamped UTC month addition.
 */
export function addMonthsUTC(date, months) {
  const d = new Date(date);
  const targetMonth = d.getUTCMonth() + months;
  const year = d.getUTCFullYear() + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d.getUTCDate(), lastDayOfTargetMonth);

  return new Date(
    Date.UTC(
      year,
      month,
      day,
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds(),
      d.getUTCMilliseconds()
    )
  );
}

/**
 * Adds exact 24-hour days to a Date.
 */
export function addDays(date, days) {
  return new Date(new Date(date).getTime() + Number(days) * DAY_MS);
}

/**
 * Advances a date by one billing cycle (MONTHLY = +1m, QUARTERLY = +3m, ANNUAL = +12m).
 */
export function addCycleDuration(startDate, billingCycle) {
  const months = CYCLE_MONTHS[billingCycle];
  if (!months) {
    throw new HttpError(
      400,
      `Unsupported recurring billing cycle "${billingCycle}".`,
      "INVALID_BILLING_CYCLE"
    );
  }
  return addMonthsUTC(startDate, months);
}

/**
 * Resolves the pre-tax price for a SubscriptionPlan and BillingCycle.
 * Throws 400 if the cycle price is not configured on the plan.
 */
export function getPlanPriceForCycle(plan, billingCycle) {
  if (!plan) {
    throw new HttpError(404, "Plan not found.", "PLAN_NOT_FOUND");
  }

  let rawPrice = null;
  if (billingCycle === "MONTHLY") {
    rawPrice = plan.monthlyPrice;
  } else if (billingCycle === "QUARTERLY") {
    rawPrice = plan.quarterlyPrice;
  } else if (billingCycle === "ANNUAL") {
    rawPrice = plan.annualPrice;
  } else {
    throw new HttpError(
      400,
      `Unsupported billing cycle "${billingCycle}". Allowed: MONTHLY, QUARTERLY, ANNUAL.`,
      "INVALID_BILLING_CYCLE"
    );
  }

  if (rawPrice === null || rawPrice === undefined || Number(rawPrice) < 0) {
    throw new HttpError(
      400,
      `Billing cycle "${billingCycle}" is not available for the "${plan.name}" plan.`,
      "BILLING_CYCLE_UNAVAILABLE"
    );
  }

  return Number(rawPrice);
}

/**
 * Returns the monthly-normalized list price for upgrade/downgrade and grace-debt comparison.
 */
export function monthlyEquivalent(planOrPrice, billingCycle = "MONTHLY") {
  if (typeof planOrPrice === "number") {
    return planOrPrice;
  }
  if (!planOrPrice) {
    return null;
  }
  if (billingCycle === "ANNUAL" && planOrPrice.annualPrice != null) {
    return Number(planOrPrice.annualPrice) / 12;
  }
  if (billingCycle === "QUARTERLY" && planOrPrice.quarterlyPrice != null) {
    return Number(planOrPrice.quarterlyPrice) / 3;
  }
  if (planOrPrice.monthlyPrice != null) {
    return Number(planOrPrice.monthlyPrice);
  }
  return null;
}

/**
 * Returns true if the plan has an offerValidUntil timestamp in the past.
 */
export function isPlanOfferExpired(plan, now = new Date()) {
  if (!plan?.offerValidUntil) return false;
  return new Date(plan.offerValidUntil).getTime() <= now.getTime();
}

/**
 * Validates that a plan can be purchased or selected by a tenant via self-serve flows.
 * - Rejects INACTIVE plans
 * - Rejects CUSTOM and ADMIN_ONLY plans (must be assigned by SuperAdmin)
 * - Rejects expired promotional offers unless renewing the exact same plan
 */
export function assertPlanPurchasable(
  plan,
  { isSamePlanRenewal = false, now = new Date() } = {}
) {
  if (!plan) {
    throw new HttpError(404, "Plan not found.", "PLAN_NOT_FOUND");
  }

  if (plan.status !== "ACTIVE") {
    throw new HttpError(
      400,
      `The "${plan.name}" plan is discontinued and no longer available for purchase.`,
      "PLAN_INACTIVE"
    );
  }

  if (plan.planType === "CUSTOM" || plan.visibility === "ADMIN_ONLY") {
    throw new HttpError(
      403,
      `The "${plan.name}" plan requires administrator activation and cannot be purchased via self-checkout.`,
      "PLAN_ADMIN_ONLY"
    );
  }

  if (!isSamePlanRenewal && isPlanOfferExpired(plan, now)) {
    throw new HttpError(
      400,
      `The promotional offer for "${plan.name}" has expired.`,
      "PLAN_OFFER_EXPIRED"
    );
  }
}

/**
 * Computes the new [periodStart, periodEnd] and grace-debt resolution when a tenant
 * activates, renews, or switches a paid plan.
 *
 * Rules:
 * 1. Same-plan + same-cycle renewal while active/cancel_at_period_end (planPeriodEnd > now):
 *    - Preserves existing planPeriodStart so getUsageWindow() anchor stays in the past.
 *    - Advances planPeriodEnd from existing planPeriodEnd by one cycle.
 * 2. Grace debt forgiveness vs deduction (Decision 71 / 103):
 *    - If recovering from payment_failed or expired with graceDebtDays > 0:
 *      - Upgrade (strictly higher monthly-equivalent list price) forgives grace debt.
 *      - Same or lower monthly-equivalent list price deducts accrued grace days from
 *        the new periodEnd (clamped to a minimum floor of now + 1 day).
 */
export function computeActivationPeriod({
  sub,
  newPlan,
  billingCycle,
  now = new Date(),
}) {
  let accruedGraceDays = 0;
  let debtForgiven = false;
  let debtDaysDeducted = 0;

  if (sub?.subscriptionStatus === "payment_failed") {
    const graceStart = sub.planPeriodEnd ? new Date(sub.planPeriodEnd) : now;
    const graceCap = sub.gracePeriodEnd
      ? new Date(Math.min(now.getTime(), new Date(sub.gracePeriodEnd).getTime()))
      : now;
    const elapsedMs = Math.max(0, graceCap.getTime() - graceStart.getTime());
    const elapsedDays = Math.ceil(elapsedMs / DAY_MS);
    accruedGraceDays = Math.max(sub.graceDebtDays || 0, elapsedDays);
  } else if (
    sub?.subscriptionStatus === "expired" &&
    (sub?.graceDebtDays || 0) > 0
  ) {
    accruedGraceDays = sub.graceDebtDays;
  }

  if (accruedGraceDays > 0) {
    const oldMonthlyEq = sub?.plan
      ? monthlyEquivalent(sub.plan, sub.billingCycle)
      : (sub?.graceDebtPlanPrice ?? null);
    const newMonthlyEq = monthlyEquivalent(newPlan, billingCycle);

    const isUpgrade =
      oldMonthlyEq != null &&
      newMonthlyEq != null &&
      newMonthlyEq > oldMonthlyEq;

    if (isUpgrade) {
      debtForgiven = true;
      debtDaysDeducted = 0;
    } else {
      debtForgiven = false;
      debtDaysDeducted = accruedGraceDays;
    }
  }

  const isSameActivePlanCycle = Boolean(
    sub &&
      sub.planId === newPlan.id &&
      sub.billingCycle === billingCycle &&
      ["active", "cancel_at_period_end"].includes(sub.subscriptionStatus) &&
      sub.planPeriodEnd &&
      new Date(sub.planPeriodEnd).getTime() > now.getTime()
  );

  if (isSameActivePlanCycle) {
    const periodStart = sub.planPeriodStart ? new Date(sub.planPeriodStart) : now;
    const periodEnd = addCycleDuration(new Date(sub.planPeriodEnd), billingCycle);
    return {
      periodStart,
      periodEnd,
      wasExtended: true,
      accruedGraceDays,
      debtDaysDeducted: 0,
      debtForgiven: false,
    };
  }

  const periodStart = now;
  const rawEnd = addCycleDuration(now, billingCycle);
  let periodEnd = rawEnd;

  if (debtDaysDeducted > 0) {
    const deductedEnd = new Date(rawEnd.getTime() - debtDaysDeducted * DAY_MS);
    const minEnd = new Date(now.getTime() + DAY_MS);
    periodEnd = deductedEnd.getTime() > minEnd.getTime() ? deductedEnd : minEnd;
  }

  return {
    periodStart,
    periodEnd,
    wasExtended: false,
    accruedGraceDays,
    debtDaysDeducted,
    debtForgiven,
  };
}

const PLAN_RAZORPAY_CYCLE_CONFIG = Object.freeze({
  MONTHLY: {
    column: "razorpayMonthlyPlanId",
    period: "monthly",
    interval: 1,
    label: "Monthly",
  },
  QUARTERLY: {
    column: "razorpayQuarterlyPlanId",
    period: "monthly",
    interval: 3,
    label: "Quarterly",
  },
  ANNUAL: {
    column: "razorpayAnnualPlanId",
    period: "yearly",
    interval: 1,
    label: "Annual",
  },
});

/**
 * Lazily creates and caches a GST-inclusive Razorpay Plan for a SubscriptionPlan + BillingCycle.
 */
export async function getOrCreateRazorpayPlanForSubscriptionPlan(
  plan,
  billingCycle,
  forceRecreate = false
) {
  const cfg = PLAN_RAZORPAY_CYCLE_CONFIG[billingCycle];
  if (!cfg) {
    throw new HttpError(
      400,
      `Unsupported autopay billing cycle "${billingCycle}".`,
      "INVALID_BILLING_CYCLE"
    );
  }

  const existingId = plan[cfg.column];
  if (existingId && !forceRecreate) {
    return existingId;
  }

  const baseAmount = getPlanPriceForCycle(plan, billingCycle);
  if (baseAmount <= 0) {
    throw new HttpError(
      400,
      "Recurring autopay cannot be created for a zero-price plan cycle.",
      "INVALID_PLAN_PRICE"
    );
  }

  const gst = await calculateGST(baseAmount);
  const amountInPaise = Math.round(gst.totalAmount * 100);

  const rzpPlan = await razorpay.plans.create({
    period: cfg.period,
    interval: cfg.interval,
    item: {
      name: `${plan.name} (${cfg.label})`,
      amount: amountInPaise,
      currency: "INR",
      description: `${plan.description || plan.name} - ${cfg.label} Subscription${
        gst.gstRegistered ? ` (Incl. ${gst.taxRate}% ${gst.taxLabel})` : ""
      }`,
    },
    notes: {
      kind: "SUBSCRIPTION_PLAN",
      planId: plan.id,
      slug: plan.slug,
      billingCycle,
      baseAmount: String(baseAmount),
      taxRate: String(gst.taxRate),
      taxAmount: String(gst.taxAmount),
      totalAmount: String(gst.totalAmount),
    },
  });

  await prisma.subscriptionPlan.update({
    where: { id: plan.id },
    data: { [cfg.column]: rzpPlan.id },
  });

  plan[cfg.column] = rzpPlan.id;

  logger.info("Created Razorpay plan for SubscriptionPlan", {
    planId: plan.id,
    slug: plan.slug,
    billingCycle,
    razorpayPlanId: rzpPlan.id,
    totalAmount: gst.totalAmount,
  });

  return rzpPlan.id;
}

/**
 * Lazily creates and caches a GST-inclusive Razorpay Plan for a RECURRING PlanAddOn.
 */
export async function getOrCreateRazorpayPlanForAddOn(
  addOn,
  forceRecreate = false
) {
  if (!addOn || addOn.type !== "RECURRING") {
    throw new HttpError(
      400,
      "Only RECURRING add-ons support Razorpay subscriptions.",
      "INVALID_ADDON_TYPE"
    );
  }

  const cfg = PLAN_RAZORPAY_CYCLE_CONFIG[addOn.billingCycle];
  if (!cfg) {
    throw new HttpError(
      400,
      `Add-on "${addOn.name}" has an invalid recurring cycle "${addOn.billingCycle}".`,
      "INVALID_BILLING_CYCLE"
    );
  }

  if (addOn.razorpayPlanId && !forceRecreate) {
    return addOn.razorpayPlanId;
  }

  const baseAmount = Number(addOn.price || 0);
  if (baseAmount <= 0) {
    throw new HttpError(
      400,
      "Recurring autopay cannot be created for a zero-price add-on.",
      "INVALID_ADDON_PRICE"
    );
  }

  const gst = await calculateGST(baseAmount);
  const amountInPaise = Math.round(gst.totalAmount * 100);

  const rzpPlan = await razorpay.plans.create({
    period: cfg.period,
    interval: cfg.interval,
    item: {
      name: `${addOn.name} Add-On (${cfg.label})`,
      amount: amountInPaise,
      currency: "INR",
      description: `${addOn.description || addOn.name} - ${cfg.label} Add-On${
        gst.gstRegistered ? ` (Incl. ${gst.taxRate}% ${gst.taxLabel})` : ""
      }`,
    },
    notes: {
      kind: "PLAN_ADDON",
      addOnId: addOn.id,
      slug: addOn.slug,
      billingCycle: addOn.billingCycle,
      baseAmount: String(baseAmount),
      taxRate: String(gst.taxRate),
      taxAmount: String(gst.taxAmount),
      totalAmount: String(gst.totalAmount),
    },
  });

  await prisma.planAddOn.update({
    where: { id: addOn.id },
    data: { razorpayPlanId: rzpPlan.id },
  });

  addOn.razorpayPlanId = rzpPlan.id;

  logger.info("Created Razorpay plan for PlanAddOn", {
    addOnId: addOn.id,
    slug: addOn.slug,
    billingCycle: addOn.billingCycle,
    razorpayPlanId: rzpPlan.id,
    totalAmount: gst.totalAmount,
  });

  return rzpPlan.id;
}

/**
 * Best-effort cancellation of a Razorpay subscription. Never throws.
 */
export async function cancelRazorpaySubscriptionBestEffort(
  razorpaySubscriptionId,
  { atCycleEnd = false } = {}
) {
  if (!razorpaySubscriptionId) {
    return { skipped: true };
  }

  try {
    const rzpSub = await razorpay.subscriptions.fetch(razorpaySubscriptionId);
    if (["cancelled", "completed", "expired"].includes(rzpSub?.status)) {
      return { skipped: true, status: rzpSub.status };
    }
    await razorpay.subscriptions.cancel(
      razorpaySubscriptionId,
      Boolean(atCycleEnd)
    );
    return { skipped: false, status: "cancelled" };
  } catch (err) {
    logger.warn("Best-effort Razorpay subscription cancel warning", {
      razorpaySubscriptionId,
      atCycleEnd,
      error: err?.error?.description || err?.message,
    });
    return {
      skipped: false,
      error: err?.error?.description || err?.message || "Cancel failed",
    };
  }
}