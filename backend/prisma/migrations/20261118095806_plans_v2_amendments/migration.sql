/*
  Warnings:

  - A unique constraint covering the columns `[paymentId]` on the table `invoices` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'SUBSCRIPTION_EXTENDED';
ALTER TYPE "AuditAction" ADD VALUE 'SUBSCRIPTION_TRIAL_EXTENDED';
ALTER TYPE "AuditAction" ADD VALUE 'SUBSCRIPTION_PAUSED';
ALTER TYPE "AuditAction" ADD VALUE 'SUBSCRIPTION_REACTIVATED';
ALTER TYPE "AuditAction" ADD VALUE 'SUBSCRIPTION_EXPIRED';
ALTER TYPE "AuditAction" ADD VALUE 'SUBSCRIPTION_LIMITS_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'SUBSCRIPTION_GRACE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'SUBSCRIPTION_FREE_UNTIL_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'SUBSCRIPTION_ADDON_GRANTED';
ALTER TYPE "AuditAction" ADD VALUE 'SUBSCRIPTION_ADDON_REVOKED';
ALTER TYPE "AuditAction" ADD VALUE 'TRIAL_STARTED';
ALTER TYPE "AuditAction" ADD VALUE 'PLAN_CHANGE_SCHEDULED';
ALTER TYPE "AuditAction" ADD VALUE 'PLAN_CHANGE_APPLIED';
ALTER TYPE "AuditAction" ADD VALUE 'PLAN_CHANGE_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE 'ADDON_PURCHASED';
ALTER TYPE "AuditAction" ADD VALUE 'ADDON_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE 'TOPUP_PURCHASED';
ALTER TYPE "AuditAction" ADD VALUE 'GRACE_PERIOD_STARTED';
ALTER TYPE "AuditAction" ADD VALUE 'SUBSCRIPTION_BLOCKED';
ALTER TYPE "AuditAction" ADD VALUE 'TENANT_DATA_PURGED';

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "billingCycle" "BillingCycle",
ADD COLUMN     "paymentId" TEXT;

-- AlterTable
ALTER TABLE "tenant_add_ons" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'PURCHASE';

-- AlterTable
ALTER TABLE "tenant_subscription" ADD COLUMN     "pendingBillingCycle" "BillingCycle",
ADD COLUMN     "pendingPlanId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "invoices_paymentId_key" ON "invoices"("paymentId");

-- CreateIndex
CREATE INDEX "tenant_subscription_planId_idx" ON "tenant_subscription"("planId");

-- CreateIndex
CREATE INDEX "tenant_subscription_pendingPlanId_idx" ON "tenant_subscription"("pendingPlanId");

-- AddForeignKey
ALTER TABLE "tenant_subscription" ADD CONSTRAINT "tenant_subscription_pendingPlanId_fkey" FOREIGN KEY ("pendingPlanId") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
