-- backend/prisma/migrations/20260608094713_updated_conversation_model/migration.sql (do not remove this comment)
/*
  Warnings:

  - Added the required column `tenantId` to the `Conversation` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'OPEN',
ADD COLUMN     "tenantId" TEXT NOT NULL;
