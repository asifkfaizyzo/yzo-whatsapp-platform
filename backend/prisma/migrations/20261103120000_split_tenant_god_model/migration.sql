-- ═══════════════════════════════════════════════════════════
-- Phase 3: Split Tenant God Model into 5 focused 1:1 tables
-- ═══════════════════════════════════════════════════════════

-- ── STEP 1: Create new tables ──

CREATE TABLE "tenant_auth" (
    "tenantId"        TEXT NOT NULL,
    "googleId"        TEXT,
    "facebookId"      TEXT,
    "authProvider"    TEXT NOT NULL DEFAULT 'LOCAL',
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "otpHash"         TEXT,
    "otpExpiresAt"    TIMESTAMP(3),

    CONSTRAINT "tenant_auth_pkey" PRIMARY KEY ("tenantId")
);

CREATE TABLE "tenant_whatsapp" (
    "tenantId"            TEXT NOT NULL,
    "whatsappPhoneId"     TEXT,
    "whatsappWabaId"      TEXT,
    "whatsappAccessToken" TEXT,
    "whatsappVerifyToken" TEXT DEFAULT 'yzo_default_verification_token',
    "whatsappPin"         TEXT,
    "whatsappCatalogId"   TEXT,

    CONSTRAINT "tenant_whatsapp_pkey" PRIMARY KEY ("tenantId")
);

CREATE TABLE "tenant_social" (
    "tenantId"                TEXT NOT NULL,
    "facebookPageId"          TEXT,
    "facebookPageName"        TEXT,
    "facebookPageAccessToken" TEXT,
    "instagramAccountId"      TEXT,
    "instagramUsername"       TEXT,

    CONSTRAINT "tenant_social_pkey" PRIMARY KEY ("tenantId")
);

CREATE TABLE "tenant_zoho" (
    "tenantId"             TEXT NOT NULL,
    "zohoAccessToken"      TEXT,
    "zohoRefreshToken"     TEXT,
    "zohoTokenExpiresAt"   TIMESTAMP(3),
    "zohoAccountId"        TEXT,
    "zohoDataCenter"       TEXT,
    "zohoApiDomain"        TEXT,
    "zohoAccountEmail"     TEXT,
    "zohoConnectionStatus" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "zohoConnectedAt"      TIMESTAMP(3),
    "zohoScopes"           TEXT,

    CONSTRAINT "tenant_zoho_pkey" PRIMARY KEY ("tenantId")
);

CREATE TABLE "tenant_subscription" (
    "tenantId"               TEXT NOT NULL,
    "planId"                 TEXT,
    "planActivatedAt"        TIMESTAMP(3),
    "billingType"            TEXT DEFAULT 'monthly',
    "planStatus"             TEXT DEFAULT 'inactive',
    "subscriptionStatus"     TEXT NOT NULL DEFAULT 'trialing',
    "currentPlan"            TEXT,
    "planPeriodStart"        TIMESTAMP(3),
    "planPeriodEnd"          TIMESTAMP(3),
    "cancelRequestedAt"      TIMESTAMP(3),
    "cancellationReason"     TEXT,
    "reactivatedAt"          TIMESTAMP(3),
    "dataDeletionDate"       TIMESTAMP(3),
    "hasUsedTrial"           BOOLEAN NOT NULL DEFAULT false,
    "trialPlanId"            TEXT,
    "trialExtendedCount"     INTEGER NOT NULL DEFAULT 0,
    "trialExtendedByAdmin"   TEXT,
    "razorpayCustomerId"     TEXT,
    "razorpaySubscriptionId" TEXT,
    "autopayEnabled"         BOOLEAN NOT NULL DEFAULT false,
    "autopayMethod"          TEXT,
    "razorpayKeyId"          TEXT,
    "razorpayKeySecret"      TEXT,
    "razorpayWebhookSecret"  TEXT,
    "enableOnlinePayment"    BOOLEAN NOT NULL DEFAULT false,
    "enableCod"              BOOLEAN NOT NULL DEFAULT true,
    "defaultCurrency"        TEXT NOT NULL DEFAULT 'INR',
    "paymentLinkExpiryMins"  INTEGER NOT NULL DEFAULT 30,
    "autoConfirmOnPayment"   BOOLEAN NOT NULL DEFAULT true,
    "razorpayAuthType"       TEXT NOT NULL DEFAULT 'DIRECT_KEYS',
    "razorpayAccountId"      TEXT,
    "razorpayAccessToken"    TEXT,
    "razorpayRefreshToken"   TEXT,
    "razorpayTokenExpiresAt" TIMESTAMP(3),
    "razorpayWebhookId"      TEXT,
    "razorpayAccountStatus"  TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "razorpayKycStatus"      TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "tenant_subscription_pkey" PRIMARY KEY ("tenantId")
);

-- ── STEP 2: Add FK constraints to new tables ──

ALTER TABLE "tenant_auth"
    ADD CONSTRAINT "tenant_auth_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tenant_whatsapp"
    ADD CONSTRAINT "tenant_whatsapp_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tenant_social"
    ADD CONSTRAINT "tenant_social_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tenant_zoho"
    ADD CONSTRAINT "tenant_zoho_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tenant_subscription"
    ADD CONSTRAINT "tenant_subscription_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tenant_subscription"
    ADD CONSTRAINT "tenant_subscription_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── STEP 3: Add unique constraints + indexes on new tables ──

CREATE UNIQUE INDEX "tenant_auth_googleId_key" ON "tenant_auth"("googleId");
CREATE UNIQUE INDEX "tenant_auth_facebookId_key" ON "tenant_auth"("facebookId");

CREATE INDEX "tenant_whatsapp_whatsappPhoneId_idx" ON "tenant_whatsapp"("whatsappPhoneId");

CREATE UNIQUE INDEX "tenant_subscription_razorpaySubscriptionId_key" ON "tenant_subscription"("razorpaySubscriptionId");
CREATE INDEX "tenant_subscription_razorpayAccountId_idx" ON "tenant_subscription"("razorpayAccountId");

-- ── STEP 4: Copy data from tenants → new tables ──

INSERT INTO "tenant_auth" ("tenantId", "googleId", "facebookId", "authProvider", "isEmailVerified", "otpHash", "otpExpiresAt")
SELECT "id", "googleId", "facebookId", "authProvider", "isEmailVerified", "otpHash", "otpExpiresAt"
FROM "tenants";

INSERT INTO "tenant_whatsapp" ("tenantId", "whatsappPhoneId", "whatsappWabaId", "whatsappAccessToken", "whatsappVerifyToken", "whatsappPin", "whatsappCatalogId")
SELECT "id", "whatsappPhoneId", "whatsappWabaId", "whatsappAccessToken", "whatsappVerifyToken", "whatsappPin", "whatsappCatalogId"
FROM "tenants";

INSERT INTO "tenant_social" ("tenantId", "facebookPageId", "facebookPageName", "facebookPageAccessToken", "instagramAccountId", "instagramUsername")
SELECT "id", "facebookPageId", "facebookPageName", "facebookPageAccessToken", "instagramAccountId", "instagramUsername"
FROM "tenants";

INSERT INTO "tenant_zoho" ("tenantId", "zohoAccessToken", "zohoRefreshToken", "zohoTokenExpiresAt", "zohoAccountId", "zohoDataCenter", "zohoApiDomain", "zohoAccountEmail", "zohoConnectionStatus", "zohoConnectedAt", "zohoScopes")
SELECT "id", "zohoAccessToken", "zohoRefreshToken", "zohoTokenExpiresAt", "zohoAccountId", "zohoDataCenter", "zohoApiDomain", "zohoAccountEmail", "zohoConnectionStatus", "zohoConnectedAt", "zohoScopes"
FROM "tenants";

INSERT INTO "tenant_subscription" ("tenantId", "planId", "planActivatedAt", "billingType", "planStatus", "subscriptionStatus", "currentPlan", "planPeriodStart", "planPeriodEnd", "cancelRequestedAt", "cancellationReason", "reactivatedAt", "dataDeletionDate", "hasUsedTrial", "trialPlanId", "trialExtendedCount", "trialExtendedByAdmin", "razorpayCustomerId", "razorpaySubscriptionId", "autopayEnabled", "autopayMethod", "razorpayKeyId", "razorpayKeySecret", "razorpayWebhookSecret", "enableOnlinePayment", "enableCod", "defaultCurrency", "paymentLinkExpiryMins", "autoConfirmOnPayment", "razorpayAuthType", "razorpayAccountId", "razorpayAccessToken", "razorpayRefreshToken", "razorpayTokenExpiresAt", "razorpayWebhookId", "razorpayAccountStatus", "razorpayKycStatus")
SELECT "id", "planId", "planActivatedAt", "billingType", "planStatus", "subscriptionStatus", "currentPlan", "planPeriodStart", "planPeriodEnd", "cancelRequestedAt", "cancellationReason", "reactivatedAt", "dataDeletionDate", "hasUsedTrial", "trialPlanId", "trialExtendedCount", "trialExtendedByAdmin", "razorpayCustomerId", "razorpaySubscriptionId", "autopayEnabled", "autopayMethod", "razorpayKeyId", "razorpayKeySecret", "razorpayWebhookSecret", "enableOnlinePayment", "enableCod", "defaultCurrency", "paymentLinkExpiryMins", "autoConfirmOnPayment", "razorpayAuthType", "razorpayAccountId", "razorpayAccessToken", "razorpayRefreshToken", "razorpayTokenExpiresAt", "razorpayWebhookId", "razorpayAccountStatus", "razorpayKycStatus"
FROM "tenants";

-- ── STEP 5: Drop old constraints + indexes from tenants ──
-- (Must drop BEFORE dropping columns)

-- Drop FK on planId first
ALTER TABLE "tenants" DROP CONSTRAINT IF EXISTS "tenants_planId_fkey";

-- Drop unique constraints on columns we're moving
DROP INDEX IF EXISTS "tenants_googleId_key";
DROP INDEX IF EXISTS "tenants_facebookId_key";
DROP INDEX IF EXISTS "tenants_razorpaySubscriptionId_key";

-- Drop indexes on columns we're moving
DROP INDEX IF EXISTS "tenants_whatsappPhoneId_idx";
DROP INDEX IF EXISTS "tenants_razorpayAccountId_idx";

-- ── STEP 6: Drop 63 columns from tenants ──

ALTER TABLE "tenants"
    DROP COLUMN IF EXISTS "googleId",
    DROP COLUMN IF EXISTS "facebookId",
    DROP COLUMN IF EXISTS "authProvider",
    DROP COLUMN IF EXISTS "isEmailVerified",
    DROP COLUMN IF EXISTS "otpHash",
    DROP COLUMN IF EXISTS "otpExpiresAt",
    DROP COLUMN IF EXISTS "whatsappPhoneId",
    DROP COLUMN IF EXISTS "whatsappWabaId",
    DROP COLUMN IF EXISTS "whatsappAccessToken",
    DROP COLUMN IF EXISTS "whatsappVerifyToken",
    DROP COLUMN IF EXISTS "whatsappPin",
    DROP COLUMN IF EXISTS "whatsappCatalogId",
    DROP COLUMN IF EXISTS "facebookPageId",
    DROP COLUMN IF EXISTS "facebookPageName",
    DROP COLUMN IF EXISTS "facebookPageAccessToken",
    DROP COLUMN IF EXISTS "instagramAccountId",
    DROP COLUMN IF EXISTS "instagramUsername",
    DROP COLUMN IF EXISTS "zohoAccessToken",
    DROP COLUMN IF EXISTS "zohoRefreshToken",
    DROP COLUMN IF EXISTS "zohoTokenExpiresAt",
    DROP COLUMN IF EXISTS "zohoAccountId",
    DROP COLUMN IF EXISTS "zohoDataCenter",
    DROP COLUMN IF EXISTS "zohoApiDomain",
    DROP COLUMN IF EXISTS "zohoAccountEmail",
    DROP COLUMN IF EXISTS "zohoConnectionStatus",
    DROP COLUMN IF EXISTS "zohoConnectedAt",
    DROP COLUMN IF EXISTS "zohoScopes",
    DROP COLUMN IF EXISTS "planId",
    DROP COLUMN IF EXISTS "planActivatedAt",
    DROP COLUMN IF EXISTS "billingType",
    DROP COLUMN IF EXISTS "planStatus",
    DROP COLUMN IF EXISTS "subscriptionStatus",
    DROP COLUMN IF EXISTS "currentPlan",
    DROP COLUMN IF EXISTS "planPeriodStart",
    DROP COLUMN IF EXISTS "planPeriodEnd",
    DROP COLUMN IF EXISTS "cancelRequestedAt",
    DROP COLUMN IF EXISTS "cancellationReason",
    DROP COLUMN IF EXISTS "reactivatedAt",
    DROP COLUMN IF EXISTS "dataDeletionDate",
    DROP COLUMN IF EXISTS "hasUsedTrial",
    DROP COLUMN IF EXISTS "trialPlanId",
    DROP COLUMN IF EXISTS "trialExtendedCount",
    DROP COLUMN IF EXISTS "trialExtendedByAdmin",
    DROP COLUMN IF EXISTS "razorpayCustomerId",
    DROP COLUMN IF EXISTS "razorpaySubscriptionId",
    DROP COLUMN IF EXISTS "autopayEnabled",
    DROP COLUMN IF EXISTS "autopayMethod",
    DROP COLUMN IF EXISTS "razorpayKeyId",
    DROP COLUMN IF EXISTS "razorpayKeySecret",
    DROP COLUMN IF EXISTS "razorpayWebhookSecret",
    DROP COLUMN IF EXISTS "enableOnlinePayment",
    DROP COLUMN IF EXISTS "enableCod",
    DROP COLUMN IF EXISTS "defaultCurrency",
    DROP COLUMN IF EXISTS "paymentLinkExpiryMins",
    DROP COLUMN IF EXISTS "autoConfirmOnPayment",
    DROP COLUMN IF EXISTS "razorpayAuthType",
    DROP COLUMN IF EXISTS "razorpayAccountId",
    DROP COLUMN IF EXISTS "razorpayAccessToken",
    DROP COLUMN IF EXISTS "razorpayRefreshToken",
    DROP COLUMN IF EXISTS "razorpayTokenExpiresAt",
    DROP COLUMN IF EXISTS "razorpayWebhookId",
    DROP COLUMN IF EXISTS "razorpayAccountStatus",
    DROP COLUMN IF EXISTS "razorpayKycStatus";