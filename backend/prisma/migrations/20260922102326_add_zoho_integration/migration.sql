-- CreateEnum
CREATE TYPE "ZohoConnectionStatus" AS ENUM ('DISCONNECTED', 'CONNECTED', 'REFRESH_FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'ZOHO_CONNECTED';
ALTER TYPE "AuditAction" ADD VALUE 'ZOHO_DISCONNECTED';
ALTER TYPE "AuditAction" ADD VALUE 'ZOHO_TOKEN_REFRESH_FAILED';
ALTER TYPE "AuditAction" ADD VALUE 'ZOHO_SYNC_STARTED';
ALTER TYPE "AuditAction" ADD VALUE 'ZOHO_SYNC_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE 'ZOHO_SYNC_FAILED';

-- AlterEnum
ALTER TYPE "AuditModule" ADD VALUE 'INTEGRATIONS';

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "zohoAccessToken" TEXT,
ADD COLUMN     "zohoAccountEmail" TEXT,
ADD COLUMN     "zohoAccountId" TEXT,
ADD COLUMN     "zohoApiDomain" TEXT,
ADD COLUMN     "zohoConnectedAt" TIMESTAMP(3),
ADD COLUMN     "zohoConnectionStatus" "ZohoConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
ADD COLUMN     "zohoDataCenter" TEXT,
ADD COLUMN     "zohoRefreshToken" TEXT,
ADD COLUMN     "zohoScopes" TEXT,
ADD COLUMN     "zohoTokenExpiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ContactProviderMapping" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerContactId" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactProviderMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContactProviderMapping_contactId_provider_key" ON "ContactProviderMapping"("contactId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "ContactProviderMapping_tenantId_provider_providerContactId_key" ON "ContactProviderMapping"("tenantId", "provider", "providerContactId");

-- AddForeignKey
ALTER TABLE "ContactProviderMapping" ADD CONSTRAINT "ContactProviderMapping_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
