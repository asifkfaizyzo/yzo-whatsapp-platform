-- CreateTable
CREATE TABLE "shopify_customer_data_exports" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "shopifyCustomerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "filePath" TEXT,
    "downloadTokenHash" TEXT,
    "expiresAt" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3),
    "downloadedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopify_customer_data_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shopify_customer_data_exports_downloadTokenHash_key" ON "shopify_customer_data_exports"("downloadTokenHash");

-- CreateIndex
CREATE INDEX "shopify_customer_data_exports_tenantId_storeId_shopifyCusto_idx" ON "shopify_customer_data_exports"("tenantId", "storeId", "shopifyCustomerId");

-- CreateIndex
CREATE INDEX "shopify_customer_data_exports_status_idx" ON "shopify_customer_data_exports"("status");

-- CreateIndex
CREATE INDEX "shopify_customer_data_exports_expiresAt_idx" ON "shopify_customer_data_exports"("expiresAt");

-- AddForeignKey
ALTER TABLE "shopify_customer_data_exports" ADD CONSTRAINT "shopify_customer_data_exports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopify_customer_data_exports" ADD CONSTRAINT "shopify_customer_data_exports_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "shopify_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
