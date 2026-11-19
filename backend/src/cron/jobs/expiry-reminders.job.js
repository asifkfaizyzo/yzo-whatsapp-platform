// backend/src/cron/jobs/expiry-reminders.job.js (do not remove this comment)
import cron from "node-cron";
import prisma from "../../config/prisma.js";
import {
  sendExpiryReminderEmail,
  sendTrialExpiringEmail,
  sendGracePeriodEndingEmail,
} from "../../modules/email/index.js";

const PAID_REMINDER_DAYS = [15, 7, 3, 1];
const TRIAL_REMINDER_DAYS = [3, 1];
const GRACE_REMINDER_DAYS = [2, 1];

const getDayRange = (now, daysAhead) => {
  const targetStart = new Date(now);
  targetStart.setDate(targetStart.getDate() + daysAhead);
  targetStart.setHours(0, 0, 0, 0);

  const targetEnd = new Date(targetStart);
  targetEnd.setHours(23, 59, 59, 999);

  return { targetStart, targetEnd };
};

export const processExpiryReminders = async () => {
  console.log("[CRON] Starting V2 subscription, trial & grace reminders check...");
  const now = new Date();
  const dedupeSince = new Date(now.getTime() - 20 * 60 * 60 * 1000);

  try {
    // ── 1. Paid Active Subscription Expiry Reminders (15d, 7d, 3d, 1d) ──
    for (const daysLeft of PAID_REMINDER_DAYS) {
      const { targetStart, targetEnd } = getDayRange(now, daysLeft);
      const reminderType = `EXPIRY_${daysLeft}D`;

      const expiringActiveSubs = await prisma.tenantSubscription.findMany({
        where: {
          subscriptionStatus: "active",
          autopayEnabled: false,
          planPeriodEnd: {
            gte: targetStart,
            lte: targetEnd,
          },
        },
        include: {
          tenant: true,
          plan: true,
        },
      });

      for (const sub of expiringActiveSubs) {
        if (!sub.tenant?.email) continue;

        const existingReminder = await prisma.subscriptionReminder.findFirst({
          where: {
            tenantId: sub.tenantId,
            reminderType,
            sentAt: { gte: dedupeSince },
          },
        });
        if (existingReminder) continue;

        const planName = sub.plan?.name || sub.currentPlan || "Active Plan";

        await sendExpiryReminderEmail({
          toEmail: sub.tenant.email,
          tenantName: sub.tenant.tenantName,
          planName,
          daysLeft,
          expiryDate: sub.planPeriodEnd,
        });

        await prisma.subscriptionReminder.create({
          data: {
            tenantId: sub.tenantId,
            reminderType,
          },
        });
      }
    }

    // ── 2. Free Trial Expiry Reminders (3d, 1d) ──
    for (const daysLeft of TRIAL_REMINDER_DAYS) {
      const { targetStart, targetEnd } = getDayRange(now, daysLeft);
      const reminderType = `TRIAL_EXPIRY_${daysLeft}D`;

      const expiringTrials = await prisma.tenantSubscription.findMany({
        where: {
          subscriptionStatus: "trialing",
          planPeriodEnd: {
            gte: targetStart,
            lte: targetEnd,
          },
        },
        include: {
          tenant: true,
          plan: true,
        },
      });

      for (const sub of expiringTrials) {
        if (!sub.tenant?.email) continue;

        const existingReminder = await prisma.subscriptionReminder.findFirst({
          where: {
            tenantId: sub.tenantId,
            reminderType,
            sentAt: { gte: dedupeSince },
          },
        });
        if (existingReminder) continue;

        const planName = sub.plan?.name || sub.currentPlan || "Free Trial";

        await sendTrialExpiringEmail({
          toEmail: sub.tenant.email,
          tenantName: sub.tenant.tenantName,
          planName,
          daysRemaining: daysLeft,
          trialEndsAt: sub.planPeriodEnd,
        });

        await prisma.subscriptionReminder.create({
          data: {
            tenantId: sub.tenantId,
            reminderType,
          },
        });
      }
    }

    // ── 3. Grace Period Ending Reminders (2d, 1d before gracePeriodEnd) ──
    for (const daysLeft of GRACE_REMINDER_DAYS) {
      const { targetStart, targetEnd } = getDayRange(now, daysLeft);
      const reminderType = `GRACE_ENDING_${daysLeft}D`;

      const endingGraceSubs = await prisma.tenantSubscription.findMany({
        where: {
          subscriptionStatus: "payment_failed",
          gracePeriodEnd: {
            gte: targetStart,
            lte: targetEnd,
          },
        },
        include: {
          tenant: true,
          plan: true,
        },
      });

      for (const sub of endingGraceSubs) {
        if (!sub.tenant?.email) continue;

        const existingReminder = await prisma.subscriptionReminder.findFirst({
          where: {
            tenantId: sub.tenantId,
            reminderType,
            sentAt: { gte: dedupeSince },
          },
        });
        if (existingReminder) continue;

        const planName = sub.plan?.name || sub.currentPlan || "Subscription";

        await sendGracePeriodEndingEmail({
          toEmail: sub.tenant.email,
          tenantName: sub.tenant.tenantName,
          planName,
          daysRemaining: daysLeft,
          gracePeriodEnd: sub.gracePeriodEnd,
        });

        await prisma.subscriptionReminder.create({
          data: {
            tenantId: sub.tenantId,
            reminderType,
          },
        });
      }
    }

    console.log("[CRON] Finished processing V2 expiry & grace reminders.");
  } catch (error) {
    console.error("[CRON] Error processing expiry reminders:", error);
  }
};

// Schedule to run every day at 08:00 AM server time
cron.schedule("0 8 * * *", processExpiryReminders);

export default processExpiryReminders;
