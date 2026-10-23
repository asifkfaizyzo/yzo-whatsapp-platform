// backend/prisma/scripts/migrateExistingTenants.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function migrateExistingTenants() {
  console.log("🔄 Running intelligent post-migration data script for existing tenants...");

  // 1. Mark all existing active, cancelling, and expired tenants as hasUsedTrial: true
  const res1 = await prisma.tenant.updateMany({
    where: {
      subscriptionStatus: { in: ['active', 'cancel_at_period_end', 'expired'] },
      hasUsedTrial: false,
    },
    data: { hasUsedTrial: true }
  });
  console.log(`✅ Marked ${res1.count} existing active/expired tenants as hasUsedTrial: true`);

  // 2. Mark tenants registered > 14 days ago as hasUsedTrial: true
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const res2 = await prisma.tenant.updateMany({
    where: {
      hasUsedTrial: false,
      createdAt: { lt: fourteenDaysAgo },
    },
    data: { hasUsedTrial: true }
  });
  console.log(`✅ Marked ${res2.count} old trialing tenants as hasUsedTrial: true`);

  // 3. Intelligent planPeriodEnd derivation for active tenants lacking one:
  const activeTenantsWithoutPeriod = await prisma.tenant.findMany({
    where: {
      subscriptionStatus: 'active',
      planPeriodEnd: null,
    },
    include: {
      payments: {
        where: { status: 'SUCCESS' },
        orderBy: { paidAt: 'desc' },
        take: 1,
      }
    }
  });

  let derivedFromPaymentCount = 0;
  let fallbackCount = 0;

  for (const tenant of activeTenantsWithoutPeriod) {
    const latestPayment = tenant.payments[0];

    if (latestPayment && latestPayment.paidAt) {
      const isAnnual = latestPayment.billingType === 'annual';
      const durationMs = isAnnual ? 365 * 86400000 : 30 * 86400000;
      const periodStart = new Date(latestPayment.paidAt);
      const periodEnd = new Date(periodStart.getTime() + durationMs);

      await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          planPeriodStart: periodStart,
          planPeriodEnd: periodEnd > new Date() ? periodEnd : new Date(Date.now() + 30 * 86400000),
        }
      });
      derivedFromPaymentCount++;
    } else {
      // Fallback default: 30 days from today (can be adjusted by admin in UI)
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          planPeriodStart: new Date(),
          planPeriodEnd: new Date(Date.now() + 30 * 86400000),
        }
      });
      fallbackCount++;
    }
  }

  console.log(`✅ Set planPeriodEnd: ${derivedFromPaymentCount} derived from payment records, ${fallbackCount} set to default 30 days.`);
  console.log("🎉 Data migration completed successfully!");
}

migrateExistingTenants()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
