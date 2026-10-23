import cron from 'node-cron';
import prisma from '../config/prisma.js';
import {
  sendSubscriptionExpiredEmail,
  sendDataDeletionWarningEmail
} from '../modules/auth/emailService.js';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendSystemDeletionConfirmation = async (email, companyName) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
    await transporter.sendMail({
      from: `"SudoReply System" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Data Deletion Confirmed - SudoReply',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Workspace Data Deleted</h2>
          <p>Hi ${companyName},</p>
          <p>Under our 90-day subscription expiry policies, your workspace feature configuration and contacts data have been permanently deleted from our servers.</p>
          <p>Please note that your legal billing history and invoice summaries are retained permanently for tax and compliance requirements.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Data deletion confirmation email error:", err);
  }
};

export const checkExpiredSubscriptions = async () => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ── CRON: Starting Subscription & Trial Expiry checks ──`);
  const now = new Date();

  // Task 0: Cleanup abandoned PENDING orders (> 48 hours old)
  try {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const staleResult = await prisma.payment.updateMany({
      where: {
        status: 'PENDING',
        createdAt: { lte: twoDaysAgo },
      },
      data: {
        status: 'FAILED',
      },
    });
    if (staleResult.count > 0) {
      console.log(`[${timestamp}] Cleaned up ${staleResult.count} abandoned PENDING payments`);
    }
  } catch (err) {
    console.error(`[${timestamp}] Task 0 (Stale cleanup) failed:`, err);
  }

  // Task 1: Expire Trials & Subscriptions (Synchronized 24h grace window for Autopay)
  try {
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 3600000);
    const deletionDate = new Date(now.getTime() + 90 * 86400000);

    // Find expired tenants in batches of 100
    const expiredTenants = await prisma.tenant.findMany({
      where: {
        subscriptionStatus: { in: ['trialing', 'active', 'cancel_at_period_end'] },
        OR: [
          // A. Non-autopay tenants whose period has ended
          {
            razorpaySubscriptionId: null,
            planPeriodEnd: { lte: now },
          },
          // B. Autopay tenants past the 24-hour grace window without renewal
          {
            razorpaySubscriptionId: { not: null },
            planPeriodEnd: { lte: twentyFourHoursAgo },
          },
        ]
      },
      take: 100,
    });

    if (expiredTenants.length > 0) {
      console.log(`[${timestamp}] Processing ${expiredTenants.length} expired tenants...`);
      const expiredIds = expiredTenants.map(t => t.id);

      await prisma.tenant.updateMany({
        where: { id: { in: expiredIds } },
        data: {
          subscriptionStatus: 'expired',
          planStatus: 'inactive',
          dataDeletionDate: deletionDate,
        }
      });

      const frontendUrl = process.env.FRONTEND_URLS ? process.env.FRONTEND_URLS.split(',')[1] : 'http://localhost:5174';

      for (const tenant of expiredTenants) {
        try {
          sendSubscriptionExpiredEmail(tenant.email, {
            tenantName: tenant.tenantName || tenant.email,
            expiredDate: now.toLocaleDateString(),
            dataDeletionDate: deletionDate.toLocaleDateString(),
            resubscribeLink: `${frontendUrl}/plans`,
            billingLink: `${frontendUrl}/settings/billing`,
          });
        } catch (emailErr) {
          console.warn(`[${timestamp}] Expiry email failed for ${tenant.email}:`, emailErr.message);
        }
      }
    }
  } catch (err) {
    console.error(`[${timestamp}] Task 1 (Expiry) failed:`, err);
  }

  // Task 2: Deletion Warning (7 days left before permanent deletion)
  try {
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const warningTenants = await prisma.tenant.findMany({
      where: {
        subscriptionStatus: 'expired',
        dataDeletionDate: {
          lte: sevenDaysFromNow,
          gt: new Date(),
        },
      },
      take: 100,
    });

    const frontendUrl = process.env.FRONTEND_URLS ? process.env.FRONTEND_URLS.split(',')[1] : 'http://localhost:5174';

    for (const tenant of warningTenants) {
      try {
        const daysLeft = Math.ceil((new Date(tenant.dataDeletionDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
        sendDataDeletionWarningEmail(tenant.email, {
          tenantName: tenant.tenantName || tenant.email,
          daysLeft: Math.max(1, daysLeft),
          dataDeletionDate: new Date(tenant.dataDeletionDate).toLocaleDateString(),
          reactivateLink: `${frontendUrl}/settings/billing`,
        });
      } catch (innerErr) {
        console.error(`[${timestamp}] Error sending deletion warning to ${tenant.id}:`, innerErr);
      }
    }
  } catch (err) {
    console.error(`[${timestamp}] Task 2 (Deletion Warning) failed:`, err);
  }
};

// Schedule cron to run daily at 00:05 AM
cron.schedule('5 0 * * *', () => {
  checkExpiredSubscriptions();
});

export default checkExpiredSubscriptions;