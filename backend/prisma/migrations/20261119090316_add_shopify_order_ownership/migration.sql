-- AlterTable
ALTER TABLE "ecommerce_orders" ADD COLUMN     "shopifyCustomerId" TEXT,
ADD COLUMN     "shopifyStoreId" TEXT;

-- CreateIndex
CREATE INDEX "ecommerce_orders_shopifyStoreId_shopifyCustomerId_idx" ON "ecommerce_orders"("shopifyStoreId", "shopifyCustomerId");

-- CreateIndex
CREATE INDEX "ecommerce_orders_tenantId_source_shopifyStoreId_idx" ON "ecommerce_orders"("tenantId", "source", "shopifyStoreId");

-- AddForeignKey
ALTER TABLE "ecommerce_orders" ADD CONSTRAINT "ecommerce_orders_shopifyStoreId_fkey" FOREIGN KEY ("shopifyStoreId") REFERENCES "shopify_stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
