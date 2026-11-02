-- backend/prisma/migrations/20260924052153_add_pinned_fields/migration.sql (do not remove this comment)
-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pinnedAt" TIMESTAMP(3);
