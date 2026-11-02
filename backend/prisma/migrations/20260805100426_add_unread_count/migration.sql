-- backend/prisma/migrations/20260805100426_add_unread_count/migration.sql (do not remove this comment)
-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "unreadCount" INTEGER NOT NULL DEFAULT 0;
