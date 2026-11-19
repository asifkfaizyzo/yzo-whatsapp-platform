/*
  Warnings:

  - You are about to drop the column `isPopular` on the `subscription_plans` table. All the data in the column will be lost.
  - You are about to drop the column `maxAgents` on the `subscription_plans` table. All the data in the column will be lost.
  - You are about to drop the column `maxAiCredits` on the `subscription_plans` table. All the data in the column will be lost.
  - You are about to drop the column `maxApiCalls` on the `subscription_plans` table. All the data in the column will be lost.
  - You are about to drop the column `maxAutomations` on the `subscription_plans` table. All the data in the column will be lost.
  - You are about to drop the column `maxBroadcasts` on the `subscription_plans` table. All the data in the column will be lost.
  - You are about to drop the column `maxCampaigns` on the `subscription_plans` table. All the data in the column will be lost.
  - You are about to drop the column `billingType` on the `tenant_subscription` table. All the data in the column will be lost.
  - You are about to drop the column `hasUsedTrial` on the `tenant_subscription` table. All the data in the column will be lost.
  - You are about to drop the column `planStatus` on the `tenant_subscription` table. All the data in the column will be lost.
  - You are about to drop the column `trialExtendedByAdmin` on the `tenant_subscription` table. All the data in the column will be lost.
  - You are about to drop the column `trialExtendedCount` on the `tenant_subscription` table. All the data in the column will be lost.
  - You are about to drop the column `trialPlanId` on the `tenant_subscription` table. All the data in the column will be lost.
  - You are about to drop the `features` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `plan_features` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `plan_integrations` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `trialDays` on table `subscription_plans` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `tenant_subscription` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "PlanVisibility" AS ENUM ('PUBLIC', 'HIDDEN_LINK_ONLY', 'ADMIN_ONLY');

-- CreateEnum
CREATE TYPE "AddOnType" AS ENUM ('RECURRING', 'ONE_TIME_TOPUP');

-- DropForeignKey
ALTER TABLE "plan_features" DROP CONSTRAINT "plan_features_featureId_fkey";

-- DropForeignKey
ALTER TABLE "plan_features" DROP CONSTRAINT "plan_features_planId_fkey";

-- DropForeignKey
ALTER TABLE "plan_integrations" DROP CONSTRAINT "plan_integrations_planId_fkey";

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "addOnId" TEXT,
ADD COLUMN     "purchaseType" TEXT NOT NULL DEFAULT 'PLAN';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "addOnId" TEXT,
ADD COLUMN     "purchaseType" TEXT NOT NULL DEFAULT 'PLAN',
ALTER COLUMN "planId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "platform_settings" ADD COLUMN     "defaultGraceDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "paidRetentionDays" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "trialRetentionDays" INTEGER NOT NULL DEFAULT 7;

-- AlterTable
ALTER TABLE "subscription_plans" DROP COLUMN "isPopular",
DROP COLUMN "maxAgents",
DROP COLUMN "maxAiCredits",
DROP COLUMN "maxApiCalls",
DROP COLUMN "maxAutomations",
DROP COLUMN "maxBroadcasts",
DROP COLUMN "maxCampaigns",
ADD COLUMN     "badgeText" TEXT,
ADD COLUMN     "customTenantId" TEXT,
ADD COLUMN     "entitlements" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "offerValidUntil" TIMESTAMP(3),
ADD COLUMN     "originalPrice" DOUBLE PRECISION,
ADD COLUMN     "planType" TEXT NOT NULL DEFAULT 'REGULAR',
ADD COLUMN     "quarterlyPrice" DOUBLE PRECISION,
ADD COLUMN     "razorpayQuarterlyPlanId" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trialRequiresCard" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "visibility" "PlanVisibility" NOT NULL DEFAULT 'PUBLIC',
ALTER COLUMN "monthlyPrice" SET DEFAULT 0,
ALTER COLUMN "hasTrial" SET DEFAULT false,
ALTER COLUMN "trialDays" SET NOT NULL;

-- AlterTable
ALTER TABLE "tenant_subscription" DROP COLUMN "billingType",
DROP COLUMN "hasUsedTrial",
DROP COLUMN "planStatus",
DROP COLUMN "trialExtendedByAdmin",
DROP COLUMN "trialExtendedCount",
DROP COLUMN "trialPlanId",
ADD COLUMN     "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "customLimitsOverride" JSONB DEFAULT '{}',
ADD COLUMN     "freeUntilDate" TIMESTAMP(3),
ADD COLUMN     "graceDebtDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "graceDebtPlanPrice" DOUBLE PRECISION,
ADD COLUMN     "gracePeriodDays" INTEGER,
ADD COLUMN     "gracePeriodEnd" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "subscriptionStatus" SET DEFAULT 'expired';

-- DropTable
DROP TABLE "features";

-- DropTable
DROP TABLE "plan_features";

-- DropTable
DROP TABLE "plan_integrations";

-- CreateTable
CREATE TABLE "tenant_usages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "key" TEXT NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "bonus" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tenant_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_add_ons" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "type" "AddOnType" NOT NULL DEFAULT 'RECURRING',
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "price" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "entitlementKey" TEXT NOT NULL,
    "entitlementValue" JSONB NOT NULL,
    "razorpayPlanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_add_ons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_add_ons" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "addOnId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "razorpaySubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_add_ons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trial_email_registry" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trial_email_registry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenant_usages_tenantId_key_idx" ON "tenant_usages"("tenantId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_usages_tenantId_periodStart_periodEnd_key_key" ON "tenant_usages"("tenantId", "periodStart", "periodEnd", "key");

-- CreateIndex
CREATE UNIQUE INDEX "plan_add_ons_key_key" ON "plan_add_ons"("key");

-- CreateIndex
CREATE INDEX "plan_add_ons_isActive_idx" ON "plan_add_ons"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_add_ons_razorpaySubscriptionId_key" ON "tenant_add_ons"("razorpaySubscriptionId");

-- CreateIndex
CREATE INDEX "tenant_add_ons_tenantId_status_idx" ON "tenant_add_ons"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "trial_email_registry_email_key" ON "trial_email_registry"("email");

-- CreateIndex
CREATE INDEX "invoices_tenantId_idx" ON "invoices"("tenantId");

-- CreateIndex
CREATE INDEX "invoices_addOnId_idx" ON "invoices"("addOnId");

-- CreateIndex
CREATE INDEX "payments_addOnId_idx" ON "payments"("addOnId");

-- CreateIndex
CREATE INDEX "subscription_plans_planType_idx" ON "subscription_plans"("planType");

-- CreateIndex
CREATE INDEX "tenant_subscription_subscriptionStatus_idx" ON "tenant_subscription"("subscriptionStatus");

-- AddForeignKey
ALTER TABLE "tenant_usages" ADD CONSTRAINT "tenant_usages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_add_ons" ADD CONSTRAINT "tenant_add_ons_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_add_ons" ADD CONSTRAINT "tenant_add_ons_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "plan_add_ons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "plan_add_ons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "plan_add_ons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
