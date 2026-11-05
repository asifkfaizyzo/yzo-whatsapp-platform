/*
  Warnings:

  - The `subscriptionStatus` column on the `tenant_subscription` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `razorpayAuthType` column on the `tenant_subscription` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `razorpayAccountStatus` column on the `tenant_subscription` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `razorpayKycStatus` column on the `tenant_subscription` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `zohoConnectionStatus` column on the `tenant_zoho` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[tenantId]` on the table `tenant_auth` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId]` on the table `tenant_social` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId]` on the table `tenant_subscription` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId]` on the table `tenant_whatsapp` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId]` on the table `tenant_zoho` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "tenant_subscription" DROP COLUMN "subscriptionStatus",
ADD COLUMN     "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'trialing',
DROP COLUMN "razorpayAuthType",
ADD COLUMN     "razorpayAuthType" "RazorpayAuthType" NOT NULL DEFAULT 'DIRECT_KEYS',
DROP COLUMN "razorpayAccountStatus",
ADD COLUMN     "razorpayAccountStatus" "RazorpayAccountStatus" NOT NULL DEFAULT 'DISCONNECTED',
DROP COLUMN "razorpayKycStatus",
ADD COLUMN     "razorpayKycStatus" "RazorpayKycStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "tenant_zoho" DROP COLUMN "zohoConnectionStatus",
ADD COLUMN     "zohoConnectionStatus" "ZohoConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED';

-- CreateIndex
CREATE UNIQUE INDEX "tenant_auth_tenantId_key" ON "tenant_auth"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_social_tenantId_key" ON "tenant_social"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_subscription_tenantId_key" ON "tenant_subscription"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_whatsapp_tenantId_key" ON "tenant_whatsapp"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_zoho_tenantId_key" ON "tenant_zoho"("tenantId");
