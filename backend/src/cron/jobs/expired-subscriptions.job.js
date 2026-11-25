// backend/src/cron/jobs/expired-subscriptions.job.js (do not remove this comment)
import cron from "node-cron";
import prisma from "../../config/prisma.js";
import { getMonthlyEquivalentPrice } from "../../lib/billingPeriod.js";
import {
  sendSubscriptionExpiredEmail,
  sendDataDeletionWarningEmail,
  sendGracePeriodStartedEmail,
  sendAccountBlockedEmail,
  sendScheduledPlanChangeCancelledEmail,
} from "../../modules/email/index.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Checks whether a scheduled target plan is still active and purchasable by this tenant (Decision 63).
 */
const isPlanValidForScheduledSwitch = (plan, tenantId) => {
  if (!plan || plan.status !== "ACTIVE") return false;
  if (plan.planType === "CUSTOM") {
    return plan.customTenantId === tenantId;
  }
  if (plan.visibility === "ADMIN_ONLY") return false;
  return true;
};

/**
 * Checks whether a subscription has active complimentary access via freeUntilDate.
 */
const hasActiveFreeUntil = (sub, now) =>
  Boolean(sub.freeUntilDate && new Date(sub.freeUntilDate) > now);

/**
 * Daily Subscription Lifecycle Job (runs at 00:05 AM):
 * 1. Marks abandoned PENDING payments (>48h) as FAILED.
 * 2. Expires recurring TenantAddOns whose expiresAt <= now.
 * 3. Evaluates scheduled plan changes (pendingPlanId) at planPeriodEnd (Decision 63).
 * 4. Transitions unpaid active subscriptions reaching planPeriodEnd into grace period (payment_failed).
 * 5. Transitions expired trials, cancelled plans, and exhausted grace periods into expired status,
 *    calculates graceDebtDays, sets dataDeletionDate (7d trial vs 90d paid from PlatformSettings),
 *    and marks recurring add-ons as cancel_at_period_end / expired.
 * 6. Sends data deletion warning emails (7d and 2d before dataDeletionDate).
 */
export const checkExpiredSubscriptions = async () => {
  console.log("[CRON] Starting V2 expired subscriptions lifecycle check...");
  const now = new Date();

  try {
    const settings = await prisma.platformSettings.findFirst();
    const defaultGraceDays = settings?.defaultGraceDays ?? 7;
    const trialRetentionDays = settings?.trialRetentionDays ?? 7;
    const paidRetentionDays = settings?.paidRetentionDays ?? 90;

    // ── Step 0: Clean up stale PENDING payments (> 48 hours old) ──
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const stalePayments = await prisma.payment.updateMany({
      where: {
        status: "PENDING",
        createdAt: { lte: fortyEightHoursAgo },
      },
      data: { status: "FAILED" },
    });
    if (stalePayments.count > 0) {
      console.log(
        `[CRON] Marked ${stalePayments.count} stale PENDING payments (>48h) as FAILED.`,
      );
    }

    // ── Step 0.5: Expire recurring TenantAddOn rows past their expiresAt ──
    const expiredAddOns = await prisma.tenantAddOn.updateMany({
      where: {
        status: { in: ["active", "cancel_at_period_end"] },
        expiresAt: { not: null, lte: now },
      },
      data: { status: "expired" },
    });
    if (expiredAddOns.count > 0) {
      console.log(
        `[CRON] Marked ${expiredAddOns.count} TenantAddOn record(s) as expired.`,
      );
    }

    // ── Step 1: Scheduled Plan Changes (pendingPlanId at planPeriodEnd <= now) — Decision 63 ──
    const scheduledSubs = await prisma.tenantSubscription.findMany({
      where: {
        pendingPlanId: { not: null },
        planPeriodEnd: { lte: now },
        subscriptionStatus: { in: ["active", "trialing"] },
      },
      include: {
        tenant: true,
        plan: true,
        pendingPlan: true,
      },
    });

    for (const sub of scheduledSubs) {
      const targetPlan = sub.pendingPlan;
      const currentPlanName = sub.plan?.name || sub.currentPlan || "Current Plan";

      if (!isPlanValidForScheduledSwitch(targetPlan, sub.tenantId)) {
        // Target plan was archived/discontinued -> cancel scheduled change, keep current plan
        await prisma.tenantSubscription.update({
          where: { tenantId: sub.tenantId },
          data: {
            pendingPlanId: null,
            pendingBillingCycle: null,
          },
        });

        console.log(
          `[CRON] Cancelled scheduled plan change for tenant ${sub.tenantId} (target plan "${targetPlan?.name || sub.pendingPlanId}" is no longer active).`,
        );

        if (sub.tenant?.email) {
          sendScheduledPlanChangeCancelledEmail({
            toEmail: sub.tenant.email,
            tenantName: sub.tenant.tenantName,
            currentPlanName,
            cancelledPlanName: targetPlan?.name || "Scheduled Plan",
            reason:
              "The scheduled plan was discontinued or is no longer available for self-serve renewal. Your subscription remains on your current plan.",
          }).catch((err) =>
            console.error(
              `[CRON] Failed to send scheduledPlanChangeCancelledEmail to ${sub.tenant.email}:`,
              err.message,
            ),
          );
        }
      } else {
        // Apply the scheduled target plan & cycle onto the subscription before renewal/grace evaluation
        const nextCycle = sub.pendingBillingCycle || sub.billingCycle || "MONTHLY";
        await prisma.tenantSubscription.update({
          where: { tenantId: sub.tenantId },
          data: {
            planId: targetPlan.id,
            currentPlan: targetPlan.name,
            billingCycle: nextCycle,
            pendingPlanId: null,
            pendingBillingCycle: null,
          },
        });
        console.log(
          `[CRON] Applied scheduled plan switch for tenant ${sub.tenantId} -> ${targetPlan.name} (${nextCycle}).`,
        );
      }
    }

    // ── Step 2: Paid Active Subscriptions Reaching planPeriodEnd -> Enter Grace Period (payment_failed) ──
    const activeDueSubs = await prisma.tenantSubscription.findMany({
      where: {
        subscriptionStatus: "active",
        planPeriodEnd: { lte: now },
        cancelRequestedAt: null,
      },
      include: {
        tenant: true,
        plan: true,
      },
    });

    let enteredGraceCount = 0;

    for (const sub of activeDueSubs) {
      if (hasActiveFreeUntil(sub, now)) continue;

      const graceDays = sub.gracePeriodDays ?? defaultGraceDays;
      if (graceDays <= 0) continue; // Will be expired immediately in Step 3

      const gracePeriodEnd = new Date(now.getTime() + graceDays * DAY_MS);
      const monthlyEquivPrice = sub.plan
        ? getMonthlyEquivalentPrice(sub.plan, sub.billingCycle)
        : sub.graceDebtPlanPrice ?? null;

      await prisma.tenantSubscription.update({
        where: { tenantId: sub.tenantId },
        data: {
          subscriptionStatus: "payment_failed",
          gracePeriodEnd,
          graceDebtPlanPrice: monthlyEquivPrice,
        },
      });

      enteredGraceCount++;

      if (sub.tenant?.email) {
        sendGracePeriodStartedEmail({
          toEmail: sub.tenant.email,
          tenantName: sub.tenant.tenantName,
          planName: sub.plan?.name || sub.currentPlan || "Subscription",
          graceDays,
          gracePeriodEnd,
        }).catch((err) =>
          console.error(
            `[CRON] Failed to send gracePeriodStartedEmail to ${sub.tenant.email}:`,
            err.message,
          ),
        );
      }
    }

    if (enteredGraceCount > 0) {
      console.log(
        `[CRON] Transitioned ${enteredGraceCount} subscription(s) into grace period (payment_failed).`,
      );
    }

    // ── Step 3: Subscriptions Ready to Expire (trialing / cancelled / cancel-at-period-end / exhausted grace) ──
    const expirableCandidates = await prisma.tenantSubscription.findMany({
      where: {
        OR: [
          {
            subscriptionStatus: { in: ["trialing", "cancelled"] },
            planPeriodEnd: { lte: now },
          },
          {
            subscriptionStatus: "active",
            planPeriodEnd: { lte: now },
          },
          {
            subscriptionStatus: "payment_failed",
            OR: [
              { gracePeriodEnd: { lte: now } },
              { gracePeriodEnd: null, planPeriodEnd: { lte: now } },
            ],
          },
        ],
      },
      include: {
        tenant: true,
        plan: true,
      },
    });

    let expiredCount = 0;

    for (const sub of expirableCandidates) {
      if (hasActiveFreeUntil(sub, now)) continue;

      // Double-check active subscriptions: only expire here if cancelRequestedAt is set or graceDays <= 0
      const graceDays = sub.gracePeriodDays ?? defaultGraceDays;
      if (
        sub.subscriptionStatus === "active" &&
        !sub.cancelRequestedAt &&
        graceDays > 0
      ) {
        continue;
      }

      const wasInGrace = sub.subscriptionStatus === "payment_failed";

      // Check if tenant has ever paid to decide 90-day vs 7-day data retention
      const paidPaymentCount = await prisma.payment.count({
        where: { tenantId: sub.tenantId, status: "SUCCESS" },
      });
      const everPaid = paidPaymentCount > 0;
      const retentionDays = everPaid ? paidRetentionDays : trialRetentionDays;
      const deletionDate =
        sub.dataDeletionDate || new Date(now.getTime() + retentionDays * DAY_MS);

      // Calculate accumulated grace debt days if expiring out of grace period
      let updatedGraceDebtDays = sub.graceDebtDays || 0;
      if (wasInGrace && sub.planPeriodEnd) {
        const graceEndRef = sub.gracePeriodEnd
          ? Math.min(now.getTime(), new Date(sub.gracePeriodEnd).getTime())
          : now.getTime();
        const graceElapsedMs =
          graceEndRef - new Date(sub.planPeriodEnd).getTime();
        const daysInGrace = Math.max(1, Math.ceil(graceElapsedMs / DAY_MS));
        updatedGraceDebtDays += daysInGrace;
      }

      const snapshotPrice =
        sub.graceDebtPlanPrice ??
        (sub.plan
          ? getMonthlyEquivalentPrice(sub.plan, sub.billingCycle)
          : null);

      await prisma.$transaction(async (tx) => {
        await tx.tenantSubscription.update({
          where: { tenantId: sub.tenantId },
          data: {
            subscriptionStatus: "expired",
            gracePeriodEnd: null,
            graceDebtDays: updatedGraceDebtDays,
            graceDebtPlanPrice: snapshotPrice,
            pendingPlanId: null,
            pendingBillingCycle: null,
            dataDeletionDate: deletionDate,
          },
        });

        // Recurring add-ons stop renewing when base subscription expires
        await tx.tenantAddOn.updateMany({
          where: {
            tenantId: sub.tenantId,
            status: "active",
          },
          data: {
            status: "cancel_at_period_end",
          },
        });
      });

      expiredCount++;

      const planLabel = sub.plan?.name || sub.currentPlan || "Subscription";
      if (sub.tenant?.email) {
        if (wasInGrace) {
          sendAccountBlockedEmail({
            toEmail: sub.tenant.email,
            tenantName: sub.tenant.tenantName,
            planName: planLabel,
            graceDebtDays: updatedGraceDebtDays,
            dataDeletionDate: deletionDate,
          }).catch((err) =>
            console.error(
              `[CRON] Failed to send accountBlockedEmail to ${sub.tenant.email}:`,
              err.message,
            ),
          );
        } else {
          sendSubscriptionExpiredEmail({
            toEmail: sub.tenant.email,
            tenantName: sub.tenant.tenantName,
            planName: planLabel,
            deletionDate,
            retentionDays,
          }).catch((err) =>
            console.error(
              `[CRON] Failed to send subscriptionExpiredEmail to ${sub.tenant.email}:`,
              err.message,
            ),
          );
        }
      }
    }

    console.log(
      `[CRON] Marked ${expiredCount} subscription(s) as expired.`,
    );

    // ── Step 4: Data Deletion Warnings (7 days & 2 days before dataDeletionDate) ──
    const expiredWithDeletion = await prisma.tenantSubscription.findMany({
      where: {
        subscriptionStatus: "expired",
        dataDeletionDate: { gt: now },
      },
      include: { tenant: true },
    });

    for (const sub of expiredWithDeletion) {
      if (!sub.tenant?.email || !sub.dataDeletionDate) continue;

      const diffMs = new Date(sub.dataDeletionDate).getTime() - now.getTime();
      const daysUntilDeletion = Math.ceil(diffMs / DAY_MS);

      if (daysUntilDeletion !== 7 && daysUntilDeletion !== 2) continue;

      const reminderType = `DELETE_WARN_${daysUntilDeletion}D`;
      const recentWindow = new Date(now.getTime() - 20 * 60 * 60 * 1000);

      const alreadySent = await prisma.subscriptionReminder.findFirst({
        where: {
          tenantId: sub.tenantId,
          reminderType,
          sentAt: { gte: recentWindow },
        },
      });
      if (alreadySent) continue;

      await prisma.subscriptionReminder.create({
        data: {
          tenantId: sub.tenantId,
          reminderType,
        },
      });

      sendDataDeletionWarningEmail({
        toEmail: sub.tenant.email,
        tenantName: sub.tenant.tenantName,
        deletionDate: sub.dataDeletionDate,
        daysLeft: daysUntilDeletion,
      }).catch((err) =>
        console.error(
          `[CRON] Failed to send dataDeletionWarningEmail to ${sub.tenant.email}:`,
          err.message,
        ),
      );
    }
  } catch (error) {
    console.error("[CRON] Error checking expired subscriptions:", error);
  }
};

// Schedule to run every day at 00:05 AM server time
cron.schedule("5 0 * * *", checkExpiredSubscriptions);

export default checkExpiredSubscriptions;
