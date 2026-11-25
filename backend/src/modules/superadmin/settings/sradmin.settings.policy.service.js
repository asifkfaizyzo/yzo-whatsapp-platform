// backend/src/modules/superadmin/settings/sradmin.settings.policy.service.js (do not remove this comment)
import prisma from "../../../config/prisma.js";
import { HttpError } from "../../../lib/utils/http.error.js";
import { logAdminAction, buildChangeSet } from "../../../lib/utils/admin.audit.js";
import { getGSTSettingsService } from "./sradmin.settings.service.js";

const POLICY_FIELDS = ["defaultGraceDays", "trialRetentionDays", "paidRetentionDays"];
const POLICY_SELECT = {
  defaultGraceDays: true,
  trialRetentionDays: true,
  paidRetentionDays: true,
};

/**
 * Reads the subscription policy from the GLOBAL PlatformSettings row.
 * Reuses getGSTSettingsService() to guarantee the row exists (it creates it with
 * its full default set when missing) — so we never guess required columns.
 * Also consumed internally by Phase 4/5 (grace + retention computations).
 */
export const getSubscriptionPolicyService = async () => {
  await getGSTSettingsService();
  return prisma.platformSettings.findUnique({
    where: { id: "GLOBAL" },
    select: POLICY_SELECT,
  });
};

export const updateSubscriptionPolicyService = async (data, actor, meta = {}) => {
  const before = await getSubscriptionPolicyService();
  const merged = { ...before, ...data };

  if (merged.paidRetentionDays < merged.trialRetentionDays) {
    throw new HttpError(
      400,
      "paidRetentionDays cannot be shorter than trialRetentionDays — paying customers must never get less retention than trial users",
    );
  }

  const updateData = {};
  for (const field of POLICY_FIELDS) {
    if (data[field] !== undefined) updateData[field] = data[field];
  }
  if (actor?.id) updateData.updatedBy = actor.id;

  const updated = await prisma.platformSettings.update({
    where: { id: "GLOBAL" },
    data: updateData,
    select: POLICY_SELECT,
  });

  const changes = buildChangeSet(before, updated, POLICY_FIELDS);
  if (Object.keys(changes).length > 0) {
    await logAdminAction(actor, meta, {
      action: "SUBSCRIPTION_POLICY_UPDATED",
      module: "SETTINGS",
      description: `SuperAdmin "${actor?.name}" updated subscription policy (${Object.keys(changes).join(", ")})`,
      metadata: { changes },
    });
  }

  return updated;
};