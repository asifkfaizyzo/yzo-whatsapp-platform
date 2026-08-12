/*
  Warnings:

  - You are about to drop the column `onboardingStage` on the `Tenant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Tenant" DROP COLUMN "onboardingStage",
ADD COLUMN     "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboardingStep" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "useCase" TEXT,
ALTER COLUMN "tenantName" DROP NOT NULL,
ALTER COLUMN "email" DROP NOT NULL;
