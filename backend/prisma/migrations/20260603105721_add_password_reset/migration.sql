/*
  Warnings:

  - You are about to drop the column `otp` on the `PasswordReset` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[token]` on the table `PasswordReset` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "PasswordReset" DROP COLUMN "otp",
ADD COLUMN     "token" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "PasswordReset_token_key" ON "PasswordReset"("token");
