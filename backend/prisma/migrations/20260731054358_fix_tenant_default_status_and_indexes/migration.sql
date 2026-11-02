-- backend/prisma/migrations/20260731054358_fix_tenant_default_status_and_indexes/migration.sql (do not remove this comment)
-- AlterTable
ALTER TABLE "Tenant" ALTER COLUMN "subscriptionStatus" SET DEFAULT 'expired';

-- CreateIndex
CREATE INDEX "Tenant_whatsappPhoneId_idx" ON "Tenant"("whatsappPhoneId");

-- CreateIndex
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");
