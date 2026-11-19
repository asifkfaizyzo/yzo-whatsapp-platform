thinking
Let's review all files we are delivering in Phase 5D and make sure we strictly follow every user constraint and rule:
1. First line of every file or replacement must preserve `// <relative/path> (do not remove this comment)`.
2. Code replacement rule:
   - Do NOT give full-file replacements by default.
   - Identify the exact existing code block to replace and provide the complete replacement block, clearly indicating where the replacement starts and ends.
   - If the replacement would affect more than 60% of the file's code (or if it is a new file), provide the file path and the complete replacement file instead.
   - NEVER output a replacement block twice and NEVER output both a find-replace block and a full-file replacement for the same file. Give each file's change ONCE in only one format.

Let's check the percentage of change for each file in Phase 5D:
1. `backend/src/lib/entitlements/access.js` (~160 lines, >75% modified to add `checkChannelAccess`, normalize `opts` so both `ctx` and `{ ctx }` work, and attach `code`, `status`, `message: reason` to every return object) -> **Full-file replacement**.
2. `backend/src/lib/entitlements/usage.service.js` (~260 lines, only 1 import/export block at the top changes, <5% of the file) -> **Find-replace block**.
3. `backend/src/modules/templates/template.controller.js` (~750 lines, only imports + 2 `MediaAsset` blocks change, <5% of the file) -> **Find-replace blocks**.
4. `backend/src/modules/automation/flowMedia.controller.js` (~45 lines total, >70% modified to use `{ tenantId, kind: "FLOW_MEDIA", url, fileName, mimeType, sizeBytes }`) -> **Full-file replacement**.
5. `backend/src/utils/tenantDeletion.js` (new file) -> **Complete new file**.
6. `backend/src/cron/jobs/expired-subscriptions.job.js` (>85% modified) -> **Full-file replacement**.
7. `backend/src/cron/jobs/expiry-reminders.job.js` (>85% modified) -> **Full-file replacement**.
8. `backend/src/cron/jobs/abandoned-accounts.job.js` (>75% modified) -> **Full-file replacement**.
9. `backend/src/cron/jobs/data-deletion.job.js` (new file) -> **Complete new file**.
10. `backend/src/server.js` (~165 lines, only 1 import line added, <2% of the file) -> **Find-replace block**.

Let's double-check all details in each of these 10 files to make sure there are zero bugs, missing imports, or mismatched Prisma field names!

Let's check `backend/src/lib/entitlements/access.js`:
- Callers across the codebase:
  - `checkFeatureAccess(tenantId, featureKey, ctxOrOpts)`
  - `checkLimitAccess(tenantId, limitKey, requiredCount = 1, ctxOrOpts)`
  - `checkStorageAccess(tenantId, incomingBytes = 0, ctxOrOpts)`
  - `enforceAndConsumeQuota(tenantId, limitKey, count = 1, ctxOrOpts)`
  - `checkMeteredAccess`: alias to `enforceAndConsumeQuota` (or read-only / consume) — wait: let's check if anything imports `checkMeteredAccess`:
    - In `flow.controller.js`: `import { checkFeatureAccess, checkLimitAccess } from "../../lib/entitlements/access.js";`
    - In `broadcast.controller.js`: `import { checkFeatureAccess, checkLimitAccess, enforceAndConsumeQuota } from "../../lib/entitlements/access.js";`
    - In `webhook.worker.js`: `import { checkChannelAccess } from "../../lib/entitlements/access.js";`
    - Let's also export `checkChannelAccess(tenantId, channel, ctxOrOpts)` and `checkMeteredAccess` (alias for `checkLimitAccess`) so every documented helper in `access.js` is present!
  - Let's check how `ctxOrOpts` is passed:
    - Some callers pass `{ ctx }` (e.g. `usage.service.js` or internal calls)
    - Some callers pass `ctx` directly (e.g. `checkFeatureAccess(tenantId, "integrationsEnabled", ctx)`, `checkLimitAccess(tenantId, "maxIntegrations", 1, ctx)` in `tenant.integrations.controller.js`, `flow.controller.js`, `broadcast.controller.js`)
    - Let's write a helper `resolveCtx(tenantId, ctxOrOpts)`:
      ```js
      const resolveCtx = async (tenantId, ctxOrOpts) => {
        if (!ctxOrOpts) return getTenantSubscriptionContext(tenantId);
        if (ctxOrOpts.ctx) return ctxOrOpts.ctx;
        if ("subscription" in ctxOrOpts || "tenantId" in ctxOrOpts || "addOns" in ctxOrOpts) {
          return ctxOrOpts;
        }
        return getTenantSubscriptionContext(tenantId);
      };
      ```
      That handles both `{ ctx }` and `ctx` seamlessly!
  - Let's check the return shape of `checkFeatureAccess`, `checkChannelAccess`, `checkLimitAccess`, `checkStorageAccess`, `enforceAndConsumeQuota`:
    - Every caller checks `.allowed`, and on failure reads `res.status(check.status || 403).json({ success: false, code: check.code || "...", message: check.message })`, while some callers read `check.reason`.
    - So if we return BOTH `reason` and `message: reason`, plus `code` and `status: allowed ? 200 : 403`, 100% of callers work!

Let's check `backend/src/utils/tenantDeletion.js`:
- What tables reference `Tenant` (`tenantId`)?
  Let's check `abandoned-accounts.job.js` + all V2 billing/media/integration models:
  - In `abandoned-accounts.job.js`:
    - `callStatusHistory` (via `callLog: { tenantId }`)
    - `callLog`
    - `campaignVariant` (via `campaignExperiment: { tenantId }`)
    - `campaignExperiment`
    - `broadcastLog` (via `broadcast: { tenantId }`)
    - `broadcast`
    - `message` (via `conversation: { tenantId }`)
    - `conversation`
    - `contactListMember` (via `contactList: { tenantId }`)
    - `contactList`
    - `audienceSegment`
    - `contactTag` (via `contact: { tenantId }`)
    - `contactActivity` (via `contact: { tenantId }`)
    - `contactNote` (via `contact: { tenantId }`)
    - `contactSheetValue` (via `contact: { tenantId }`)
    - `zohoSyncTask`
    - `zohoLeadMapping`
    - `orderItem` (via `order: { tenantId }`)
    - `paymentTransaction`
    - `order`
    - `product`
    - `customer`
    - `contact`
    - `tag`
    - `sheetField`
    - `flowSession` (via `flow: { tenantId }`)
    - `flowEdge` (via `flow: { tenantId }`)
    - `flowNode` (via `flow: { tenantId }`)
    - `flow`
    - `template`
    - `quickReply`
    - `knowledgeDocument`
    - `aiConfiguration`
    - `chatLabel`
    - `mediaAsset`
    - `tenantUsage`
  - Plus for complete tenant deletion (`deleteTenantsCompletely`):
    - `userSession` (via `user: { tenantId }`)
    - `userInvite`
    - `user`
    - `customRole`
    - `webhookLog`
    - `auditLog`
    - `enterpriseLead`
    - `subscriptionReminder`
    - `cancellationSurvey`
    - `tenantDataDeletion`
    - `invoice`
    - `payment`
    - `tenantAddOn`
    - `tenantCreditPool`
    - `tenantSubscription`
    - `tenantWhatsApp`
    - `tenantCatalog`
    - `tenantMetaAds`
    - `tenantShopify`
    - `tenantWooCommerce`
    - `tenantZoho`
    - `tenantSocial`
    - `tenantWebhook`
    - `tenantSettings`
    - `tenant`
  - And disk cleanup:
    - `uploads/tenants/<tenantId>`
    - `uploads/calls/<tenantId>`
    - `await fs.rm(dirPath, { recursive: true, force: true })`
  - Notice the distinction between:
    1. `purgeTenantWorkspaceData(tenantIds)`: used by `data-deletion.job.js` when an expired tenant hits `dataDeletionDate`. It deletes all workspace/operational data (messages, conversations, contacts, broadcasts, campaigns, flows, templates, quick replies, orders, products, customers, calls, knowledge documents, AI config, chat labels, media assets, usage rows) and deletes `uploads/tenants/<tenantId>` and `uploads/calls/<tenantId>` from disk, Clears `dataDeletionDate: null` on `TenantSubscription`, and creates a `TenantDataDeletion` record — while keeping the `Tenant` account, `TenantSubscription`, `Invoice`, `Payment`, and owner `User` so the audit trail (`TenantDataDeletion`, invoices) remains valid and the tenant can still log in to `/billing` to resubscribe cleanly in the future.
    2. `deleteTenantsCompletely(tenantIds)`: used by `abandoned-accounts.job.js` for unverified/abandoned accounts that never activated. It runs `purgeTenantWorkspaceData` AND deletes the `Tenant` row and all auth/subscription/settings rows completely.

Let's check `backend/src/cron/jobs/expired-subscriptions.job.js`:
- Let's trace every step in `checkExpiredSubscriptions`:
  - Load `PlatformSettings` once at the start of the job (`defaultGraceDays = settings?.defaultGraceDays ?? 7`, `trialRetentionDays = settings?.trialRetentionDays ?? 7`, `paidRetentionDays = settings?.paidRetentionDays ?? 90`).
  - **Step 0: Clean up stale PENDING payments (> 48h old)**
    - `prisma.payment.updateMany({ where: { status: "PENDING", createdAt: { lte: fortyEightHoursAgo } }, data: { status: "FAILED" } })`
  - **Step 0.5: Expire recurring `TenantAddOn` rows whose `expiresAt <= now`**
    - `prisma.tenantAddOn.updateMany({ where: { status: { in: ["active", "cancel_at_period_end"] }, expiresAt: { not: null, lte: now } }, data: { status: "expired" } })`
  - **Step 1: Scheduled Plan Changes (`pendingPlanId` at `planPeriodEnd` <= now) — Decision 63**
    - Find `TenantSubscription` rows where `pendingPlanId: { not: null }` and `planPeriodEnd: { lte: now }` and `subscriptionStatus: { in: ["active", "trialing"] }`, including `tenant` and `pendingPlan` and `plan`.
    - For each subscription:
      - Re-verify `pendingPlan` per Decision 63:
        - Is `pendingPlan` still valid and purchasable? (`pendingPlan && pendingPlan.status === "ACTIVE" && (pendingPlan.visibility !== "ADMIN_ONLY" || pendingPlan.customTenantId === sub.tenantId)`)
        - If NOT valid/purchasable (e.g., archived/discontinued):
          - Clear `pendingPlanId: null, pendingBillingCycle: null` on `tenantSubscription`.
          - Send `sendScheduledPlanChangeCancelledEmail` to `sub.tenant.email` (with `tenantName`, `currentPlanName: sub.plan?.name || sub.currentPlan || "Current Plan"`, `cancelledPlanName: sub.pendingPlan?.name || "Scheduled Plan"`, `reason`).
          - Do NOT switch the plan; allow the subscription to proceed to normal renewal/grace evaluation.
        - If valid & purchasable:
          - Switch `planId: sub.pendingPlan.id`, `currentPlan: sub.pendingPlan.name`, `billingCycle: sub.pendingBillingCycle || sub.billingCycle`, `pendingPlanId: null`, `pendingBillingCycle: null`.
          - Note: Because SudoReply does not auto-charge without a webhook payment event, switching `planId` at `planPeriodEnd` sets the new target plan & cycle as the active plan entering renewal/grace so the tenant's next renewal or grace period is on the scheduled plan!
  - **Step 2: Paid Subscriptions Reaching `planPeriodEnd` -> Enter Grace Period (`payment_failed`)**
    - Find `TenantSubscription` rows where:
      - `subscriptionStatus: "active"`
      - `planPeriodEnd: { lte: now }`
      - Not covered by a future `freeUntilDate` (`OR: [{ freeUntilDate: null }, { freeUntilDate: { lte: now } }]`)
      - Include `tenant` and `plan`.
    - Wait: What if the tenant explicitly requested cancellation at period end (`cancelRequestedAt !== null`)?
      - If `sub.cancelRequestedAt !== null`, they requested cancellation at period end — they do NOT enter grace period; they transition directly to `expired` in Step 3!
      - If `sub.cancelRequestedAt === null`:
        - Determine `graceDays = sub.gracePeriodDays ?? defaultGraceDays`.
        - If `graceDays > 0`:
          - Calculate `gracePeriodEnd = new Date(now.getTime() + graceDays * 24 * 60 * 60 * 1000)`.
          - Snapshot `graceDebtPlanPrice = sub.plan ? getMonthlyEquivalentPrice(sub.plan, sub.billingCycle) : sub.graceDebtPlanPrice`.
          - Update `tenantSubscription`: `subscriptionStatus: "payment_failed"`, `gracePeriodEnd`, `graceDebtPlanPrice`.
          - Create `SubscriptionReminder` log and send `sendGracePeriodStartedEmail` to `sub.tenant.email`.
        - If `graceDays <= 0`:
          - Handled in Step 3 (immediate expiry).
  - **Step 3: Subscriptions Ready to Expire (`expired`)**
    - Which subscriptions transition to `expired`?
      1. `subscriptionStatus === "trialing"` with `planPeriodEnd <= now` (and no future `freeUntilDate`)
      2. `subscriptionStatus === "cancelled"` with `planPeriodEnd <= now` (and no future `freeUntilDate`)
      3. `subscriptionStatus === "active"` with `planPeriodEnd <= now` where `cancelRequestedAt !== null` OR `(sub.gracePeriodDays ?? defaultGraceDays) <= 0` (and no future `freeUntilDate`)
      4. `subscriptionStatus === "payment_failed"` with `gracePeriodEnd <= now` (or `gracePeriodEnd === null && planPeriodEnd <= now`) (and no future `freeUntilDate`)
    - For each expiring subscription:
      - Determine if tenant has ever made a successful payment:
        - Check `prisma.payment.count({ where: { tenantId: sub.tenantId, status: "SUCCESS" } })` (or `prisma.invoice.count({ where: { tenantId: sub.tenantId, status: "paid" } })`).
        - `everPaid = paidCount > 0`.
        - `retentionDays = everPaid ? paidRetentionDays : trialRetentionDays` (90 days for ever-paid, 7 days for never-paid trial).
        - `deletionDate = new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000)`.
      - Compute `graceDebtDays` if expiring from `payment_failed`:
        - If `sub.subscriptionStatus === "payment_failed"` and `sub.planPeriodEnd`:
          - Days spent in grace = `Math.max(1, Math.ceil(( (sub.gracePeriodEnd ? Math.min(now.getTime(), new Date(sub.gracePeriodEnd).getTime()) : now.getTime()) - new Date(sub.planPeriodEnd).getTime() ) / (1000 * 60 * 60 * 24)))`.
          - `newGraceDebtDays = (sub.graceDebtDays || 0) + daysInGrace`.
        - Snapshot `graceDebtPlanPrice = sub.graceDebtPlanPrice ?? (sub.plan ? getMonthlyEquivalentPrice(sub.plan, sub.billingCycle) : null)`.
      - In a transaction:
        - Update `tenantSubscription`:
          - `subscriptionStatus: "expired"`
          - `gracePeriodEnd: null`
          - `graceDebtDays: newGraceDebtDays`
          - `graceDebtPlanPrice`
          - `pendingPlanId: null`
          - `pendingBillingCycle: null`
          - `dataDeletionDate: sub.dataDeletionDate || deletionDate`
        - Mark active recurring `TenantAddOn` rows as `"cancel_at_period_end"` (or `"expired"` if their `expiresAt <= now`).
      - Send email notification:
        - If expiring from `payment_failed`, send `sendAccountBlockedEmail` AND `sendSubscriptionExpiredEmail` (or `sendSubscriptionExpiredEmail` with `retentionDays`, `deletionDate`, `planName`). Let's send `sendAccountBlockedEmail` when grace period ends AND `sendSubscriptionExpiredEmail` when trial/active/cancelled expires so every template is used for its exact lifecycle event!
  - **Step 4: Data Deletion Warnings (7 days and 2 days before `dataDeletionDate`)**
    - Find `TenantSubscription` rows where `subscriptionStatus: "expired"` and `dataDeletionDate: { gt: now }`.
    - Calculate `daysUntilDeletion = Math.ceil((new Date(sub.dataDeletionDate) - now) / (1000 * 60 * 60 * 24))`.
    - For never-paid trial tenants (7-day retention), send warning at `daysUntilDeletion === 2` (`DELETE_WARN_2D`).
    - For ever-paid tenants (90-day retention), send warnings at `daysUntilDeletion === 7` (`DELETE_WARN_7D`) and `daysUntilDeletion === 2` (`DELETE_WARN_2D`).
    - Check `SubscriptionReminder` in the last 20 hours to avoid duplicate emails, record `SubscriptionReminder`, and call `sendDataDeletionWarningEmail`.

Let's check `backend/src/cron/jobs/expiry-reminders.job.js`:
- Runs daily at 08:00 AM (`"0 8 * * *"`).
- Handles 3 distinct reminder streams:
  1. **Paid Active Subscription Expiry Reminders (`15, 7, 3, 1` days before `planPeriodEnd`)**:
     - `subscriptionStatus: "active"`, `autopayEnabled: false`, `planPeriodEnd` matching target day.
     - Deduped via `SubscriptionReminder` (`EXPIRY_15D`, `EXPIRY_7D`, `EXPIRY_3D`, `EXPIRY_1D`).
     - Calls `sendExpiryReminderEmail({ toEmail, tenantName, planName: sub.plan?.name || sub.currentPlan || "Active", daysLeft, expiryDate: sub.planPeriodEnd })`.
  2. **Free Trial Expiry Reminders (`3, 1` days before `planPeriodEnd`)**:
     - `subscriptionStatus: "trialing"`, `planPeriodEnd` matching target day.
     - Deduped via `SubscriptionReminder` (`TRIAL_EXPIRY_3D`, `TRIAL_EXPIRY_1D`).
     - Calls `sendTrialExpiringEmail({ toEmail, tenantName, planName: sub.plan?.name || sub.currentPlan || "Free Trial", daysRemaining: daysLeft, trialEndsAt: sub.planPeriodEnd })`.
  3. **Grace Period Ending Reminders (`2, 1` days before `gracePeriodEnd`)**:
     - `subscriptionStatus: "payment_failed"`, `gracePeriodEnd` matching target day.
     - Deduped via `SubscriptionReminder` (`GRACE_ENDING_2D`, `GRACE_ENDING_1D`).
     - Calls `sendGracePeriodEndingEmail({ toEmail, tenantName, planName: sub.plan?.name || sub.currentPlan || "Subscription", daysRemaining: daysLeft, gracePeriodEnd: sub.gracePeriodEnd })`.

Let's check `backend/src/cron/jobs/data-deletion.job.js`:
- Runs daily at 02:00 AM (`"0 2 * * *"`), and exports `runDataDeletionJob`.
- **Job 1: Expired Tenant Workspace & Media Purge (`dataDeletionDate <= now`)**:
  - Finds `TenantSubscription` rows where `subscriptionStatus: "expired"` and `dataDeletionDate: { not: null, lte: now }`, including `tenant` and `plan`.
  - Checks if tenant was never-paid trial vs ever-paid (`prisma.payment.count({ where: { tenantId, status: "SUCCESS" } })`).
  - Calls `purgeTenantWorkspaceData([sub.tenantId], { deletedBy: "system_retention_cron", note: ... })`.
  - Sends `sendTrialDeletedEmail` (if never-paid trial) or `sendSystemDeletionConfirmation` (if ever-paid).
- **Job 2: 14-Day Soft-Deleted Media Purge (`SOFT_DELETE_RETENTION_DAYS = 14`)**:
  - Cutoff: `fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)`.
  - Part A — Soft-deleted `Message` rows (`isDeleted: true`, `deletedAt: { lte: fourteenDaysAgo }`, `OR: [{ mediaUrl: { not: null } }, { mediaSize: { not: null } }]`):
    - For each message with a local `mediaUrl` (under `uploads/`), check if any other non-deleted `Message`, `QuickReply`, or active `MediaAsset` still references the same normalized URL (since broadcast/template media can be deduplicated). If no active row references that local file, unlink the file from disk (`fs.unlink`).
    - Update the purged `Message` rows to set `mediaUrl: null, mediaSize: null` so `getStorageUsedBytes` immediately reclaims their storage bytes.
  - Part B — Soft-deleted `MediaAsset` rows (`deletedAt: { not: null, lte: fourteenDaysAgo }`):
    - For each expired `MediaAsset`, unlink its physical file on disk (if no active row references the same URL) and hard-delete the `MediaAsset` row from Prisma (`prisma.mediaAsset.delete({ where: { id: asset.id } })`).

Let's review everything carefully to make sure there are no formatting errors or duplicate outputs. Everything is crystal clear. Let's present the Phase 5D implementation now.Here is the implementation for **Phase 5D — Cron Jobs, Storage Alignment & Data/Media Deletion Engine**.

---

### 1. `backend/src/lib/entitlements/access.js`

*(Full-file replacement — >75% of the file is updated to add `checkChannelAccess`, accept either `{ ctx }` or `ctx` directly, and include `{ code, status, message, reason }` on all returned objects)*

```javascript
// backend/src/lib/entitlements/access.js (do not remove this comment)
import {
  CHANNEL_CATALOG,
  INTEGRATION_CATALOG,
  getEntitlementMeta,
} from "./registry.js";
import {
  getTenantSubscriptionContext,
  resolveEntitlementFromContext,
} from "./entitlement.service.js";
import { consumeQuota, getUsage } from "./usage.service.js";
import { BYTES_PER_MB, getStorageUsedBytes } from "./storage.service.js";

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Normalizes optional context argument so callers can pass either `{ ctx }` or `ctx` directly.
 */
const resolveContextArg = async (tenantId, ctxOrOpts) => {
  if (!ctxOrOpts) return getTenantSubscriptionContext(tenantId);
  if (ctxOrOpts.ctx) return ctxOrOpts.ctx;
  if (
    typeof ctxOrOpts === "object" &&
    ("subscription" in ctxOrOpts || "tenantId" in ctxOrOpts || "addOns" in ctxOrOpts)
  ) {
    return ctxOrOpts;
  }
  return getTenantSubscriptionContext(tenantId);
};

export const checkFeatureAccess = async (tenantId, featureKey, ctxOrOpts) => {
  if (typeof featureKey !== "string" || !featureKey.trim()) {
    const reason = "A feature key is required";
    return {
      allowed: false,
      status: 400,
      code: "FEATURE_KEY_REQUIRED",
      value: null,
      reason,
      message: reason,
    };
  }
  const key = featureKey.trim();
  const context = await resolveContextArg(tenantId, ctxOrOpts);

  const meta = getEntitlementMeta(key);
  if (meta) {
    const ent = resolveEntitlementFromContext(context, key);
    let allowed;
    if (meta.type === "BOOLEAN") allowed = ent.value === true;
    else if (meta.type === "STRING_ARRAY")
      allowed = Array.isArray(ent.value) && ent.value.length > 0;
    else allowed = ent.isUnlimited || Number(ent.value) > 0;

    const reason = allowed
      ? null
      : `"${meta.label}" is not included in your current plan`;
    return {
      allowed,
      status: allowed ? 200 : 403,
      code: allowed ? null : "FEATURE_NOT_AVAILABLE",
      value: ent.value,
      reason,
      message: reason,
    };
  }

  // By name: an integration or a channel
  const upper = key.toUpperCase();
  if (INTEGRATION_CATALOG.includes(upper)) {
    const list =
      resolveEntitlementFromContext(context, "allowedIntegrations").value ?? [];
    const allowed = list.includes(upper);
    const reason = allowed
      ? null
      : `The ${upper} integration is not included in your plan`;
    return {
      allowed,
      status: allowed ? 200 : 403,
      code: allowed ? null : "INTEGRATION_NOT_ALLOWED",
      value: allowed,
      reason,
      message: reason,
    };
  }
  if (CHANNEL_CATALOG.includes(upper)) {
    const list =
      resolveEntitlementFromContext(context, "allowedChannels").value ?? [];
    const allowed = list.includes(upper);
    const reason = allowed
      ? null
      : `The ${upper} channel is not included in your plan`;
    return {
      allowed,
      status: allowed ? 200 : 403,
      code: allowed ? null : "CHANNEL_NOT_ALLOWED",
      value: allowed,
      reason,
      message: reason,
    };
  }
  const reason = `Unknown feature "${featureKey}"`;
  return {
    allowed: false,
    status: 400,
    code: "UNKNOWN_FEATURE",
    value: null,
    reason,
    message: reason,
  };
};

/** Checks whether a specific messaging channel (WHATSAPP | INSTAGRAM | MESSENGER) is allowed. */
export const checkChannelAccess = async (tenantId, channel, ctxOrOpts) => {
  if (typeof channel !== "string" || !channel.trim()) {
    const reason = "A channel name is required";
    return {
      allowed: false,
      status: 400,
      code: "CHANNEL_REQUIRED",
      value: false,
      reason,
      message: reason,
    };
  }
  const upper = channel.trim().toUpperCase();
  const context = await resolveContextArg(tenantId, ctxOrOpts);
  const list =
    resolveEntitlementFromContext(context, "allowedChannels").value ?? [];
  const allowed = Array.isArray(list) && list.includes(upper);
  const reason = allowed
    ? null
    : `The ${upper} channel is not included in your current plan`;
  return {
    allowed,
    status: allowed ? 200 : 403,
    code: allowed ? null : "CHANNEL_NOT_ALLOWED",
    value: allowed,
    reason,
    message: reason,
  };
};

/** Read-only check for STATIC / METERED limits (never writes). `requiredCount` may be fractional (storage MB). */
export const checkLimitAccess = async (
  tenantId,
  limitKey,
  requiredCount = 1,
  ctxOrOpts,
) => {
  const meta = getEntitlementMeta(limitKey);
  if (!meta) {
    const reason = `Unknown entitlement "${limitKey}"`;
    return {
      allowed: false,
      status: 400,
      code: "UNKNOWN_ENTITLEMENT",
      reason,
      message: reason,
    };
  }
  if (!Number.isFinite(requiredCount) || requiredCount < 0) {
    const reason = "requiredCount must be a non-negative number";
    return {
      allowed: false,
      status: 400,
      code: "INVALID_REQUIRED_COUNT",
      reason,
      message: reason,
    };
  }
  if (meta.usage !== "STATIC" && meta.usage !== "METERED") {
    return { allowed: true, status: 200, code: null, reason: null, message: null };
  }

  const ctx = await resolveContextArg(tenantId, ctxOrOpts);
  const u = await getUsage(tenantId, limitKey, { ctx });

  if (meta.usage === "STATIC") {
    if (u.isUnlimited) {
      return {
        allowed: true,
        status: 200,
        code: null,
        current: u.used,
        limit: -1,
        remaining: -1,
        isUnlimited: true,
        reason: null,
        message: null,
      };
    }
    const allowed = u.used + requiredCount <= u.limit;
    const reason = allowed
      ? null
      : `${meta.label} limit reached (${u.used} of ${u.limit}). Upgrade your plan or buy an add-on.`;
    return {
      allowed,
      status: allowed ? 200 : 403,
      code: allowed ? null : "PLAN_LIMIT_REACHED",
      current: u.used,
      limit: u.limit,
      remaining: u.remaining,
      isUnlimited: false,
      reason,
      message: reason,
    };
  }

  if (u.isUnlimited) {
    return {
      allowed: true,
      status: 200,
      code: null,
      used: u.used,
      baseLimit: -1,
      poolRemaining: u.poolRemaining,
      totalLimit: -1,
      remaining: -1,
      isUnlimited: true,
      reason: null,
      message: null,
    };
  }
  const allowed = u.remaining >= requiredCount;
  const reason = allowed
    ? null
    : `Monthly ${meta.label} quota exhausted (${u.remaining} remaining, ${requiredCount} needed). Buy a top-up or upgrade your plan.`;
  return {
    allowed,
    status: allowed ? 200 : 403,
    code: allowed ? null : "QUOTA_EXCEEDED",
    used: u.used,
    baseLimit: u.baseLimit,
    poolRemaining: u.poolRemaining,
    totalLimit: u.totalLimit,
    remaining: u.remaining,
    isUnlimited: false,
    reason,
    message: reason,
  };
};

export const checkMeteredAccess = checkLimitAccess;

/** Pre-upload storage check, in exact bytes. Call after multer (size known); delete the file if denied. */
export const checkStorageAccess = async (
  tenantId,
  incomingBytes = 0,
  ctxOrOpts,
) => {
  const context = await resolveContextArg(tenantId, ctxOrOpts);
  const ent = resolveEntitlementFromContext(context, "maxStorageMb");
  const usedBytes = await getStorageUsedBytes(tenantId);
  const usedMb = round2(usedBytes / BYTES_PER_MB);
  const incomingMb = round2(incomingBytes / BYTES_PER_MB);

  if (ent.isUnlimited) {
    return {
      allowed: true,
      status: 200,
      code: null,
      usedMb,
      limitMb: -1,
      remainingMb: -1,
      incomingMb,
      isUnlimited: true,
      reason: null,
      message: null,
    };
  }
  const limitBytes = ent.value * BYTES_PER_MB;
  const allowed = usedBytes + incomingBytes <= limitBytes;
  const reason = allowed
    ? null
    : `Storage limit reached (${usedMb} MB of ${ent.value} MB used, upload needs ${incomingMb} MB). Upgrade your plan or buy a storage add-on.`;
  return {
    allowed,
    status: allowed ? 200 : 403,
    code: allowed ? null : "STORAGE_LIMIT_REACHED",
    usedMb,
    limitMb: ent.value,
    remainingMb: Math.max(round2((limitBytes - usedBytes) / BYTES_PER_MB), 0),
    incomingMb,
    isUnlimited: false,
    reason,
    message: reason,
  };
};

/** Check + consume in ONE atomic step (no separate check). Use this for metered actions. */
export const enforceAndConsumeQuota = async (
  tenantId,
  limitKey,
  count = 1,
  ctxOrOpts,
) => {
  const meta = getEntitlementMeta(limitKey);
  if (!meta || meta.usage !== "METERED") {
    const reason = `"${limitKey}" is not a metered entitlement`;
    return {
      allowed: false,
      status: 400,
      code: "NOT_METERED_ENTITLEMENT",
      reason,
      message: reason,
    };
  }
  const ctx = await resolveContextArg(tenantId, ctxOrOpts);
  const result = await consumeQuota(tenantId, limitKey, count, { ctx });
  if (!result.success) {
    const reason = `Monthly ${meta.label} quota exhausted (${result.remaining} remaining, ${count} needed). Buy a top-up or upgrade your plan.`;
    return {
      ...result,
      allowed: false,
      status: 403,
      code: result.reason || "QUOTA_EXCEEDED",
      reason,
      message: reason,
    };
  }
  return {
    ...result,
    allowed: true,
    status: 200,
    code: null,
    reason: null,
    message: null,
  };
};
```

---

### 2. `backend/src/lib/entitlements/usage.service.js`

*(Find-and-replace — re-export storage helpers from `./storage.service.js` so callers importing from `usage.service.js` or `storage.service.js` both resolve cleanly)*

**REPLACE START:**
```javascript
import { BYTES_PER_MB, getStorageUsedBytes } from "./storage.service.js";
```
**WITH:**
```javascript
import {
  BYTES_PER_MB,
  getStorageUsedBytes,
  registerMediaAsset,
  markMediaAssetDeleted,
  removeMediaAssetRow,
} from "./storage.service.js";

export {
  BYTES_PER_MB,
  getStorageUsedBytes,
  getStorageUsedBytes as getStorageUsageBytes,
  registerMediaAsset,
  markMediaAssetDeleted,
  removeMediaAssetRow,
};
```
**REPLACE END**

---

### 3. `backend/src/modules/automation/flowMedia.controller.js`

*(Full-file replacement — >70% updated to pass `{ tenantId, kind: "FLOW_MEDIA", url, fileName, mimeType, sizeBytes }` matching `storage.service.js` and `MediaAsset` schema)*

```javascript
// backend/src/modules/automation/flowMedia.controller.js (do not remove this comment)
import fs from "fs/promises";
import { checkStorageAccess } from "../../lib/entitlements/access.js";
import { registerMediaAsset } from "../../lib/entitlements/storage.service.js";

export const uploadFlowMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No media file uploaded." });
    }

    const tenantId = req.tenantId;
    const incomingBytes = req.file.size || 0;

    // Enforce storage limit before accepting the uploaded file
    const storageCheck = await checkStorageAccess(tenantId, incomingBytes);
    if (!storageCheck.allowed) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(storageCheck.status || 403).json({
        success: false,
        code: storageCheck.code || "STORAGE_LIMIT_REACHED",
        error: storageCheck.message,
        message: storageCheck.message,
      });
    }

    // Construct the relative path (normalize Windows backslashes to forward slashes)
    const relativePath = req.file.path.replace(/\\/g, "/");
    const fileUrl = `/${relativePath}`;

    // Register in MediaAsset ledger for storage tracking & 14-day purge
    await registerMediaAsset({
      tenantId,
      kind: "FLOW_MEDIA",
      url: relativePath,
      fileName: req.file.originalname || req.file.filename,
      mimeType: req.file.mimetype || "application/octet-stream",
      sizeBytes: incomingBytes,
    });

    return res.status(200).json({
      message: "Flow media uploaded successfully",
      url: fileUrl,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });
  } catch (error) {
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    console.error("Flow Media Upload Error:", error);
    return res
      .status(500)
      .json({ error: "Failed to process uploaded media." });
  }
};
```

---

### 4. `backend/src/modules/templates/template.controller.js`

*(Find-and-replace — align `registerMediaAsset` and `markMediaAssetDeleted` calls with `storage.service.js` and `MediaAsset` schema)*

#### Change 4A: Update import at top of file

**REPLACE START:**
```javascript
import { checkStorageAccess } from "../../lib/entitlements/access.js";
import { registerMediaAsset } from "../../lib/entitlements/usage.service.js";
```
**WITH:**
```javascript
import { checkStorageAccess } from "../../lib/entitlements/access.js";
import {
  registerMediaAsset,
  markMediaAssetDeleted,
} from "../../lib/entitlements/storage.service.js";
```
**REPLACE END**

#### Change 4B: Update `MediaAsset` calls in `createTemplate`

**REPLACE START:**
```javascript
    let template;
    if (existingTemplate && existingTemplate.status === "DELETED") {
      // Clean up previous media file & mark previous MediaAsset deleted if any
      if (
        existingTemplate.headerMediaUrl &&
        existingTemplate.headerMediaUrl !== headerMediaUrl
      ) {
        await safeDeleteFile(existingTemplate.headerMediaUrl);
        await prisma.mediaAsset.updateMany({
          where: {
            tenantId,
            source: "TEMPLATE_HEADER",
            OR: [
              { sourceId: existingTemplate.id },
              { filePath: existingTemplate.headerMediaUrl },
            ],
            deletedAt: null,
          },
          data: { deletedAt: new Date() },
        });
      }
      template = await prisma.template.update({
        where: { id: existingTemplate.id },
        data: templateData,
      });
    } else {
      template = await prisma.template.create({
        data: templateData,
      });
    }

    if (uploadedFile && headerMediaUrl) {
      await registerMediaAsset({
        tenantId,
        source: "TEMPLATE_HEADER",
        sourceId: template.id,
        filePath: headerMediaUrl,
        fileName: uploadedFile.originalname,
        mimeType: uploadedFile.mimetype,
        sizeBytes: uploadedFile.size,
      });
    }
```
**WITH:**
```javascript
    let template;
    if (existingTemplate && existingTemplate.status === "DELETED") {
      // Mark previous MediaAsset soft-deleted for 14-day purge job if replaced
      if (
        existingTemplate.headerMediaUrl &&
        existingTemplate.headerMediaUrl !== headerMediaUrl
      ) {
        await markMediaAssetDeleted(tenantId, existingTemplate.headerMediaUrl);
      }
      template = await prisma.template.update({
        where: { id: existingTemplate.id },
        data: templateData,
      });
    } else {
      template = await prisma.template.create({
        data: templateData,
      });
    }

    if (uploadedFile && headerMediaUrl) {
      await registerMediaAsset({
        tenantId,
        kind: "TEMPLATE_HEADER",
        url: headerMediaUrl,
        fileName: uploadedFile.originalname,
        mimeType: uploadedFile.mimetype,
        sizeBytes: uploadedFile.size,
      });
    }
```
**REPLACE END**

#### Change 4C: Update `MediaAsset` soft-deletion in `deleteTemplate`

**REPLACE START:**
```javascript
    // Clean up local media file & mark MediaAsset deleted (non-blocking)
    if (template.headerMediaUrl) {
      await safeDeleteFile(template.headerMediaUrl);
      await prisma.mediaAsset.updateMany({
        where: {
          tenantId,
          source: "TEMPLATE_HEADER",
          OR: [
            { sourceId: template.id },
            { filePath: template.headerMediaUrl },
          ],
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      });
    }
```
**WITH:**
```javascript
    // Start 14-day soft-delete clock on template header MediaAsset (purged by data-deletion.job.js)
    if (template.headerMediaUrl) {
      await markMediaAssetDeleted(tenantId, template.headerMediaUrl);
    }
```
**REPLACE END**

---

### 5. `backend/src/utils/tenantDeletion.js` *(New File)*

```javascript
// backend/src/utils/tenantDeletion.js (do not remove this comment)
import fs from "fs/promises";
import path from "path";
import prisma from "../config/prisma.js";

/**
 * Removes all physical media directories belonging to a tenant from disk.
 * Safe and non-throwing if directories do not exist.
 */
export const removeTenantMediaDirectories = async (tenantId) => {
  if (!tenantId) return;
  const dirs = [
    path.resolve("uploads", "tenants", tenantId),
    path.resolve("uploads", "calls", tenantId),
  ];

  for (const dir of dirs) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (err) {
      console.warn(
        `[TenantDeletion] Warning removing directory ${dir}: ${err.message}`,
      );
    }
  }
};

/**
 * Purges a list of tenants' operational workspace data (messages, conversations,
 * contacts, broadcasts, campaigns, flows, templates, quick replies, e-commerce
 * orders/products/customers, call logs, AI docs, media assets, usage rows) and
 * deletes their physical media directories from disk, while keeping the Tenant
 * account shell, billing history (Invoices/Payments), and TenantDataDeletion audit log.
 *
 * Used by data-deletion.job.js when an expired tenant reaches dataDeletionDate.
 */
export const purgeTenantWorkspaceData = async (
  tenantIds,
  { deletedBy = "system", note = "Automatic retention purge" } = {},
) => {
  if (!Array.isArray(tenantIds) || tenantIds.length === 0) return { purged: 0 };

  await prisma.$transaction(async (tx) => {
    // 1. Calling & Campaign child records
    await tx.callStatusHistory.deleteMany({
      where: { callLog: { tenantId: { in: tenantIds } } },
    });
    await tx.callLog.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.campaignVariant.deleteMany({
      where: { campaignExperiment: { tenantId: { in: tenantIds } } },
    });
    await tx.campaignExperiment.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });

    // 2. Broadcasts, Messages & Conversations
    await tx.broadcastLog.deleteMany({
      where: { broadcast: { tenantId: { in: tenantIds } } },
    });
    await tx.broadcast.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.message.deleteMany({
      where: { conversation: { tenantId: { in: tenantIds } } },
    });
    await tx.conversation.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });

    // 3. Contacts, Segments, Lists, Tags, Custom Attributes & Zoho mappings
    await tx.contactListMember.deleteMany({
      where: { contactList: { tenantId: { in: tenantIds } } },
    });
    await tx.contactList.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.audienceSegment.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.contactTag.deleteMany({
      where: { contact: { tenantId: { in: tenantIds } } },
    });
    await tx.contactActivity.deleteMany({
      where: { contact: { tenantId: { in: tenantIds } } },
    });
    await tx.contactNote.deleteMany({
      where: { contact: { tenantId: { in: tenantIds } } },
    });
    await tx.contactSheetValue.deleteMany({
      where: { contact: { tenantId: { in: tenantIds } } },
    });
    await tx.zohoSyncTask.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.zohoLeadMapping.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });

    // 4. E-Commerce (Orders, Transactions, Products, Customers)
    await tx.orderItem.deleteMany({
      where: { order: { tenantId: { in: tenantIds } } },
    });
    await tx.paymentTransaction.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.order.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.product.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.customer.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });

    // 5. Contacts, Tags & SheetFields
    await tx.contact.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tag.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.sheetField.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });

    // 6. Automation Flows, Templates, Quick Replies, AI & Labels
    await tx.flowSession.deleteMany({
      where: { flow: { tenantId: { in: tenantIds } } },
    });
    await tx.flowEdge.deleteMany({
      where: { flow: { tenantId: { in: tenantIds } } },
    });
    await tx.flowNode.deleteMany({
      where: { flow: { tenantId: { in: tenantIds } } },
    });
    await tx.flow.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.template.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.quickReply.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.knowledgeDocument.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.aiConfiguration.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.chatLabel.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });

    // 7. MediaAssets & Usage Metering
    await tx.mediaAsset.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tenantUsage.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });

    // 8. Clear dataDeletionDate so the tenant is not repeatedly purged, and record audit log
    await tx.tenantSubscription.updateMany({
      where: { tenantId: { in: tenantIds } },
      data: { dataDeletionDate: null },
    });

    await tx.tenantDataDeletion.createMany({
      data: tenantIds.map((tenantId) => ({
        tenantId,
        deletedBy,
        note,
      })),
    });
  });

  // 9. Remove physical files from disk outside the DB transaction
  for (const tenantId of tenantIds) {
    await removeTenantMediaDirectories(tenantId);
  }

  return { purged: tenantIds.length };
};

/**
 * Completely and permanently deletes tenant accounts and all dependent records
 * (used for abandoned unverified/rejected accounts).
 */
export const deleteTenantsCompletely = async (tenantIds) => {
  if (!Array.isArray(tenantIds) || tenantIds.length === 0) return { deleted: 0 };

  await prisma.$transaction(async (tx) => {
    // 1. Operational workspace data
    await tx.callStatusHistory.deleteMany({
      where: { callLog: { tenantId: { in: tenantIds } } },
    });
    await tx.callLog.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.campaignVariant.deleteMany({
      where: { campaignExperiment: { tenantId: { in: tenantIds } } },
    });
    await tx.campaignExperiment.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.broadcastLog.deleteMany({
      where: { broadcast: { tenantId: { in: tenantIds } } },
    });
    await tx.broadcast.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.message.deleteMany({
      where: { conversation: { tenantId: { in: tenantIds } } },
    });
    await tx.conversation.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.contactListMember.deleteMany({
      where: { contactList: { tenantId: { in: tenantIds } } },
    });
    await tx.contactList.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.audienceSegment.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.contactTag.deleteMany({
      where: { contact: { tenantId: { in: tenantIds } } },
    });
    await tx.contactActivity.deleteMany({
      where: { contact: { tenantId: { in: tenantIds } } },
    });
    await tx.contactNote.deleteMany({
      where: { contact: { tenantId: { in: tenantIds } } },
    });
    await tx.contactSheetValue.deleteMany({
      where: { contact: { tenantId: { in: tenantIds } } },
    });
    await tx.zohoSyncTask.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.zohoLeadMapping.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.orderItem.deleteMany({
      where: { order: { tenantId: { in: tenantIds } } },
    });
    await tx.paymentTransaction.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.order.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.product.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.customer.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.contact.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tag.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.sheetField.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.flowSession.deleteMany({
      where: { flow: { tenantId: { in: tenantIds } } },
    });
    await tx.flowEdge.deleteMany({
      where: { flow: { tenantId: { in: tenantIds } } },
    });
    await tx.flowNode.deleteMany({
      where: { flow: { tenantId: { in: tenantIds } } },
    });
    await tx.flow.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.template.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.quickReply.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.knowledgeDocument.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.aiConfiguration.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.chatLabel.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.mediaAsset.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });

    // 2. Users, Roles, Invites & Logs
    await tx.userSession.deleteMany({
      where: { user: { tenantId: { in: tenantIds } } },
    });
    await tx.userInvite.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.user.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.customRole.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.webhookLog.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.auditLog.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });

    // 3. Billing, Subscriptions, Add-Ons, Usage & Reminders
    await tx.subscriptionReminder.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.cancellationSurvey.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tenantDataDeletion.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.invoice.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.payment.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tenantAddOn.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tenantCreditPool.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tenantUsage.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tenantSubscription.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });

    // 4. Tenant Satellite Tables & Tenant Root
    await tx.enterpriseLead.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tenantWhatsApp.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tenantCatalog.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tenantMetaAds.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tenantShopify.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tenantWooCommerce.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tenantZoho.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tenantSocial.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tenantWebhook.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tenantSettings.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tenant.deleteMany({
      where: { id: { in: tenantIds } },
    });
  });

  for (const tenantId of tenantIds) {
    await removeTenantMediaDirectories(tenantId);
  }

  return { deleted: tenantIds.length };
};
```

---

### 6. `backend/src/cron/jobs/expired-subscriptions.job.js`

*(Full-file replacement — >85% of the file is updated for V2 scheduled plan changes per Decision 63, grace period entry, grace debt calculation, `PlatformSettings` 7d/90d retention, `TenantAddOn` expiry, and V2 email notifications)*

```javascript
// backend/src/cron/jobs/expired-subscriptions.job.js (do not remove this comment)
import cron from "node-cron";
import prisma from "../../config/prisma.js";
import { getMonthlyEquivalentPrice } from "../../lib/billingPeriod.js";
import {
  sendSubscriptionExpiredEmail,
  sendDataDeletionWarningEmail,
  sendGracePeriodStartedEmail,
  sendAccountBlockedEmail,
  sendScheduledPlanChangeCancelledEmail,
} from "../../modules/email/index.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Checks whether a scheduled target plan is still active and purchasable by this tenant (Decision 63).
 */
const isPlanValidForScheduledSwitch = (plan, tenantId) => {
  if (!plan || plan.status !== "ACTIVE") return false;
  if (plan.planType === "CUSTOM") {
    return plan.customTenantId === tenantId;
  }
  if (plan.visibility === "ADMIN_ONLY") return false;
  return true;
};

/**
 * Checks whether a subscription has active complimentary access via freeUntilDate.
 */
const hasActiveFreeUntil = (sub, now) =>
  Boolean(sub.freeUntilDate && new Date(sub.freeUntilDate) > now);

/**
 * Daily Subscription Lifecycle Job (runs at 00:05 AM):
 * 1. Marks abandoned PENDING payments (>48h) as FAILED.
 * 2. Expires recurring TenantAddOns whose expiresAt <= now.
 * 3. Evaluates scheduled plan changes (pendingPlanId) at planPeriodEnd (Decision 63).
 * 4. Transitions unpaid active subscriptions reaching planPeriodEnd into grace period (payment_failed).
 * 5. Transitions expired trials, cancelled plans, and exhausted grace periods into expired status,
 *    calculates graceDebtDays, sets dataDeletionDate (7d trial vs 90d paid from PlatformSettings),
 *    and marks recurring add-ons as cancel_at_period_end / expired.
 * 6. Sends data deletion warning emails (7d and 2d before dataDeletionDate).
 */
export const checkExpiredSubscriptions = async () => {
  console.log("[CRON] Starting V2 expired subscriptions lifecycle check...");
  const now = new Date();

  try {
    const settings = await prisma.platformSettings.findFirst();
    const defaultGraceDays = settings?.defaultGraceDays ?? 7;
    const trialRetentionDays = settings?.trialRetentionDays ?? 7;
    const paidRetentionDays = settings?.paidRetentionDays ?? 90;

    // ── Step 0: Clean up stale PENDING payments (> 48 hours old) ──
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const stalePayments = await prisma.payment.updateMany({
      where: {
        status: "PENDING",
        createdAt: { lte: fortyEightHoursAgo },
      },
      data: { status: "FAILED" },
    });
    if (stalePayments.count > 0) {
      console.log(
        `[CRON] Marked ${stalePayments.count} stale PENDING payments (>48h) as FAILED.`,
      );
    }

    // ── Step 0.5: Expire recurring TenantAddOn rows past their expiresAt ──
    const expiredAddOns = await prisma.tenantAddOn.updateMany({
      where: {
        status: { in: ["active", "cancel_at_period_end"] },
        expiresAt: { not: null, lte: now },
      },
      data: { status: "expired" },
    });
    if (expiredAddOns.count > 0) {
      console.log(
        `[CRON] Marked ${expiredAddOns.count} TenantAddOn record(s) as expired.`,
      );
    }

    // ── Step 1: Scheduled Plan Changes (pendingPlanId at planPeriodEnd <= now) — Decision 63 ──
    const scheduledSubs = await prisma.tenantSubscription.findMany({
      where: {
        pendingPlanId: { not: null },
        planPeriodEnd: { lte: now },
        subscriptionStatus: { in: ["active", "trialing"] },
      },
      include: {
        tenant: true,
        plan: true,
        pendingPlan: true,
      },
    });

    for (const sub of scheduledSubs) {
      const targetPlan = sub.pendingPlan;
      const currentPlanName = sub.plan?.name || sub.currentPlan || "Current Plan";

      if (!isPlanValidForScheduledSwitch(targetPlan, sub.tenantId)) {
        // Target plan was archived/discontinued -> cancel scheduled change, keep current plan
        await prisma.tenantSubscription.update({
          where: { tenantId: sub.tenantId },
          data: {
            pendingPlanId: null,
            pendingBillingCycle: null,
          },
        });

        console.log(
          `[CRON] Cancelled scheduled plan change for tenant ${sub.tenantId} (target plan "${targetPlan?.name || sub.pendingPlanId}" is no longer active).`,
        );

        if (sub.tenant?.email) {
          sendScheduledPlanChangeCancelledEmail({
            toEmail: sub.tenant.email,
            tenantName: sub.tenant.tenantName,
            currentPlanName,
            cancelledPlanName: targetPlan?.name || "Scheduled Plan",
            reason:
              "The scheduled plan was discontinued or is no longer available for self-serve renewal. Your subscription remains on your current plan.",
          }).catch((err) =>
            console.error(
              `[CRON] Failed to send scheduledPlanChangeCancelledEmail to ${sub.tenant.email}:`,
              err.message,
            ),
          );
        }
      } else {
        // Apply the scheduled target plan & cycle onto the subscription before renewal/grace evaluation
        const nextCycle = sub.pendingBillingCycle || sub.billingCycle || "MONTHLY";
        await prisma.tenantSubscription.update({
          where: { tenantId: sub.tenantId },
          data: {
            planId: targetPlan.id,
            currentPlan: targetPlan.name,
            billingCycle: nextCycle,
            pendingPlanId: null,
            pendingBillingCycle: null,
          },
        });
        console.log(
          `[CRON] Applied scheduled plan switch for tenant ${sub.tenantId} -> ${targetPlan.name} (${nextCycle}).`,
        );
      }
    }

    // ── Step 2: Paid Active Subscriptions Reaching planPeriodEnd -> Enter Grace Period (payment_failed) ──
    const activeDueSubs = await prisma.tenantSubscription.findMany({
      where: {
        subscriptionStatus: "active",
        planPeriodEnd: { lte: now },
        cancelRequestedAt: null,
      },
      include: {
        tenant: true,
        plan: true,
      },
    });

    let enteredGraceCount = 0;

    for (const sub of activeDueSubs) {
      if (hasActiveFreeUntil(sub, now)) continue;

      const graceDays = sub.gracePeriodDays ?? defaultGraceDays;
      if (graceDays <= 0) continue; // Will be expired immediately in Step 3

      const gracePeriodEnd = new Date(now.getTime() + graceDays * DAY_MS);
      const monthlyEquivPrice = sub.plan
        ? getMonthlyEquivalentPrice(sub.plan, sub.billingCycle)
        : sub.graceDebtPlanPrice ?? null;

      await prisma.tenantSubscription.update({
        where: { tenantId: sub.tenantId },
        data: {
          subscriptionStatus: "payment_failed",
          gracePeriodEnd,
          graceDebtPlanPrice: monthlyEquivPrice,
        },
      });

      enteredGraceCount++;

      if (sub.tenant?.email) {
        sendGracePeriodStartedEmail({
          toEmail: sub.tenant.email,
          tenantName: sub.tenant.tenantName,
          planName: sub.plan?.name || sub.currentPlan || "Subscription",
          graceDays,
          gracePeriodEnd,
        }).catch((err) =>
          console.error(
            `[CRON] Failed to send gracePeriodStartedEmail to ${sub.tenant.email}:`,
            err.message,
          ),
        );
      }
    }

    if (enteredGraceCount > 0) {
      console.log(
        `[CRON] Transitioned ${enteredGraceCount} subscription(s) into grace period (payment_failed).`,
      );
    }

    // ── Step 3: Subscriptions Ready to Expire (trialing / cancelled / cancel-at-period-end / exhausted grace) ──
    const expirableCandidates = await prisma.tenantSubscription.findMany({
      where: {
        OR: [
          {
            subscriptionStatus: { in: ["trialing", "cancelled"] },
            planPeriodEnd: { lte: now },
          },
          {
            subscriptionStatus: "active",
            planPeriodEnd: { lte: now },
          },
          {
            subscriptionStatus: "payment_failed",
            OR: [
              { gracePeriodEnd: { lte: now } },
              { gracePeriodEnd: null, planPeriodEnd: { lte: now } },
            ],
          },
        ],
      },
      include: {
        tenant: true,
        plan: true,
      },
    });

    let expiredCount = 0;

    for (const sub of expirableCandidates) {
      if (hasActiveFreeUntil(sub, now)) continue;

      // Double-check active subscriptions: only expire here if cancelRequestedAt is set or graceDays <= 0
      const graceDays = sub.gracePeriodDays ?? defaultGraceDays;
      if (
        sub.subscriptionStatus === "active" &&
        !sub.cancelRequestedAt &&
        graceDays > 0
      ) {
        continue;
      }

      const wasInGrace = sub.subscriptionStatus === "payment_failed";

      // Check if tenant has ever paid to decide 90-day vs 7-day data retention
      const paidPaymentCount = await prisma.payment.count({
        where: { tenantId: sub.tenantId, status: "SUCCESS" },
      });
      const everPaid = paidPaymentCount > 0;
      const retentionDays = everPaid ? paidRetentionDays : trialRetentionDays;
      const deletionDate =
        sub.dataDeletionDate || new Date(now.getTime() + retentionDays * DAY_MS);

      // Calculate accumulated grace debt days if expiring out of grace period
      let updatedGraceDebtDays = sub.graceDebtDays || 0;
      if (wasInGrace && sub.planPeriodEnd) {
        const graceEndRef = sub.gracePeriodEnd
          ? Math.min(now.getTime(), new Date(sub.gracePeriodEnd).getTime())
          : now.getTime();
        const graceElapsedMs =
          graceEndRef - new Date(sub.planPeriodEnd).getTime();
        const daysInGrace = Math.max(1, Math.ceil(graceElapsedMs / DAY_MS));
        updatedGraceDebtDays += daysInGrace;
      }

      const snapshotPrice =
        sub.graceDebtPlanPrice ??
        (sub.plan
          ? getMonthlyEquivalentPrice(sub.plan, sub.billingCycle)
          : null);

      await prisma.$transaction(async (tx) => {
        await tx.tenantSubscription.update({
          where: { tenantId: sub.tenantId },
          data: {
            subscriptionStatus: "expired",
            gracePeriodEnd: null,
            graceDebtDays: updatedGraceDebtDays,
            graceDebtPlanPrice: snapshotPrice,
            pendingPlanId: null,
            pendingBillingCycle: null,
            dataDeletionDate: deletionDate,
          },
        });

        // Recurring add-ons stop renewing when base subscription expires
        await tx.tenantAddOn.updateMany({
          where: {
            tenantId: sub.tenantId,
            status: "active",
          },
          data: {
            status: "cancel_at_period_end",
          },
        });
      });

      expiredCount++;

      const planLabel = sub.plan?.name || sub.currentPlan || "Subscription";
      if (sub.tenant?.email) {
        if (wasInGrace) {
          sendAccountBlockedEmail({
            toEmail: sub.tenant.email,
            tenantName: sub.tenant.tenantName,
            planName: planLabel,
            graceDebtDays: updatedGraceDebtDays,
            dataDeletionDate: deletionDate,
          }).catch((err) =>
            console.error(
              `[CRON] Failed to send accountBlockedEmail to ${sub.tenant.email}:`,
              err.message,
            ),
          );
        } else {
          sendSubscriptionExpiredEmail({
            toEmail: sub.tenant.email,
            tenantName: sub.tenant.tenantName,
            planName: planLabel,
            deletionDate,
            retentionDays,
          }).catch((err) =>
            console.error(
              `[CRON] Failed to send subscriptionExpiredEmail to ${sub.tenant.email}:`,
              err.message,
            ),
          );
        }
      }
    }

    console.log(
      `[CRON] Marked ${expiredCount} subscription(s) as expired.`,
    );

    // ── Step 4: Data Deletion Warnings (7 days & 2 days before dataDeletionDate) ──
    const expiredWithDeletion = await prisma.tenantSubscription.findMany({
      where: {
        subscriptionStatus: "expired",
        dataDeletionDate: { gt: now },
      },
      include: { tenant: true },
    });

    for (const sub of expiredWithDeletion) {
      if (!sub.tenant?.email || !sub.dataDeletionDate) continue;

      const diffMs = new Date(sub.dataDeletionDate).getTime() - now.getTime();
      const daysUntilDeletion = Math.ceil(diffMs / DAY_MS);

      if (daysUntilDeletion !== 7 && daysUntilDeletion !== 2) continue;

      const reminderType = `DELETE_WARN_${daysUntilDeletion}D`;
      const recentWindow = new Date(now.getTime() - 20 * 60 * 60 * 1000);

      const alreadySent = await prisma.subscriptionReminder.findFirst({
        where: {
          tenantId: sub.tenantId,
          reminderType,
          sentAt: { gte: recentWindow },
        },
      });
      if (alreadySent) continue;

      await prisma.subscriptionReminder.create({
        data: {
          tenantId: sub.tenantId,
          reminderType,
        },
      });

      sendDataDeletionWarningEmail({
        toEmail: sub.tenant.email,
        tenantName: sub.tenant.tenantName,
        deletionDate: sub.dataDeletionDate,
        daysLeft: daysUntilDeletion,
      }).catch((err) =>
        console.error(
          `[CRON] Failed to send dataDeletionWarningEmail to ${sub.tenant.email}:`,
          err.message,
        ),
      );
    }
  } catch (error) {
    console.error("[CRON] Error checking expired subscriptions:", error);
  }
};

// Schedule to run every day at 00:05 AM server time
cron.schedule("5 0 * * *", checkExpiredSubscriptions);

export default checkExpiredSubscriptions;
```

---

### 7. `backend/src/cron/jobs/expiry-reminders.job.js`

*(Full-file replacement — >85% updated to use `TenantSubscription.plan.name`, add free trial expiry reminders (`3d, 1d`), and add grace period ending reminders (`2d, 1d`))*

```javascript
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
```

---

### 8. `backend/src/cron/jobs/abandoned-accounts.job.js`

*(Full-file replacement — >75% updated to use `deleteTenantsCompletely` from `utils/tenantDeletion.js`, covering all V2 tables and disk directories)*

```javascript
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
              { status: "REJECTED" },
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
```

---

### 9. `backend/src/cron/jobs/data-deletion.job.js` *(New File)*

```javascript
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
```

---

### 10. `backend/src/server.js`

*(Find-and-replace — register `./cron/jobs/data-deletion.job.js` alongside the existing subscription cron jobs)*

**REPLACE START:**
```javascript
import "./cron/jobs/expired-subscriptions.job.js";
import "./cron/jobs/expiry-reminders.job.js";
```
**WITH:**
```javascript
import "./cron/jobs/expired-subscriptions.job.js";
import "./cron/jobs/expiry-reminders.job.js";
import "./cron/jobs/data-deletion.job.js";
```
**REPLACE END**

---

### Next Step: Phase 6 (Final Phase) — V1 Legacy Purge & Verification

Phase 5 (5A, 5B, 5C, 5D) is now complete. We are ready for **Phase 6 — Complete V1 Purge & Verification**:
1. Delete legacy V1 plan/billing/subscription files:
   - `backend/src/lib/plan.limits.js`
   - `backend/src/modules/plans/*` (`invoice.service.js`, `plan.controller.js`, `plan.routes.js`, `plan.schema.js`, `plan.service.js`)
   - `backend/src/modules/billing/*` (`billing.controller.js`, `billing.routes.js`)
   - `backend/src/modules/admin-subscriptions/*` (`adminSubscription.controller.js`, `adminSubscription.routes.js`)
2. Clean up any remaining V1 references (`plan.limits`, `planStatus`, `Tenant.currentPlan`, etc.) across the backend.
3. Update `zDocs/PLANS_V2_CONTEXT.md` to mark Phases 4, 5, and 6 complete.

Before we execute Phase 6, please run this PowerShell grep command so we can verify every remaining reference in the codebase before generating the final cleanup:

```powershell
Get-ChildItem -Recurse backend\src -Include *.js | Select-String -Pattern "plan\.limits|modules/plans|modules/billing|admin-subscriptions|planStatus|enterprise_active|hasUsedTrial|gracePeriodUsed"
```

Paste the output of that command and reply **"Proceed with implementation Phase 6"**.