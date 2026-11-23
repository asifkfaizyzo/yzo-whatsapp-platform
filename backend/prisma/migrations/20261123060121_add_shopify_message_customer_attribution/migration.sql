-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "shopifyCustomerId" TEXT;

-- CreateIndex
CREATE INDEX "messages_source_shopifyStoreId_shopifyCustomerId_idx" ON "messages"("source", "shopifyStoreId", "shopifyCustomerId");
