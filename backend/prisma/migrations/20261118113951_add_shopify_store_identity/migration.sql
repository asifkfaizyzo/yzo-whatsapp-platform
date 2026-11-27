/*
  Warnings:

  - A unique constraint covering the columns `[storeId]` on the table `shopify_connections` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "shopify_connections" ADD COLUMN     "storeId" TEXT;

-- CreateTable
CREATE TABLE "shopify_stores" (
    "id" TEXT NOT NULL,
    "shopifyShopId" TEXT,
    "shopDomain" TEXT NOT NULL,
    "tenantId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "disconnectedAt" TIMESTAMP(3),
    "redactedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopify_stores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shopify_stores_shopifyShopId_key" ON "shopify_stores"("shopifyShopId");

-- CreateIndex
CREATE UNIQUE INDEX "shopify_stores_shopDomain_key" ON "shopify_stores"("shopDomain");

-- CreateIndex
CREATE INDEX "shopify_stores_tenantId_idx" ON "shopify_stores"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "shopify_connections_storeId_key" ON "shopify_connections"("storeId");

-- AddForeignKey
ALTER TABLE "shopify_connections" ADD CONSTRAINT "shopify_connections_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "shopify_stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopify_stores" ADD CONSTRAINT "shopify_stores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
