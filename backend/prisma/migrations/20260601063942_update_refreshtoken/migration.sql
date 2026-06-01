/*
  Warnings:

  - You are about to drop the column `SuperAdminId` on the `RefreshToken` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "RefreshToken" DROP CONSTRAINT "RefreshToken_SuperAdminId_fkey";

-- AlterTable
ALTER TABLE "RefreshToken" DROP COLUMN "SuperAdminId",
ADD COLUMN     "superAdminId" TEXT;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_superAdminId_fkey" FOREIGN KEY ("superAdminId") REFERENCES "SuperAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
