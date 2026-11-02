-- backend/prisma/migrations/20260720072643_add_performance_indexes/migration.sql (do not remove this comment)
-- DropIndex
DROP INDEX "Contact_tenantId_idx";

-- DropIndex
DROP INDEX "Message_conversationId_idx";

-- CreateIndex
CREATE INDEX "Contact_tenantId_createdAt_idx" ON "Contact"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
