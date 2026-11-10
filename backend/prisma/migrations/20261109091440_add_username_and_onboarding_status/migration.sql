/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `super_admins` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[username]` on the table `tenants` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[username]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TenantStatus" ADD VALUE 'ONBOARDING';
ALTER TYPE "TenantStatus" ADD VALUE 'ACTIVE';

-- AlterTable
ALTER TABLE "super_admins" ADD COLUMN     "username" TEXT;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "username" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "super_admins_username_key" ON "super_admins"("username");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_username_key" ON "tenants"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
