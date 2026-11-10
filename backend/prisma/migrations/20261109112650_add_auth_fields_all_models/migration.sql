/*
  Warnings:

  - A unique constraint covering the columns `[googleId]` on the table `tenants` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[facebookId]` on the table `tenants` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "super_admins" ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpiry" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "authProvider" TEXT NOT NULL DEFAULT 'LOCAL',
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "facebookId" TEXT,
ADD COLUMN     "googleId" TEXT,
ADD COLUMN     "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "otpAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "otpExpiresAt" TIMESTAMP(3),
ADD COLUMN     "otpHash" TEXT,
ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpiry" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpiry" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_googleId_key" ON "tenants"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_facebookId_key" ON "tenants"("facebookId");
