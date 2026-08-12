-- AlterTable
ALTER TABLE "Tenant" ALTER COLUMN "subscriptionStatus" SET DEFAULT 'expired';

-- CreateIndex
CREATE INDEX "Tenant_whatsappPhoneId_idx" ON "Tenant"("whatsappPhoneId");

-- CreateIndex
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");
