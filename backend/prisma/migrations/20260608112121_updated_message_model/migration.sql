-- backend/prisma/migrations/20260608112121_updated_message_model/migration.sql (do not remove this comment)
-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "isRead" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'TEXT';
