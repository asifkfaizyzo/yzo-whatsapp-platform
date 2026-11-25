/*
  Warnings:

  - Made the column `username` on table `tenants` required. This step will fail if there are existing NULL values in that column.
  - Made the column `username` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "tenants" ALTER COLUMN "username" SET NOT NULL;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;
