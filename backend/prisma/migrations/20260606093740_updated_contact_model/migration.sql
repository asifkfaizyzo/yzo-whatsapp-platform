-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedTo" TEXT;

-- CreateIndex
CREATE INDEX "Contact_assignedTo_idx" ON "Contact"("assignedTo");

-- CreateIndex
CREATE INDEX "Contact_tenantId_idx" ON "Contact"("tenantId");
