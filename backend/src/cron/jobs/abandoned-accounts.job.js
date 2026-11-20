// backend/src/cron/jobs/abandoned-accounts.job.js (do not remove this comment)
import prisma from "../../config/prisma.js";
import { deleteTenantsCompletely } from "../../utils/tenantDeletion.js";

// Configuration
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // Run once every 24 hours
const ABANDONMENT_THRESHOLD_HOURS = 360; // Delete accounts abandoned for > 15 days

const cleanAbandonedAccounts = async () => {
  try {
    const thresholdDate = new Date(
      Date.now() - ABANDONMENT_THRESHOLD_HOURS * 60 * 60 * 1000,
    );

    // Find abandoned accounts that have zero payments/invoices and never activated
    const abandonedTenants = await prisma.tenant.findMany({
      where: {
        AND: [
          {
            OR: [
              { isEmailVerified: false },
              {
                status: "PENDING",
                OR: [
                  { subscription: { is: null } },
                  { subscription: { subscriptionStatus: "expired" } },
                ],
              },
            ],
          },
          {
            updatedAt: {
              lt: thresholdDate,
            },
          },
          {
            payments: {
              none: {},
            },
          },
          {
            invoices: {
              none: {},
            },
          },
        ],
      },
      select: { id: true, email: true, tenantName: true },
    });

    if (abandonedTenants.length === 0) return;

    const tenantIds = abandonedTenants.map((t) => t.id);

    await deleteTenantsCompletely(tenantIds);

    console.log(
      `🧹 [Cleanup Worker] Removed ${abandonedTenants.length} abandoned/unverified tenant accounts:`,
      abandonedTenants.map((t) => t.email).join(", "),
    );
  } catch (error) {
    console.error(
      "❌ [Cleanup Worker] Error cleaning abandoned accounts:",
      error,
    );
  }
};

export const startCleanupWorker = () => {
  console.log(
    "🕒 [Cleanup Worker] Initialized. Scanning for abandoned accounts every 24h.",
  );
  setInterval(cleanAbandonedAccounts, CLEANUP_INTERVAL);
  setTimeout(cleanAbandonedAccounts, 5000);
};