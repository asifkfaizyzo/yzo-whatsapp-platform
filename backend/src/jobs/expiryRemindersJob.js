import cron from 'node-cron';
import prisma from '../config/prisma.js';
import { sendExpiryReminderEmail } from '../modules/auth/emailService.js';

const processExpiryReminders = async () => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ── CRON: Starting Expiry Reminders Job ──`);

  try {
    // 1. Find tenants where subscriptionStatus = 'active'
    const activeTenants = await prisma.tenant.findMany({
      where: {
        subscriptionStatus: 'active'
      }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const tenant of activeTenants) {
      try {
        if (!tenant.planPeriodEnd) continue;

        const planEnd = new Date(tenant.planPeriodEnd);
        planEnd.setHours(0, 0, 0, 0);

        // Check if already expired
        if (planEnd.getTime() <= today.getTime()) {
          // Check if expired reminder already sent to prevent duplicate expiry triggers
          const alreadyExpired = await prisma.subscriptionReminder.findFirst({
            where: {
              tenantId: tenant.id,
              reminderType: 'expired'
            }
          });

          if (!alreadyExpired) {
            const dataDeletionDate = new Date(today);
            dataDeletionDate.setDate(dataDeletionDate.getDate() + 90);

            // Update tenant status to expired
            await prisma.tenant.update({
              where: { id: tenant.id },
              data: {
                subscriptionStatus: 'expired',
                dataDeletionDate
              }
            });

            const frontendUrl = process.env.FRONTEND_URLS ? process.env.FRONTEND_URLS.split(',')[1] : 'http://localhost:5174';

            // Send expiry email
            await sendExpiryReminderEmail(tenant.email, 'expiry_reminder_expired', 'Your subscription has expired', {
              tenantName: tenant.tenantName || tenant.email,
              planName: tenant.currentPlan || 'Active Plan',
              expiryDate: tenant.planPeriodEnd.toLocaleDateString(),
              dataDeletionDate: dataDeletionDate.toLocaleDateString(),
              resubscribeLink: `${frontendUrl}/plans`
            });

            // Create reminder record
            await prisma.subscriptionReminder.create({
              data: {
                tenantId: tenant.id,
                reminderType: 'expired'
              }
            });

            console.log(`[${timestamp}] Tenant ${tenant.id} marked as expired. Data deletion scheduled for ${dataDeletionDate.toLocaleDateString()}`);
          }
          continue;
        }

        // Calculate daysRemaining
        const diffTime = planEnd.getTime() - today.getTime();
        const daysRemaining = Math.round(diffTime / (1000 * 60 * 60 * 24));

        let reminderType = null;
        let emailSubject = '';
        let templateName = '';

        if (daysRemaining === 15) {
          reminderType = '15_days_before';
          emailSubject = 'Your plan expires in 15 days';
          templateName = 'expiry_reminder_15';
        } else if (daysRemaining === 7) {
          reminderType = '7_days_before';
          emailSubject = '7 days left on your subscription';
          templateName = 'expiry_reminder_7';
        } else if (daysRemaining === 3) {
          reminderType = '3_days_before';
          emailSubject = 'Only 3 days left to renew';
          templateName = 'expiry_reminder_3';
        } else if (daysRemaining === 1) {
          reminderType = '1_day_before';
          emailSubject = 'Last chance — expires tomorrow';
          templateName = 'expiry_reminder_1';
        }

        if (reminderType) {
          // Check if already sent
          const alreadySent = await prisma.subscriptionReminder.findFirst({
            where: {
              tenantId: tenant.id,
              reminderType
            }
          });

          if (!alreadySent) {
            const frontendUrl = process.env.FRONTEND_URLS ? process.env.FRONTEND_URLS.split(',')[1] : 'http://localhost:5174';

            // Send reminder email
            await sendExpiryReminderEmail(tenant.email, templateName, emailSubject, {
              tenantName: tenant.tenantName || tenant.email,
              planName: tenant.currentPlan || 'Active Plan',
              expiryDate: tenant.planPeriodEnd.toLocaleDateString(),
              renewLink: `${frontendUrl}/plans`
            });

            // Create SubscriptionReminder record
            await prisma.subscriptionReminder.create({
              data: {
                tenantId: tenant.id,
                reminderType
              }
            });

            console.log(`[${timestamp}] Sent ${reminderType} reminder to tenant ${tenant.id}`);
          }
        }
      } catch (innerErr) {
        console.error(`[${timestamp}] Error processing tenant ${tenant.id}:`, innerErr);
      }
    }
  } catch (err) {
    console.error(`[${timestamp}] Expiry Reminders Job failed:`, err);
  }

  console.log(`[${timestamp}] ── CRON: Finished Expiry Reminders Job ──`);
};

// Schedule: Run every day at 9:00 AM ('0 9 * * *')
cron.schedule('0 9 * * *', processExpiryReminders);

export { processExpiryReminders };
