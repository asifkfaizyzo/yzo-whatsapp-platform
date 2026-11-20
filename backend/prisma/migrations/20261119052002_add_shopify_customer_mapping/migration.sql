-- CreateTable
CREATE TABLE "shopify_customer_mappings" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "shopifyCustomerId" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopify_customer_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shopify_customer_mappings_tenantId_idx" ON "shopify_customer_mappings"("tenantId");

-- CreateIndex
CREATE INDEX "shopify_customer_mappings_contactId_idx" ON "shopify_customer_mappings"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "shopify_customer_mappings_storeId_shopifyCustomerId_key" ON "shopify_customer_mappings"("storeId", "shopifyCustomerId");

-- AddForeignKey
ALTER TABLE "shopify_customer_mappings" ADD CONSTRAINT "shopify_customer_mappings_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "shopify_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopify_customer_mappings" ADD CONSTRAINT "shopify_customer_mappings_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
