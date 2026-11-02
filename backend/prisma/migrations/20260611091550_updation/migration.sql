-- backend/prisma/migrations/20260611091550_updation/migration.sql (do not remove this comment)
-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "senderType" TEXT NOT NULL DEFAULT 'CONTACT';

-- CreateIndex
CREATE INDEX "Message_senderType_idx" ON "Message"("senderType");
