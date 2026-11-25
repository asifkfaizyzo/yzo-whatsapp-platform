-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'PLAN_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'PLAN_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'PLAN_STATUS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'PLANS_REORDERED';
ALTER TYPE "AuditAction" ADD VALUE 'PLAN_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'ADDON_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'ADDON_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'ADDON_STATUS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'ADDON_REORDERED';
ALTER TYPE "AuditAction" ADD VALUE 'ADDON_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'SUBSCRIPTION_POLICY_UPDATED';
