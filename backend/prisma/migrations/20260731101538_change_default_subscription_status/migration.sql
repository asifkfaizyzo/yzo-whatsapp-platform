-- backend/prisma/migrations/20260731101538_change_default_subscription_status/migration.sql (do not remove this comment)
-- AlterTable
ALTER TABLE "Tenant" ALTER COLUMN "subscriptionStatus" SET DEFAULT 'trialing';
