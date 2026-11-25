// backend/scripts/smoke.3e.entitlements.js (do not remove this comment)
import prisma from "../src/config/prisma.js";
import { consumeQuota, grantCredits, getUsage, getUsageWindow } from "../src/lib/entitlements/usage.service.js";

const tenantId = process.argv[2];
if (!tenantId) {
  console.error("usage: node --env-file=.env scripts/smoke.3e.entitlements.js <tenantId>");
  process.exit(1);
}
const KEY = "maxApiCalls";
const tally = (rs) => ({ ok: rs.filter((r) => r.success).length, denied: rs.filter((r) => !r.success).length });
const burst = (n, count = 1) => Promise.all(Array.from({ length: n }, () => consumeQuota(tenantId, KEY, count)));

const prev = await prisma.tenantSubscription.findUnique({ where: { tenantId }, select: { customLimitsOverride: true } });
try {
  await prisma.tenantSubscription.upsert({
    where: { tenantId },
    update: { customLimitsOverride: { ...(prev?.customLimitsOverride ?? {}), [KEY]: 10 } },
    create: { tenantId, customLimitsOverride: { [KEY]: 10 } },
  });
  await prisma.tenantUsage.deleteMany({ where: { tenantId, key: KEY } });
  await prisma.tenantCreditPool.deleteMany({ where: { tenantId, key: KEY } });

  console.log("25 parallel vs limit 10   ->", tally(await burst(25)), "(expect ok:10 denied:15)");

  await grantCredits(tenantId, KEY, 5);
  console.log("12 parallel, pool of 5    ->", tally(await burst(12)), "(expect ok:5 denied:7)");

  const pool = await prisma.tenantCreditPool.findUnique({ where: { tenantId_key: { tenantId, key: KEY } } });
  console.log("pool row                  ->", { granted: pool.granted, consumed: pool.consumed }, "(expect 5 / 5)");

  const big = await consumeQuota(tenantId, KEY, 3);
  console.log("batch of 3 when empty     ->", big.success, big.reason, "(expect false QUOTA_EXCEEDED)");

  const u = await getUsage(tenantId, KEY);
  console.log("usage                     ->", { used: u.used, baseLimit: u.baseLimit, poolRemaining: u.poolRemaining, remaining: u.remaining, periodStart: u.periodStart, periodEnd: u.periodEnd });
  console.log("window                    ->", getUsageWindow({ planPeriodStart: new Date("2026-01-31T10:00:00Z") }, new Date("2026-03-01T00:00:00Z")), "(expect Feb 28 10:00 -> Mar 31 10:00)");
} finally {
  await prisma.tenantSubscription.updateMany({ where: { tenantId }, data: { customLimitsOverride: prev?.customLimitsOverride ?? {} } });
  await prisma.tenantUsage.deleteMany({ where: { tenantId, key: KEY } });
  await prisma.tenantCreditPool.deleteMany({ where: { tenantId, key: KEY } });
  await prisma.$disconnect();
}