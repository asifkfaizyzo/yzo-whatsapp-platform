-- AlterTable
ALTER TABLE "Broadcast" ADD COLUMN     "campaignType" TEXT,
ADD COLUMN     "shopifyCustomerTags" JSONB,
ADD COLUMN     "shopifyProductId" TEXT,
ADD COLUMN     "shopifyProductTitle" TEXT,
ADD COLUMN     "shopifyProductUrl" TEXT;

-- CreateTable
CREATE TABLE "back_in_stock_subscriptions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "shopifyVariantId" TEXT,
    "productTitle" TEXT NOT NULL,
    "productHandle" TEXT,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "notifiedAt" TIMESTAMP(3),
    "broadcastId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "back_in_stock_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "back_in_stock_subscriptions_tenantId_shopifyProductId_notif_idx" ON "back_in_stock_subscriptions"("tenantId", "shopifyProductId", "notified");

-- CreateIndex
CREATE INDEX "back_in_stock_subscriptions_tenantId_contactPhone_idx" ON "back_in_stock_subscriptions"("tenantId", "contactPhone");

-- CreateIndex
CREATE UNIQUE INDEX "back_in_stock_subscriptions_tenantId_contactPhone_shopifyPr_key" ON "back_in_stock_subscriptions"("tenantId", "contactPhone", "shopifyProductId");
