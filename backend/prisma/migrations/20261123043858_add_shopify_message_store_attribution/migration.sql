-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "shopifyStoreId" TEXT,
ADD COLUMN     "source" TEXT;

-- CreateIndex
CREATE INDEX "messages_source_shopifyStoreId_idx" ON "messages"("source", "shopifyStoreId");
