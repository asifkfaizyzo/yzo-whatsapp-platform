-- backend/prisma/migrations/20260709045129_add_onboarding_stage/migration.sql (do not remove this comment)
-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "onboardingStage" INTEGER NOT NULL DEFAULT 1;
