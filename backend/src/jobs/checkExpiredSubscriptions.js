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

const checkExpiredSubscriptions = async () => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ── CRON: Starting Subscription Expiry checks ──`);

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

  // Task 1: Mark expired subscriptions after 3-day grace period
  try {
    const gracePeriodThreshold = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days grace
    const expiredTenants = await prisma.tenant.findMany({
      where: {
        subscriptionStatus: { in: ['active', 'cancel_at_period_end'] },
        planPeriodEnd: { lte: gracePeriodThreshold },
      },
    });

    for (const tenant of expiredTenants) {
      try {
        const deletionDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            subscriptionStatus: 'expired',
            planStatus: 'inactive',
            dataDeletionDate: deletionDate,
          },
        });
        console.log(`[${timestamp}] Tenant ${tenant.id} expired. Deletion set to ${deletionDate.toLocaleDateString()}`);

        const frontendUrl = process.env.FRONTEND_URLS ? process.env.FRONTEND_URLS.split(',')[1] : 'http://localhost:5174';
        sendSubscriptionExpiredEmail(tenant.email, {
          tenantName: tenant.tenantName || tenant.email,
          expiredDate: new Date().toLocaleDateString(),
          dataDeletionDate: deletionDate.toLocaleDateString(),
          resubscribeLink: `${frontendUrl}/plans`,
          billingLink: `${frontendUrl}/settings/billing`,
        });
      } catch (innerErr) {
        console.error(`[${timestamp}] Error expiring tenant ${tenant.id}:`, innerErr);
      }
    }
  } catch (err) {
    console.error(`[${timestamp}] Task 1 failed:`, err);
  }

  // Task 2: Deletion Warning (7 days left)
  try {
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + 7);

    const tenantsNearDeletion = await prisma.tenant.findMany({
      where: {
        subscriptionStatus: 'expired',
        dataDeletionDate: { gte: new Date(), lte: warningDate }
      }
    });

    for (const tenant of tenantsNearDeletion) {
      try {
        const frontendUrl = process.env.FRONTEND_URLS ? process.env.FRONTEND_URLS.split(',')[1] : 'http://localhost:5174';
        sendDataDeletionWarningEmail(tenant.email, {
          tenantName: tenant.tenantName || tenant.email,
          deletionDate: tenant.dataDeletionDate.toLocaleDateString(),
          resubscribeLink: `${frontendUrl}/plans`
        });
      } catch (innerErr) {
        console.error(`[${timestamp}] Error warning tenant ${tenant.id}:`, innerErr);
      }
    }
  } catch (err) {
    console.error(`[${timestamp}] Task 2 failed:`, err);
  }

  // Task 3: Data Purging after 90 days expired
  try {
    const tenantsToDelete = await prisma.tenant.findMany({
      where: {
        subscriptionStatus: 'expired',
        dataDeletionDate: { lte: new Date() }
      }
    });

    for (const tenant of tenantsToDelete) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.conversationActivity.deleteMany({ where: { conversation: { tenantId: tenant.id } } });
          await tx.message.deleteMany({ where: { conversation: { tenantId: tenant.id } } });
          await tx.conversation.deleteMany({ where: { tenantId: tenant.id } });
          await tx.broadcastRecipient.deleteMany({ where: { broadcast: { tenantId: tenant.id } } });
          await tx.broadcastTag.deleteMany({ where: { broadcast: { tenantId: tenant.id } } });
          await tx.broadcast.deleteMany({ where: { tenantId: tenant.id } });
          await tx.template.deleteMany({ where: { tenantId: tenant.id } });
          await tx.contactTagMapping.deleteMany({ where: { contact: { tenantId: tenant.id } } });
          await tx.contact.deleteMany({ where: { tenantId: tenant.id } });
          await tx.userTagMapping.deleteMany({ where: { tenantId: tenant.id } });
          await tx.tag.deleteMany({ where: { tenantId: tenant.id } });
          await tx.ticketMessage.deleteMany({ where: { ticket: { tenantId: tenant.id } } });
          await tx.ticket.deleteMany({ where: { tenantId: tenant.id } });
          await tx.flowNode.deleteMany({ where: { flow: { tenantId: tenant.id } } });
          await tx.keywordTrigger.deleteMany({ where: { tenantId: tenant.id } });
          await tx.flow.deleteMany({ where: { tenantId: tenant.id } });
          await tx.refreshToken.deleteMany({ where: { tenantId: tenant.id } });
          await tx.user.deleteMany({ where: { tenantId: tenant.id } });

          await tx.tenantDataDeletion.create({
            data: {
              tenantId: tenant.id,
              deletedBy: 'system',
              note: 'Auto deleted after 90 day retention period'
            }
          });
        });

        console.log(`[${timestamp}] Data purged for tenant ${tenant.id}`);
        sendSystemDeletionConfirmation(tenant.email, tenant.tenantName || tenant.email);
      } catch (innerErr) {
        console.error(`[${timestamp}] Purge failed for tenant ${tenant.id}:`, innerErr);
      }
    }
  } catch (err) {
    console.error(`[${timestamp}] Task 3 failed:`, err);
  }

  console.log(`[${timestamp}] ── CRON: Finished Expiry checks ──`);
};

cron.schedule('0 0 * * *', checkExpiredSubscriptions);

export { checkExpiredSubscriptions };