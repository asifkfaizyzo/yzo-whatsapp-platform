// backend/src/modules/superadmin/subscriptions/sradmin.subscriptions.service.js (do not remove this comment)
import prisma from "../../../config/prisma.js";
import { HttpError } from "../../../lib/utils/http.error.js";
import { logAdminAction } from "../../../lib/utils/admin.audit.js";
import { getRazorpay } from "../../../config/razorpay.js";
import { calculateGST } from "../../../lib/billing.js";
import {
  generateInvoiceNumber,
  generateInvoicePDF,
  getInvoiceSettings,
} from "../../../lib/invoice.js";
import { resolveAllEntitlements } from "../../../lib/entitlements/entitlement.service.js";
import { getUsageSummary, grantCredits } from "../../../lib/entitlements/usage.service.js";
import {
  sendStatusUpdateEmail,
  sendInvoiceEmail,
  sendSubscriptionPausedEmail,
  sendSubscriptionResumedEmail,
  sendReactivationConfirmedEmail,
  sendSubscriptionExpiredEmail,
} from "../../email/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Constants & selects
// ─────────────────────────────────────────────────────────────────────────────
const DAY_MS = 86_400_000;
const CYCLE_MONTHS = { MONTHLY: 1, QUARTERLY: 3, ANNUAL: 12 };

const EXTENDABLE = ["trialing", "active", "cancel_at_period_end", "payment_failed", "paused"];
const PAUSABLE = ["active", "trialing", "cancel_at_period_end"];
const CHANGEABLE = ["trialing", "active", "cancel_at_period_end", "payment_failed", "paused"];
const RZP_TERMINAL = ["cancelled", "completed", "expired"];

const TENANT_FIELDS = { id: true, tenantName: true, email: true, status: true, isActive: true };

const PLAN_FIELDS = {
  id: true,
  name: true,
  planType: true,
  status: true,
  customTenantId: true,
  monthlyPrice: true,
  quarterlyPrice: true,
  annualPrice: true,
};

// Explicit allow-list: merchant gateway keys / OAuth tokens on this row are never selected.
const SUB_FIELDS = {
  tenantId: true,
  planId: true,
  planActivatedAt: true,
  billingCycle: true,
  currentPlan: true,
  subscriptionStatus: true,
  planPeriodStart: true,
  planPeriodEnd: true,
  cancelRequestedAt: true,
  cancellationReason: true,
  reactivatedAt: true,
  freeUntilDate: true,
  dataDeletionDate: true,
  gracePeriodDays: true,
  gracePeriodEnd: true,
  graceDebtDays: true,
  graceDebtPlanPrice: true,
  customLimitsOverride: true,
  razorpaySubscriptionId: true,
  autopayEnabled: true,
  autopayMethod: true,
  pendingPlanId: true,
  pendingBillingCycle: true,
  createdAt: true,
  updatedAt: true,
};
const SUB_WITH_PLAN = { ...SUB_FIELDS, plan: { select: PLAN_FIELDS } };

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────────────
const addDays = (date, n) => new Date(new Date(date).getTime() + n * DAY_MS);

// Calendar-month add with end-of-month clamp (Jan 31 + 1 month = Feb 28/29).
const addMonths = (date, months) => {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
};

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const emailStatus = (s) => (s === "paused" ? "PAUSED" : s === "expired" ? "EXPIRED" : "ACTIVE");

/** Monthly-equivalent price of a plan under a billing cycle (falls back to monthlyPrice). */
const monthlyEquivalent = (plan, cycle) => {
  if (!plan) return null;
  const months = CYCLE_MONTHS[cycle] ?? 1;
  const cyclePrice =
    cycle === "QUARTERLY" ? plan.quarterlyPrice : cycle === "ANNUAL" ? plan.annualPrice : plan.monthlyPrice;
  if (cyclePrice == null || cyclePrice <= 0) return plan.monthlyPrice;
  return cyclePrice / months;
};

const diffObjects = (before = {}, after = {}) => {
  const out = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      out[key] = { from: before[key] ?? null, to: after[key] ?? null };
    }
  }
  return out;
};

const audit = (actor, meta, tenant, action, description, metadata = {}) =>
  logAdminAction(actor, meta, {
    action,
    module: "BILLING",
    description,
    targetId: tenant.id,
    targetType: "TenantSubscription",
    targetName: tenant.tenantName,
    tenantId: tenant.id,
    metadata,
  });

// Email helpers are queued/non-throwing; this only guards against sync template errors.
const notify = (fn, to, payload) => {
  try {
    fn(to, payload);
  } catch (err) {
    console.warn(`[sradmin.subscriptions] email failed: ${err?.message}`);
  }
};

const requireSub = (sub) => {
  if (!sub) throw new HttpError(404, "This tenant has no subscription record");
  return sub;
};

const assertStatus = (sub, allowed, action) => {
  if (!allowed.includes(sub.subscriptionStatus)) {
    throw new HttpError(
      409,
      `Cannot ${action} a subscription that is "${sub.subscriptionStatus}". Allowed: ${allowed.join(", ")}.`
    );
  }
};

/**
 * Loads tenant + subscription under a row lock so concurrent admin actions
 * (and the P5 cron) serialize. `ensure` creates the (default-expired) row first.
 */
const loadLocked = async (tx, tenantId, { ensure = false } = {}) => {
  const tenant = await tx.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
    select: TENANT_FIELDS,
  });
  if (!tenant) throw new HttpError(404, "Tenant not found");
  if (ensure) {
    await tx.tenantSubscription.upsert({ where: { tenantId }, update: {}, create: { tenantId } });
  }
  await tx.$queryRaw`SELECT 1 FROM "tenant_subscription" WHERE "tenantId" = ${tenantId} FOR UPDATE`;
  const sub = await tx.tenantSubscription.findUnique({
    where: { tenantId },
    select: SUB_WITH_PLAN,
  });
  return { tenant, sub };
};

const peekSubscription = async (tenantId) => {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!tenant) throw new HttpError(404, "Tenant not found");
  const sub = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    select: { subscriptionStatus: true, razorpaySubscriptionId: true },
  });
  return requireSub(sub);
};

const hasEverPaid = async (db, tenantId) => {
  const payment = await db.payment.findFirst({
    where: { tenantId, status: "SUCCESS" },
    select: { id: true },
  });
  if (payment) return true;
  const invoice = await db.invoice.findFirst({ where: { tenantId }, select: { id: true } });
  return Boolean(invoice);
};

const loadAssignablePlan = async (tx, planId, tenantId) => {
  const plan = await tx.subscriptionPlan.findUnique({ where: { id: planId }, select: PLAN_FIELDS });
  if (!plan) throw new HttpError(404, "Plan not found");
  if (plan.status !== "ACTIVE") {
    throw new HttpError(409, `Plan "${plan.name}" is inactive. Activate it first or choose another plan.`);
  }
  if (plan.planType === "CUSTOM" && plan.customTenantId !== tenantId) {
    throw new HttpError(409, `Plan "${plan.name}" is a custom plan that belongs to a different tenant.`);
  }
  return plan;
};

/** Best-effort Razorpay call. Never throws; failures are surfaced as warnings. */
const rzpCall = async (op, subscriptionId, warnings, { atCycleEnd = false } = {}) => {
  try {
    const rzp = getRazorpay();
    if (op === "cancel") {
      const remote = await rzp.subscriptions.fetch(subscriptionId);
      if (remote && RZP_TERMINAL.includes(remote.status)) return true;
      await rzp.subscriptions.cancel(subscriptionId, atCycleEnd);
    } else if (op === "pause") {
      await rzp.subscriptions.pause(subscriptionId, { pause_at: "now" });
    } else if (op === "resume") {
      await rzp.subscriptions.resume(subscriptionId, { resume_at: "now" });
    }
    return true;
  } catch (err) {
    const msg = err?.error?.description || err?.message || String(err);
    console.warn(`[sradmin.subscriptions] Razorpay ${op} failed for ${subscriptionId}: ${msg}`);
    warnings.push(`RAZORPAY_${op.toUpperCase()}_FAILED (${subscriptionId}): ${msg}`);
    return false;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────
export const listSubscriptionsService = async (q) => {
  const now = new Date();
  const where = {
    ...(q.status && { subscriptionStatus: q.status }),
    ...(q.planId && { planId: q.planId }),
    ...(q.expiringWithinDays && {
      planPeriodEnd: { gte: now, lte: addDays(now, q.expiringWithinDays) },
    }),
    tenant: {
      deletedAt: null,
      ...(q.search && {
        OR: [
          { tenantName: { contains: q.search, mode: "insensitive" } },
          { email: { contains: q.search, mode: "insensitive" } },
        ],
      }),
    },
  };

  const orderBy =
    q.sortBy === "planPeriodEnd"
      ? { planPeriodEnd: { sort: q.sortOrder, nulls: "last" } }
      : { updatedAt: q.sortOrder };

  const [rows, total] = await prisma.$transaction([
    prisma.tenantSubscription.findMany({
      where,
      orderBy,
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      select: {
        tenantId: true,
        planId: true,
        currentPlan: true,
        billingCycle: true,
        subscriptionStatus: true,
        planPeriodStart: true,
        planPeriodEnd: true,
        gracePeriodEnd: true,
        freeUntilDate: true,
        autopayEnabled: true,
        pendingPlanId: true,
        customLimitsOverride: true,
        updatedAt: true,
        tenant: { select: TENANT_FIELDS },
        plan: { select: { id: true, name: true, planType: true } },
      },
    }),
    prisma.tenantSubscription.count({ where }),
  ]);

  const items = rows.map(({ customLimitsOverride, ...rest }) => ({
    ...rest,
    hasCustomLimits: Object.keys(customLimitsOverride ?? {}).length > 0,
  }));

  return {
    items,
    pagination: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
};

export const getSubscriptionDetailService = async (tenantId) => {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
    select: { ...TENANT_FIELDS, phone: true, createdAt: true },
  });
  if (!tenant) throw new HttpError(404, "Tenant not found");

  const [subscription, addOns, payments, invoices, settings, everPaid] = await Promise.all([
    prisma.tenantSubscription.findUnique({
      where: { tenantId },
      select: {
        ...SUB_FIELDS,
        plan: { select: PLAN_FIELDS },
        pendingPlan: { select: { id: true, name: true, status: true } },
      },
    }),
    prisma.tenantAddOn.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: {
        addOn: {
          select: {
            id: true,
            name: true,
            key: true,
            type: true,
            billingCycle: true,
            price: true,
            entitlementKey: true,
            entitlementValue: true,
          },
        },
      },
    }),
    prisma.payment.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        purchaseType: true,
        planName: true,
        billingType: true,
        totalAmount: true,
        status: true,
        paymentType: true,
        paymentMethod: true,
        offlineReference: true,
        paidAt: true,
        createdAt: true,
      },
    }),
    prisma.invoice.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        invoiceNumber: true,
        purchaseType: true,
        planName: true,
        amount: true,
        billingCycle: true,
        status: true,
        billingPeriodStart: true,
        billingPeriodEnd: true,
        createdAt: true,
      },
    }),
    getInvoiceSettings(),
    hasEverPaid(prisma, tenantId),
  ]);

  // The detail view must survive an engine hiccup.
  const [entitlements, usage] = await Promise.all([
    resolveAllEntitlements(tenantId).catch((e) => {
      console.warn("[sradmin.subscriptions] resolveAllEntitlements failed:", e?.message);
      return null;
    }),
    getUsageSummary(tenantId).catch((e) => {
      console.warn("[sradmin.subscriptions] getUsageSummary failed:", e?.message);
      return null;
    }),
  ]);

  return {
    tenant,
    subscription,
    effectiveGraceDays: subscription?.gracePeriodDays ?? settings.defaultGraceDays,
    hasEverPaid: everPaid,
    addOns,
    entitlements,
    usage,
    recentPayments: payments,
    recentInvoices: invoices,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Extend / extend-trial
// ─────────────────────────────────────────────────────────────────────────────
export const extendSubscriptionService = async (tenantId, { days, reason }, actor, meta) => {
  const now = new Date();
  const { tenant, before, after, statusRestored } = await prisma.$transaction(async (tx) => {
    const { tenant, sub } = await loadLocked(tx, tenantId);
    requireSub(sub);
    assertStatus(sub, EXTENDABLE, "extend");

    // Extend from whichever is later: current end or now, so the tenant always gets N full days.
    const base = sub.planPeriodEnd && sub.planPeriodEnd > now ? sub.planPeriodEnd : now;
    const data = { planPeriodEnd: addDays(base, days) };
    if (!sub.planPeriodStart) data.planPeriodStart = now;

    // Extension resolves a lapse: leave grace and go back to active.
    const restore = sub.subscriptionStatus === "payment_failed";
    if (restore) {
      data.subscriptionStatus = "active";
      data.gracePeriodEnd = null;
    }

    const after = await tx.tenantSubscription.update({
      where: { tenantId },
      data,
      select: SUB_FIELDS,
    });
    return { tenant, before: sub, after, statusRestored: restore };
  });

  await audit(actor, meta, tenant, "SUBSCRIPTION_EXTENDED",
    `Extended "${tenant.tenantName}" subscription by ${days} day(s)`, {
      days,
      reason: reason ?? null,
      previousPeriodEnd: before.planPeriodEnd,
      newPeriodEnd: after.planPeriodEnd,
      previousStatus: before.subscriptionStatus,
      newStatus: after.subscriptionStatus,
      statusRestored,
    });

  return {
    subscription: after,
    daysAdded: days,
    previousPeriodEnd: before.planPeriodEnd,
    newPeriodEnd: after.planPeriodEnd,
    statusRestored,
  };
};

export const extendTrialService = async (tenantId, { days, reason }, actor, meta) => {
  const now = new Date();
  const { tenant, before, after } = await prisma.$transaction(async (tx) => {
    const { tenant, sub } = await loadLocked(tx, tenantId);
    requireSub(sub);
    if (sub.subscriptionStatus !== "trialing") {
      throw new HttpError(
        409,
        `Only trialing subscriptions can be trial-extended (current: "${sub.subscriptionStatus}"). For a lapsed trial use reactivate.`
      );
    }
    const base = sub.planPeriodEnd && sub.planPeriodEnd > now ? sub.planPeriodEnd : now;
    const after = await tx.tenantSubscription.update({
      where: { tenantId },
      data: { planPeriodEnd: addDays(base, days), ...(sub.planPeriodStart ? {} : { planPeriodStart: now }) },
      select: SUB_FIELDS,
    });
    return { tenant, before: sub, after };
  });

  await audit(actor, meta, tenant, "SUBSCRIPTION_TRIAL_EXTENDED",
    `Extended "${tenant.tenantName}" trial by ${days} day(s)`, {
      days,
      reason: reason ?? null,
      previousPeriodEnd: before.planPeriodEnd,
      newPeriodEnd: after.planPeriodEnd,
    });

  return {
    subscription: after,
    daysAdded: days,
    previousPeriodEnd: before.planPeriodEnd,
    newPeriodEnd: after.planPeriodEnd,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Change plan (IMMEDIATE | AT_PERIOD_END | CLEAR_PENDING)
// ─────────────────────────────────────────────────────────────────────────────
export const changePlanService = async (tenantId, input, actor, meta) => {
  const warnings = [];
  const now = new Date();

  const out = await prisma.$transaction(async (tx) => {
    const { tenant, sub } = await loadLocked(tx, tenantId);
    requireSub(sub);
    assertStatus(sub, CHANGEABLE, "change the plan of");

    if (input.mode === "CLEAR_PENDING") {
      if (!sub.pendingPlanId) throw new HttpError(409, "There is no scheduled plan change to clear");
      const after = await tx.tenantSubscription.update({
        where: { tenantId },
        data: { pendingPlanId: null, pendingBillingCycle: null },
        select: SUB_FIELDS,
      });
      return { kind: "CLEARED", tenant, sub, after };
    }

    const plan = await loadAssignablePlan(tx, input.planId, tenantId);
    const cycle = input.billingCycle ?? sub.billingCycle;

    if (plan.id === sub.planId && cycle === sub.billingCycle) {
      throw new HttpError(409, "Tenant is already on this plan and billing cycle");
    }

    if (input.mode === "AT_PERIOD_END") {
      if (sub.subscriptionStatus !== "active") {
        throw new HttpError(
          409,
          `Scheduled changes need an "active" subscription (current: "${sub.subscriptionStatus}"). Use mode IMMEDIATE.`
        );
      }
      const after = await tx.tenantSubscription.update({
        where: { tenantId },
        data: { pendingPlanId: plan.id, pendingBillingCycle: cycle },
        select: SUB_FIELDS,
      });
      return { kind: "SCHEDULED", tenant, sub, after, plan, cycle };
    }

    // IMMEDIATE: swap plan, keep paid period dates (no proration, no payment).
    const liveAutopay = Boolean(sub.razorpaySubscriptionId) && sub.autopayEnabled;
    if (liveAutopay && !input.detachAutopay) {
      throw new HttpError(
        409,
        "Tenant has live Razorpay autopay tied to the current plan. Retry with detachAutopay=true (cancels the mandate; tenant must re-subscribe before period end) or use mode AT_PERIOD_END."
      );
    }
    const after = await tx.tenantSubscription.update({
      where: { tenantId },
      data: {
        planId: plan.id,
        currentPlan: plan.name,
        billingCycle: cycle,
        pendingPlanId: null,
        pendingBillingCycle: null,
        ...(liveAutopay ? { autopayEnabled: false } : {}),
      },
      select: SUB_FIELDS,
    });
    return { kind: "APPLIED", tenant, sub, after, plan, cycle, detach: liveAutopay };
  });

  const { kind, tenant, sub, after } = out;

  if (kind === "APPLIED") {
    if (out.detach) await rzpCall("cancel", sub.razorpaySubscriptionId, warnings);
    await audit(actor, meta, tenant, "PLAN_CHANGED",
      `Admin changed "${tenant.tenantName}" plan: ${sub.currentPlan ?? "none"} -> ${out.plan.name}`, {
        reason: input.reason ?? null,
        fromPlanId: sub.planId,
        toPlanId: out.plan.id,
        fromPlan: sub.currentPlan,
        toPlan: out.plan.name,
        fromCycle: sub.billingCycle,
        toCycle: out.cycle,
        autopayDetached: out.detach,
      });
    if (sub.currentPlan !== out.plan.name) {
      notify(sendStatusUpdateEmail, tenant.email, {
        tenantName: tenant.tenantName,
        oldPlan: sub.currentPlan ?? "-",
        newPlan: out.plan.name,
        newStatus: emailStatus(after.subscriptionStatus),
        effectiveDate: fmtDate(now),
      });
    }
  } else if (kind === "SCHEDULED") {
    await audit(actor, meta, tenant, "PLAN_CHANGE_SCHEDULED",
      `Admin scheduled "${tenant.tenantName}" plan change to ${out.plan.name} at period end`, {
        reason: input.reason ?? null,
        toPlanId: out.plan.id,
        toPlan: out.plan.name,
        toCycle: out.cycle,
        previousPendingPlanId: sub.pendingPlanId,
        effectiveAt: sub.planPeriodEnd,
      });
  } else {
    await audit(actor, meta, tenant, "PLAN_CHANGE_CANCELLED",
      `Admin cleared scheduled plan change for "${tenant.tenantName}"`, {
        reason: input.reason ?? null,
        clearedPendingPlanId: sub.pendingPlanId,
        clearedPendingCycle: sub.pendingBillingCycle,
      });
  }

  return { mode: input.mode, subscription: after, warnings };
};

// ─────────────────────────────────────────────────────────────────────────────
// Manual (offline) activation
// ─────────────────────────────────────────────────────────────────────────────
export const manualActivateService = async (tenantId, input, actor, meta) => {
  const warnings = [];
  const now = new Date();
  const settings = await getInvoiceSettings();
  const gst = await calculateGST(input.amount);

  const ref = input.paymentRef.trim();
  const normalizedRef = ref.replace(/\s+/g, " ").toUpperCase();
  // Tenant-scoped idempotency key (cheque/UTR numbers can repeat across tenants).
  const razorpayPaymentId = `OFFLINE:${tenantId}:${normalizedRef}`;
  const paidAt = input.paidAt ? new Date(input.paidAt) : now;

  let out;
  try {
    out = await prisma.$transaction(
      async (tx) => {
        const { tenant, sub } = await loadLocked(tx, tenantId, { ensure: true });
        if (tenant.status === "BLOCKED") {
          throw new HttpError(409, "Tenant is blocked. Unblock the tenant before activating a plan.");
        }
        const plan = await loadAssignablePlan(tx, input.planId, tenantId);

        const duplicate = await tx.payment.findUnique({
          where: { razorpayPaymentId },
          select: { id: true },
        });
        if (duplicate) {
          throw new HttpError(409, `paymentRef "${ref}" was already recorded for this tenant`);
        }

        const previousStatus = sub.subscriptionStatus;
        const start = now;
        const originalEnd = input.durationDays
          ? addDays(start, input.durationDays)
          : addMonths(start, CYCLE_MONTHS[input.billingCycle]);
        let end = originalEnd;

        // Grace-debt settlement (context doc 4.3)
        const debt = { outcome: "NONE", recordedDays: sub.graceDebtDays, deductedDays: 0 };
        if (sub.graceDebtDays > 0) {
          if (input.durationDays) {
            debt.outcome = "FORGIVEN_ADMIN_OVERRIDE"; // explicit duration = admin decides
          } else {
            const referencePrice =
              sub.graceDebtPlanPrice ?? monthlyEquivalent(sub.plan, sub.billingCycle);
            const newPrice = monthlyEquivalent(plan, input.billingCycle);
            const isUpgrade = referencePrice == null || newPrice > referencePrice;
            if (isUpgrade) {
              debt.outcome = "FORGIVEN_UPGRADE";
            } else {
              end = new Date(
                Math.max(originalEnd.getTime() - sub.graceDebtDays * DAY_MS, start.getTime() + DAY_MS)
              );
              debt.outcome = "DEDUCTED";
              debt.deductedDays = Math.round((originalEnd - end) / DAY_MS);
            }
          }
        }

        // Paid time left on the SAME plan is carried over (renewal paid early).
        let carriedDays = 0;
        if (
          input.carryOverRemainingDays &&
          plan.id === sub.planId &&
          ["active", "cancel_at_period_end"].includes(previousStatus) &&
          sub.planPeriodEnd &&
          sub.planPeriodEnd > now
        ) {
          carriedDays = Math.ceil((sub.planPeriodEnd - now) / DAY_MS);
          end = addDays(end, carriedDays);
        }

        const payment = await tx.payment.create({
          data: {
            tenantId,
            razorpayPaymentId,
            razorpaySignature: "OFFLINE_VERIFIED_BY_ADMIN",
            paymentType: "OFFLINE",
            offlineReference: ref,
            purchaseType: "PLAN",
            planId: plan.id,
            planName: plan.name,
            billingType: input.billingCycle,
            baseAmount: gst.baseAmount,
            gstPercent: gst.gstPercent,
            gstAmount: gst.gstAmount,
            totalAmount: gst.totalAmount,
            currency: "INR",
            paymentMethod: input.paymentMethod,
            status: "SUCCESS",
            paidAt,
          },
        });

        const invoice = await tx.invoice.create({
          data: {
            tenantId,
            invoiceNumber: generateInvoiceNumber(),
            purchaseType: "PLAN",
            planName: plan.name,
            amount: gst.totalAmount,
            billingCycle: input.billingCycle,
            paymentId: payment.id,
            baseAmount: gst.baseAmount,
            gstEnabled: Number(gst.gstAmount) > 0,
            gstPercent: gst.gstPercent,
            gstAmount: gst.gstAmount,
            gstType: settings.gstType ?? "CGST_SGST",
            currency: "INR",
            status: "paid",
            billingPeriodStart: start,
            billingPeriodEnd: end,
            offlineReference: ref,
          },
        });

        const after = await tx.tenantSubscription.update({
          where: { tenantId },
          data: {
            planId: plan.id,
            currentPlan: plan.name,
            billingCycle: input.billingCycle,
            subscriptionStatus: "active",
            planActivatedAt: now,
            planPeriodStart: start,
            planPeriodEnd: end,
            gracePeriodEnd: null,
            graceDebtDays: 0,
            graceDebtPlanPrice: null,
            dataDeletionDate: null,
            cancelRequestedAt: null,
            cancellationReason: null,
            pendingPlanId: null,
            pendingBillingCycle: null,
            autopayEnabled: false,
            ...(["expired", "paused", "payment_failed"].includes(previousStatus)
              ? { reactivatedAt: now }
              : {}),
          },
          select: SUB_FIELDS,
        });

        // Inherited V1 behaviour: offline activation approves tenants still awaiting approval.
        // Never touches ACTIVE/APPROVED, and BLOCKED is rejected above.
        if (["PENDING", "ONBOARDING"].includes(tenant.status)) {
          await tx.tenant.update({ where: { id: tenantId }, data: { status: "APPROVED" } });
        }

        return { tenant, sub, plan, payment, invoice, after, debt, carriedDays, previousStatus };
      },
      { timeout: 20_000, maxWait: 5_000 }
    );
  } catch (err) {
    if (err?.code === "P2002" && String(err.meta?.target ?? "").includes("razorpayPaymentId")) {
      throw new HttpError(409, `paymentRef "${ref}" was already recorded for this tenant`);
    }
    throw err;
  }

  const { tenant, sub, plan, payment, invoice, after, debt, carriedDays } = out;

  // Offline activation supersedes autopay: stop any live mandate so the tenant isn't double-charged.
  if (sub.razorpaySubscriptionId) {
    await rzpCall("cancel", sub.razorpaySubscriptionId, warnings);
  }

  // Invoice PDF + email (failures never undo the activation)
  let pdf = null;
  try {
    pdf = await generateInvoicePDF(invoice, tenant, settings);
    await prisma.invoice.update({ where: { id: invoice.id }, data: { pdfUrl: pdf.fileUrl } });
    await prisma.payment.update({ where: { id: payment.id }, data: { invoiceUrl: pdf.fileUrl } });
  } catch (err) {
    console.warn("[sradmin.subscriptions] invoice PDF failed:", err?.message);
    warnings.push(`INVOICE_PDF_FAILED: ${err?.message}`);
  }

  notify(sendInvoiceEmail, tenant.email, {
    tenantName: tenant.tenantName,
    invoiceNumber: invoice.invoiceNumber,
    amount: Number(gst.totalAmount),
    planName: plan.name,
    periodEnd: fmtDate(after.planPeriodEnd),
    pdfPath: pdf?.filePath,
  });

  await audit(actor, meta, tenant, "PLAN_ACTIVATED",
    `Manually activated "${tenant.tenantName}" on ${plan.name} (${input.billingCycle}) via ${input.paymentMethod}`, {
      reason: input.notes ?? null,
      planId: plan.id,
      planName: plan.name,
      billingCycle: input.billingCycle,
      paymentRef: ref,
      paymentMethod: input.paymentMethod,
      baseAmount: gst.baseAmount,
      totalAmount: gst.totalAmount,
      paymentId: payment.id,
      invoiceNumber: invoice.invoiceNumber,
      previousStatus: out.previousStatus,
      periodEnd: after.planPeriodEnd,
      carriedDays,
      debt,
    });

  return {
    subscription: after,
    payment: { id: payment.id, totalAmount: payment.totalAmount, status: payment.status },
    invoice: { id: invoice.id, invoiceNumber: invoice.invoiceNumber, pdfUrl: pdf?.fileUrl ?? null },
    debt,
    carriedDays,
    warnings,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Pause
// ─────────────────────────────────────────────────────────────────────────────
export const pauseSubscriptionService = async (tenantId, { reason }, actor, meta) => {
  const warnings = [];

  const { tenant, before, after } = await prisma.$transaction(async (tx) => {
    const { tenant, sub } = await loadLocked(tx, tenantId);
    requireSub(sub);
    if (sub.subscriptionStatus === "paused") throw new HttpError(409, "Subscription is already paused");
    assertStatus(sub, PAUSABLE, "pause");
    const after = await tx.tenantSubscription.update({
      where: { tenantId },
      data: { subscriptionStatus: "paused", autopayEnabled: false },
      select: SUB_FIELDS,
    });
    return { tenant, before: sub, after };
  });

  if (before.razorpaySubscriptionId) {
    await rzpCall("pause", before.razorpaySubscriptionId, warnings);
  }

  await audit(actor, meta, tenant, "SUBSCRIPTION_PAUSED",
    `Admin paused "${tenant.tenantName}" subscription`, {
      reason: reason ?? null,
      previousStatus: before.subscriptionStatus,
      planName: before.currentPlan,
    });

  notify(sendSubscriptionPausedEmail, tenant.email, {
    tenantName: tenant.tenantName,
    planName: before.currentPlan ?? "your current plan",
    pauseDuration: "Indefinite",
  });

  return { subscription: after, warnings };
};

// ─────────────────────────────────────────────────────────────────────────────
// Reactivate (paused → resume | cancel_at_period_end → undo | expired → fresh period)
// ─────────────────────────────────────────────────────────────────────────────
export const reactivateSubscriptionService = async (tenantId, input, actor, meta) => {
  const warnings = [];
  const now = new Date();

  // Resume is the one op where Razorpay goes first: the autopay flag follows its result.
  const pre = await peekSubscription(tenantId);
  let razorpayResumed = false;
  if (pre.subscriptionStatus === "paused" && pre.razorpaySubscriptionId) {
    razorpayResumed = await rzpCall("resume", pre.razorpaySubscriptionId, warnings);
  }

  const out = await prisma.$transaction(async (tx) => {
    const { tenant, sub } = await loadLocked(tx, tenantId);
    requireSub(sub);
    const status = sub.subscriptionStatus;

    if (!["paused", "cancel_at_period_end", "expired"].includes(status)) {
      throw new HttpError(
        409,
        `Subscription is "${status}" and already has access. Use extend to add time.`
      );
    }
    if (status !== "expired" && (input.days || input.planId || input.billingCycle || input.activateAs)) {
      throw new HttpError(400, "days / planId / billingCycle / activateAs only apply to expired subscriptions");
    }

    if (status === "paused") {
      const everPaid = await hasEverPaid(tx, tenantId);
      const newStatus = sub.cancelRequestedAt ? "cancel_at_period_end" : everPaid ? "active" : "trialing";
      const after = await tx.tenantSubscription.update({
        where: { tenantId },
        data: {
          subscriptionStatus: newStatus,
          autopayEnabled: razorpayResumed && newStatus === "active",
          dataDeletionDate: null,
          reactivatedAt: now,
        },
        select: SUB_FIELDS,
      });
      return { kind: "RESUMED", tenant, sub, after, newStatus };
    }

    if (status === "cancel_at_period_end") {
      const after = await tx.tenantSubscription.update({
        where: { tenantId },
        data: {
          subscriptionStatus: "active",
          cancelRequestedAt: null,
          cancellationReason: null,
          reactivatedAt: now,
        },
        select: SUB_FIELDS,
      });
      return { kind: "UNCANCELLED", tenant, sub, after, newStatus: "active" };
    }

    // expired → fresh comp period (no payment record)
    let plan;
    if (input.planId) {
      plan = await loadAssignablePlan(tx, input.planId, tenantId);
    } else {
      if (!sub.plan) {
        throw new HttpError(
          409,
          "The tenant's previous plan no longer exists. Pass planId to choose one, or use manual-activate."
        );
      }
      plan = sub.plan; // existing plan may be INACTIVE (discontinued); keeping the customer on it is allowed
    }
    const cycle = input.billingCycle ?? sub.billingCycle;
    const end = input.days ? addDays(now, input.days) : addMonths(now, CYCLE_MONTHS[cycle]);
    const everPaid = await hasEverPaid(tx, tenantId);
    const mode = input.activateAs ?? (everPaid ? "ACTIVE" : "TRIAL");
    const newStatus = mode === "TRIAL" ? "trialing" : "active";

    const after = await tx.tenantSubscription.update({
      where: { tenantId },
      data: {
        planId: plan.id,
        currentPlan: plan.name,
        billingCycle: cycle,
        subscriptionStatus: newStatus,
        planActivatedAt: now,
        planPeriodStart: now,
        planPeriodEnd: end,
        gracePeriodEnd: null,
        graceDebtDays: 0, // admin picked the duration: debt is forgiven
        graceDebtPlanPrice: null,
        dataDeletionDate: null,
        cancelRequestedAt: null,
        cancellationReason: null,
        pendingPlanId: null,
        pendingBillingCycle: null,
        autopayEnabled: false,
        reactivatedAt: now,
      },
      select: SUB_FIELDS,
    });
    return { kind: "REACTIVATED", tenant, sub, after, newStatus, plan, forgivenDebtDays: sub.graceDebtDays };
  });

  const { kind, tenant, sub, after, newStatus } = out;

  await audit(actor, meta, tenant, "SUBSCRIPTION_REACTIVATED",
    `Admin reactivated "${tenant.tenantName}" subscription (${kind})`, {
      kind,
      reason: input.reason ?? null,
      previousStatus: sub.subscriptionStatus,
      newStatus,
      planName: after.currentPlan,
      periodEnd: after.planPeriodEnd,
      forgivenDebtDays: out.forgivenDebtDays ?? 0,
    });

  if (kind === "RESUMED") {
    notify(sendSubscriptionResumedEmail, tenant.email, {
      tenantName: tenant.tenantName,
      planName: after.currentPlan ?? "your plan",
    });
  } else {
    notify(sendReactivationConfirmedEmail, tenant.email, {
      name: tenant.tenantName,
      tenantName: tenant.tenantName,
      planName: after.currentPlan ?? "your plan",
    });
  }

  return { kind, subscription: after, warnings };
};

// ─────────────────────────────────────────────────────────────────────────────
// Expire (immediate)
// ─────────────────────────────────────────────────────────────────────────────
export const expireSubscriptionService = async (tenantId, { reason }, actor, meta) => {
  const warnings = [];
  const now = new Date();
  const settings = await getInvoiceSettings();

  const out = await prisma.$transaction(async (tx) => {
    const { tenant, sub } = await loadLocked(tx, tenantId);
    requireSub(sub);
    if (sub.subscriptionStatus === "expired") throw new HttpError(409, "Subscription is already expired");

    const everPaid = await hasEverPaid(tx, tenantId);

    // Grace debt exists only if the tenant was actually consuming grace.
    let graceDebtDays = 0;
    if (sub.subscriptionStatus === "payment_failed" && sub.planPeriodEnd) {
      const graceDays = sub.gracePeriodDays ?? settings.defaultGraceDays;
      const elapsed = Math.ceil((now - sub.planPeriodEnd) / DAY_MS);
      graceDebtDays = Math.min(Math.max(elapsed, 0), graceDays);
    }
    const graceDebtPlanPrice =
      graceDebtDays > 0 ? monthlyEquivalent(sub.plan, sub.billingCycle) : null;

    const retentionDays = everPaid ? settings.paidRetentionDays : settings.trialRetentionDays;
    const dataDeletionDate = addDays(now, retentionDays);

    const after = await tx.tenantSubscription.update({
      where: { tenantId },
      data: {
        subscriptionStatus: "expired",
        ...(sub.planPeriodEnd && sub.planPeriodEnd > now ? { planPeriodEnd: now } : {}),
        gracePeriodEnd: null,
        graceDebtDays,
        graceDebtPlanPrice,
        autopayEnabled: false,
        dataDeletionDate,
        pendingPlanId: null,
        pendingBillingCycle: null,
      },
      select: SUB_FIELDS,
    });

    const recurringAddOns = await tx.tenantAddOn.findMany({
      where: { tenantId, status: "active", razorpaySubscriptionId: { not: null } },
      select: { id: true, razorpaySubscriptionId: true },
    });

    return { tenant, sub, after, everPaid, retentionDays, graceDebtDays, recurringAddOns };
  });

  const { tenant, sub, after } = out;

  if (sub.razorpaySubscriptionId) {
    await rzpCall("cancel", sub.razorpaySubscriptionId, warnings);
  }
  // Recurring add-ons stop renewing at their own cycle end (base-plan gate comes first, add-ons are preserved).
  for (const addOn of out.recurringAddOns) {
    await rzpCall("cancel", addOn.razorpaySubscriptionId, warnings, { atCycleEnd: true });
  }

  await audit(actor, meta, tenant, "SUBSCRIPTION_EXPIRED",
    `Admin force-expired "${tenant.tenantName}" subscription`, {
      reason,
      previousStatus: sub.subscriptionStatus,
      planName: sub.currentPlan,
      graceDebtDays: out.graceDebtDays,
      retentionDays: out.retentionDays,
      everPaid: out.everPaid,
      dataDeletionDate: after.dataDeletionDate,
      addOnSubscriptionsCancelledAtCycleEnd: out.recurringAddOns.length,
    });

  notify(sendSubscriptionExpiredEmail, tenant.email, {
    tenantName: tenant.tenantName,
    planName: sub.currentPlan ?? "your plan",
    expiredDate: fmtDate(now),
  });

  return {
    subscription: after,
    graceDebtDays: out.graceDebtDays,
    retentionDays: out.retentionDays,
    warnings,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Overrides: limits / grace / free-until
// ─────────────────────────────────────────────────────────────────────────────
export const updateLimitsService = async (tenantId, { limits, reason }, actor, meta) => {
  const { tenant, before, after, changes } = await prisma.$transaction(async (tx) => {
    const { tenant, sub } = await loadLocked(tx, tenantId, { ensure: true });
    const changes = diffObjects(sub.customLimitsOverride ?? {}, limits);
    if (Object.keys(changes).length === 0) return { tenant, before: sub, after: sub, changes };
    const after = await tx.tenantSubscription.update({
      where: { tenantId },
      data: { customLimitsOverride: limits },
      select: SUB_FIELDS,
    });
    return { tenant, before: sub, after, changes };
  });

  const changed = Object.keys(changes).length > 0;
  if (changed) {
    await audit(actor, meta, tenant, "SUBSCRIPTION_LIMITS_UPDATED",
      `Updated custom limit overrides for "${tenant.tenantName}"`, {
        reason: reason ?? null,
        changes,
      });
  }
  return { changed, customLimitsOverride: after.customLimitsOverride ?? {}, changes };
};

export const updateGraceService = async (tenantId, { gracePeriodDays, reason }, actor, meta) => {
  const settings = await getInvoiceSettings();

  const out = await prisma.$transaction(async (tx) => {
    const { tenant, sub } = await loadLocked(tx, tenantId, { ensure: true });
    if (sub.gracePeriodDays === gracePeriodDays) return { tenant, sub, after: sub, changed: false };

    const data = { gracePeriodDays };
    let graceEndExtended = false;
    // A grace already in progress is only ever LENGTHENED by this change.
    if (sub.subscriptionStatus === "payment_failed" && sub.planPeriodEnd && sub.gracePeriodEnd) {
      const candidate = addDays(sub.planPeriodEnd, gracePeriodDays ?? settings.defaultGraceDays);
      if (candidate > sub.gracePeriodEnd) {
        data.gracePeriodEnd = candidate;
        graceEndExtended = true;
      }
    }
    const after = await tx.tenantSubscription.update({
      where: { tenantId },
      data,
      select: SUB_FIELDS,
    });
    return { tenant, sub, after, changed: true, graceEndExtended };
  });

  if (out.changed) {
    await audit(actor, meta, out.tenant, "SUBSCRIPTION_GRACE_UPDATED",
      `Updated grace period for "${out.tenant.tenantName}"`, {
        reason: reason ?? null,
        from: out.sub.gracePeriodDays,
        to: gracePeriodDays,
        platformDefault: settings.defaultGraceDays,
        graceEndExtended: out.graceEndExtended,
        gracePeriodEnd: out.after.gracePeriodEnd,
      });
  }

  return {
    changed: out.changed,
    gracePeriodDays: out.after.gracePeriodDays,
    effectiveGraceDays: out.after.gracePeriodDays ?? settings.defaultGraceDays,
    gracePeriodEnd: out.after.gracePeriodEnd,
    graceEndExtended: out.graceEndExtended ?? false,
  };
};

export const updateFreeUntilService = async (tenantId, { freeUntilDate, reason }, actor, meta) => {
  const next = freeUntilDate ? new Date(freeUntilDate) : null;
  const now = new Date();
  if (next) {
    if (next <= now) throw new HttpError(400, "freeUntilDate must be in the future (send null to clear)");
    if (next > addDays(now, 3650)) throw new HttpError(400, "freeUntilDate cannot be more than 10 years away");
  }

  const out = await prisma.$transaction(async (tx) => {
    const { tenant, sub } = await loadLocked(tx, tenantId, { ensure: true });
    const prev = sub.freeUntilDate ? sub.freeUntilDate.getTime() : null;
    if (prev === (next ? next.getTime() : null)) return { tenant, sub, after: sub, changed: false };
    const after = await tx.tenantSubscription.update({
      where: { tenantId },
      data: { freeUntilDate: next },
      select: SUB_FIELDS,
    });
    return { tenant, sub, after, changed: true };
  });

  if (out.changed) {
    await audit(actor, meta, out.tenant, "SUBSCRIPTION_FREE_UNTIL_UPDATED",
      `Updated free-until date for "${out.tenant.tenantName}"`, {
        reason: reason ?? null,
        from: out.sub.freeUntilDate,
        to: out.after.freeUntilDate,
      });
  }
  return { changed: out.changed, freeUntilDate: out.after.freeUntilDate };
};

// ─────────────────────────────────────────────────────────────────────────────
// Add-on grants (admin)
// ─────────────────────────────────────────────────────────────────────────────
export const grantAddOnService = async (tenantId, { addOnId, quantity, expiresAt, reason }, actor, meta) => {
  const expires = expiresAt ? new Date(expiresAt) : null;
  if (expires && expires <= new Date()) throw new HttpError(400, "expiresAt must be in the future");

  const out = await prisma.$transaction(async (tx) => {
    const { tenant } = await loadLocked(tx, tenantId);
    const addOn = await tx.planAddOn.findUnique({ where: { id: addOnId } });
    if (!addOn) throw new HttpError(404, "Add-on not found");
    if (!addOn.isActive) throw new HttpError(409, `Add-on "${addOn.name}" is inactive`);

    // One-time top-up: credits go straight into the perpetual pool (no TenantAddOn row, no expiry).
    if (addOn.type === "ONE_TIME_TOPUP") {
      if (expires) throw new HttpError(400, "Top-up credits never expire; remove expiresAt.");
      const perUnit = Number(addOn.entitlementValue);
      if (!Number.isInteger(perUnit) || perUnit < 1) {
        throw new HttpError(409, `Top-up "${addOn.name}" is misconfigured (entitlementValue must be a positive integer).`);
      }
      const amount = perUnit * quantity;
      const credits = await grantCredits(tenantId, addOn.entitlementKey, amount, tx);
      return { kind: "TOPUP", tenant, addOn, amount, credits };
    }

    const existing = await tx.tenantAddOn.findFirst({
      where: { tenantId, addOnId, status: "active", source: "ADMIN_GRANT" },
      select: { id: true },
    });
    if (existing) {
      throw new HttpError(409, "An active admin grant of this add-on already exists. Revoke it first (or grant with a higher quantity once revoked).");
    }
    const row = await tx.tenantAddOn.create({
      data: { tenantId, addOnId, status: "active", source: "ADMIN_GRANT", quantity, startsAt: new Date(), expiresAt: expires },
    });
    return { kind: "RECURRING", tenant, addOn, row };
  });

  const { kind, tenant, addOn } = out;

  await audit(actor, meta, tenant, "SUBSCRIPTION_ADDON_GRANTED",
    `Granted ${kind === "TOPUP" ? "top-up" : "add-on"} "${addOn.name}" x${quantity} to "${tenant.tenantName}"`, {
      reason: reason ?? null,
      kind,
      tenantAddOnId: out.row?.id ?? null,
      addOnId,
      addOnKey: addOn.key,
      entitlementKey: addOn.entitlementKey,
      entitlementValue: addOn.entitlementValue,
      quantity,
      expiresAt: expires,
      creditsAdded: out.amount ?? null,
      creditPool: out.credits ?? null,
    });

  const addOnInfo = { id: addOn.id, name: addOn.name, key: addOn.key };
  return kind === "TOPUP"
    ? { kind, addOn: addOnInfo, credits: out.credits }
    : { kind, tenantAddOn: out.row, addOn: addOnInfo };
};

export const revokeAddOnService = async (tenantId, tenantAddOnId, { reason }, actor, meta) => {
  const { tenant, row } = await prisma.$transaction(async (tx) => {
    const { tenant } = await loadLocked(tx, tenantId);
    const found = await tx.tenantAddOn.findFirst({
      where: { id: tenantAddOnId, tenantId },
      include: { addOn: { select: { id: true, name: true, key: true } } },
    });
    if (!found) throw new HttpError(404, "Tenant add-on not found");
    if (found.source !== "ADMIN_GRANT") {
      throw new HttpError(409, "Only admin-granted add-ons can be revoked here. Purchased add-ons are cancelled by the tenant.");
    }
    if (found.status !== "active") throw new HttpError(409, `Add-on is already ${found.status}`);
    const row = await tx.tenantAddOn.update({
      where: { id: found.id },
      data: { status: "cancelled", expiresAt: new Date() },
      include: { addOn: { select: { id: true, name: true, key: true } } },
    });
    return { tenant, row };
  });

  await audit(actor, meta, tenant, "SUBSCRIPTION_ADDON_REVOKED",
    `Revoked granted add-on "${row.addOn.name}" from "${tenant.tenantName}"`, {
      reason: reason ?? null,
      tenantAddOnId: row.id,
      addOnId: row.addOn.id,
      addOnKey: row.addOn.key,
    });

  return { tenantAddOn: row };
};
