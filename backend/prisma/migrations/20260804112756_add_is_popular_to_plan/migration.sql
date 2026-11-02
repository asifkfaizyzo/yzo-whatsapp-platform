-- backend/prisma/migrations/20260804112756_add_is_popular_to_plan/migration.sql (do not remove this comment)
-- AlterTable
ALTER TABLE "SubscriptionPlan" ADD COLUMN     "isPopular" BOOLEAN NOT NULL DEFAULT false;
