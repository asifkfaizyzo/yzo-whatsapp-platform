/*
  Warnings:

  - A unique constraint covering the columns `[facebookId]` on the table `Tenant` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "facebookId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_facebookId_key" ON "Tenant"("facebookId");
