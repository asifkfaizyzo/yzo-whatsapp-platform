-- backend/prisma/migrations/20260703000000_add_archive_to_conversation/migration.sql (do not remove this comment)
ALTER TABLE "Conversation" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Conversation" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN "archivedBy" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "archivedByRole" TEXT;

CREATE INDEX "Conversation_tenantId_isArchived_idx" ON "Conversation"("tenantId", "isArchived");