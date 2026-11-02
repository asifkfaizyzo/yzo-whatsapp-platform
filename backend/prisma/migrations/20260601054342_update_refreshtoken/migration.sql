-- backend/prisma/migrations/20260601054342_update_refreshtoken/migration.sql (do not remove this comment)
/*
  Warnings:

  - You are about to drop the column `refreshToken` on the `SuperAdmin` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "SuperAdminId" TEXT;

-- AlterTable
ALTER TABLE "SuperAdmin" DROP COLUMN "refreshToken";

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_SuperAdminId_fkey" FOREIGN KEY ("SuperAdminId") REFERENCES "SuperAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
