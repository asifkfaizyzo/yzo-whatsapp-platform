import cron from 'node-cron';
import prisma from '../config/prisma.js';
import { sendExpiryReminderEmail } from '../modules/auth/emailService.js';

const processExpiryReminders = async () => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ── CRON: Starting Expiry Reminders Job ──`);

  try {
    // 1. Find tenants who are active or trialing
    const activeTenants = await prisma.tenant.findMany({
      where: {
        subscriptionStatus: { in: ['active', 'trialing', 'cancel_at_period_end'] }
      }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const tenant of activeTenants) {
      try {
        if (!tenant.planPeriodEnd) continue;

        const planEnd = new Date(tenant.planPeriodEnd);
        planEnd.setHours(0, 0, 0, 0);

        // Calculate daysRemaining
        const diffTime = planEnd.getTime() - today.getTime();
        const daysRemaining = Math.round(diffTime / (1000 * 60 * 60 * 24));

        let reminderType = null;
        let emailSubject = '';
        let templateName = '';

        const isTrialing = tenant.subscriptionStatus === 'trialing';

        if (daysRemaining === 15 && !isTrialing) {
          reminderType = '15_days_before';
          emailSubject = 'Your plan expires in 15 days';
          templateName = 'expiry_reminder_15';
        } else if (daysRemaining === 7 && !isTrialing) {
          reminderType = '7_days_before';
          emailSubject = '7 days left on your subscription';
          templateName = 'expiry_reminder_7';
        } else if (daysRemaining === 3) {
          reminderType = '3_days_before';
          emailSubject = isTrialing ? 'Your 14-day free trial ends in 3 days' : 'Only 3 days left to renew';
          templateName = 'expiry_reminder_3';
        } else if (daysRemaining === 1) {
          reminderType = '1_day_before';
          emailSubject = isTrialing ? 'Your free trial ends tomorrow' : 'Last chance — expires tomorrow';
          templateName = 'expiry_reminder_1';
        }

        if (reminderType) {
          // Check if reminder was already recorded for this period
          const existingReminder = await prisma.subscriptionReminder.findFirst({
            where: {
              tenantId: tenant.id,
              reminderType,
              createdAt: {
                gte: new Date(Date.now() - 48 * 3600000)
              }
            }
          });

          if (!existingReminder) {
            const frontendUrl = process.env.FRONTEND_URLS ? process.env.FRONTEND_URLS.split(',')[1] : 'http://localhost:5174';

            await sendExpiryReminderEmail(tenant.email, templateName, emailSubject, {
              tenantName: tenant.tenantName || tenant.email,
              planName: tenant.currentPlan || 'Active Plan',
              expiryDate: tenant.planPeriodEnd.toLocaleDateString(),
              daysRemaining,
              isTrialing,
              autopayEnabled: tenant.autopayEnabled,
              billingLink: `${frontendUrl}/settings/billing`,
              resubscribeLink: `${frontendUrl}/plans`
            });

            await prisma.subscriptionReminder.create({
              data: {
                tenantId: tenant.id,
                reminderType,
              }
            });

            console.log(`[${timestamp}] Sent ${reminderType} reminder to tenant ${tenant.id} (${tenant.email})`);
          }
        }
      } catch (innerErr) {
        console.error(`[${timestamp}] Error processing tenant ${tenant.id}:`, innerErr);
      }
    }
  } catch (err) {
    console.error(`[${timestamp}] Expiry reminders job failed:`, err);
  }
};

// Schedule cron to run daily at 08:00 AM
cron.schedule('0 8 * * *', () => {
  processExpiryReminders();
});

export default processExpiryReminders;
