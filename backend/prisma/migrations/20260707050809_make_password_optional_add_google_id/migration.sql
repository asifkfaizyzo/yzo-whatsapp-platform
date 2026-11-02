-- backend/prisma/migrations/20260707050809_make_password_optional_add_google_id/migration.sql (do not remove this comment)
/*
  Warnings:

  - A unique constraint covering the columns `[googleId]` on the table `Tenant` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "authProvider" TEXT NOT NULL DEFAULT 'LOCAL',
ADD COLUMN     "googleId" TEXT,
ALTER COLUMN "password" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_googleId_key" ON "Tenant"("googleId");
