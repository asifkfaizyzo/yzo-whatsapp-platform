-- backend/prisma/migrations/20260630051210_add_message_status/migration.sql (do not remove this comment)
-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'sent';
