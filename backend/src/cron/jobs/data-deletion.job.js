// backend/src/cron/jobs/data-deletion.job.js (do not remove this comment)
import cron from "node-cron";
import fs from "fs/promises";
import path from "path";
import prisma from "../../config/prisma.js";
import { normalizeMediaUrl } from "../../lib/entitlements/storage.service.js";
import { purgeTenantWorkspaceData } from "../../utils/tenantDeletion.js";
import {
  sendTrialDeletedEmail,
  sendSystemDeletionConfirmation,
} from "../../modules/email/index.js";

const SOFT_DELETED_MEDIA_RETENTION_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Resolves a stored media URL ("uploads/tenants/..." or "/uploads/tenants/...")
 * to a safe local filesystem path under "uploads/tenants/". Returns null for external URLs.
 */
const resolveLocalMediaPath = (url) => {
  const normalized = normalizeMediaUrl(url);
  if (!normalized.startsWith("uploads/tenants/")) return null;
  return path.resolve(normalized);
};

/**
 * Checks whether any OTHER active (non-deleted) Message, QuickReply, or MediaAsset
 * still references the same normalized URL for this tenant.
 */
const isMediaUrlStillReferenced = async (tenantId, normalizedUrl) => {
  const withLeadingSlash = `/${normalizedUrl}`;
  const variants = [normalizedUrl, withLeadingSlash];

  const [activeMessageCount, quickReplyCount, activeAssetCount] =
    await Promise.all([
      prisma.message.count({
        where: {
          conversation: { tenantId },
          isDeleted: false,
          mediaUrl: { in: variants },
          mediaSize: { not: null },
        },
      }),
      prisma.quickReply.count({
        where: {
          tenantId,
          mediaUrl: { in: variants },
          mediaSize: { not: null },
        },
      }),
      prisma.mediaAsset.count({
        where: {
          tenantId,
          url: { in: variants },
          deletedAt: null,
        },
      }),
    ]);

  return activeMessageCount + quickReplyCount + activeAssetCount > 0;
};

/**
 * Job 1: Purges workspace data & media files for expired tenants whose dataDeletionDate <= now.
 */
export const purgeExpiredTenantsPastRetention = async (now = new Date()) => {
  const dueSubscriptions = await prisma.tenantSubscription.findMany({
    where: {
      subscriptionStatus: "expired",
      dataDeletionDate: {
        not: null,
        lte: now,
      },
    },
    include: {
      tenant: true,
      plan: true,
    },
  });

  if (dueSubscriptions.length === 0) return { purgedTenants: 0 };

  let purgedTenants = 0;

  for (const sub of dueSubscriptions) {
    try {
      const paidCount = await prisma.payment.count({
        where: { tenantId: sub.tenantId, status: "SUCCESS" },
      });
      const everPaid = paidCount > 0;

      await purgeTenantWorkspaceData([sub.tenantId], {
        deletedBy: "system_retention_cron",
        note: everPaid
          ? "Automatic workspace purge after paid retention window"
          : "Automatic workspace purge after free trial retention window",
      });

      purgedTenants++;

      if (sub.tenant?.email) {
        if (everPaid) {
          sendSystemDeletionConfirmation({
            toEmail: sub.tenant.email,
            tenantName: sub.tenant.tenantName,
          }).catch((err) =>
            console.error(
              `[CRON] Failed to send systemDeletionConfirmation to ${sub.tenant.email}:`,
              err.message,
            ),
          );
        } else {
          sendTrialDeletedEmail({
            toEmail: sub.tenant.email,
            tenantName: sub.tenant.tenantName,
            planName: sub.plan?.name || sub.currentPlan || "Free Trial",
          }).catch((err) =>
            console.error(
              `[CRON] Failed to send trialDeletedEmail to ${sub.tenant.email}:`,
              err.message,
            ),
          );
        }
      }
    } catch (err) {
      console.error(
        `[CRON] Error purging workspace data for expired tenant ${sub.tenantId}:`,
        err,
      );
    }
  }

  console.log(
    `[CRON] Purged workspace data & media for ${purgedTenants} expired tenant(s) past dataDeletionDate.`,
  );
  return { purgedTenants };
};

/**
 * Job 2: Hard-deletes soft-deleted Message media and MediaAsset rows older than 14 days,
 * removing physical files from disk and reclaiming tenant storage quota.
 */
export const purgeSoftDeletedMedia = async (now = new Date()) => {
  const cutoff = new Date(
    now.getTime() - SOFT_DELETED_MEDIA_RETENTION_DAYS * DAY_MS,
  );

  let purgedMessages = 0;
  let purgedAssets = 0;

  // ── Part A: Soft-deleted Messages with media older than 14 days ──
  const expiredMessages = await prisma.message.findMany({
    where: {
      isDeleted: true,
      deletedAt: { not: null, lte: cutoff },
      OR: [{ mediaUrl: { not: null } }, { mediaSize: { not: null } }],
    },
    select: {
      id: true,
      mediaUrl: true,
      conversation: { select: { tenantId: true } },
    },
    take: 1000,
  });

  for (const msg of expiredMessages) {
    const tenantId = msg.conversation?.tenantId;
    const normalizedUrl = msg.mediaUrl ? normalizeMediaUrl(msg.mediaUrl) : null;

    // Null out mediaUrl & mediaSize first so reference checks see this message as released
    await prisma.message.update({
      where: { id: msg.id },
      data: { mediaUrl: null, mediaSize: null },
    });
    purgedMessages++;

    if (tenantId && normalizedUrl) {
      const localPath = resolveLocalMediaPath(normalizedUrl);
      if (localPath) {
        const stillUsed = await isMediaUrlStillReferenced(
          tenantId,
          normalizedUrl,
        );
        if (!stillUsed) {
          await fs.unlink(localPath).catch(() => {});
        }
      }
    }
  }

  // ── Part B: Soft-deleted MediaAsset rows (Flow media, Template headers) older than 14 days ──
  const expiredAssets = await prisma.mediaAsset.findMany({
    where: {
      deletedAt: { not: null, lte: cutoff },
    },
    take: 1000,
  });

  for (const asset of expiredAssets) {
    const normalizedUrl = normalizeMediaUrl(asset.url);

    await prisma.mediaAsset.delete({
      where: { id: asset.id },
    });
    purgedAssets++;

    const localPath = resolveLocalMediaPath(normalizedUrl);
    if (localPath) {
      const stillUsed = await isMediaUrlStillReferenced(
        asset.tenantId,
        normalizedUrl,
      );
      if (!stillUsed) {
        await fs.unlink(localPath).catch(() => {});
      }
    }
  }

  if (purgedMessages > 0 || purgedAssets > 0) {
    console.log(
      `[CRON] 14-day media purge removed ${purgedMessages} soft-deleted message media record(s) and ${purgedAssets} MediaAsset row(s).`,
    );
  }

  return { purgedMessages, purgedAssets };
};

export const runDataDeletionJob = async () => {
  console.log("[CRON] Starting V2 data deletion & 14-day media purge job...");
  const now = new Date();
  try {
    await purgeExpiredTenantsPastRetention(now);
    await purgeSoftDeletedMedia(now);
  } catch (error) {
    console.error("[CRON] Error in data deletion & media purge job:", error);
  }
};

// Schedule to run every day at 02:00 AM server time
cron.schedule("0 2 * * *", runDataDeletionJob);

export default runDataDeletionJob;
