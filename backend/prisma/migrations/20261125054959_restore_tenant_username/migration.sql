/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `tenants` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "tenants_username_key" ON "tenants"("username");
