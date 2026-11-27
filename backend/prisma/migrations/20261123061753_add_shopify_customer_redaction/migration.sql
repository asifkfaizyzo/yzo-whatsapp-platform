-- CreateTable
CREATE TABLE "shopify_customer_redactions" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shopifyCustomerId" TEXT NOT NULL,
    "redactedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shopify_customer_redactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shopify_customer_redactions_tenantId_idx" ON "shopify_customer_redactions"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "shopify_customer_redactions_storeId_shopifyCustomerId_key" ON "shopify_customer_redactions"("storeId", "shopifyCustomerId");

-- AddForeignKey
ALTER TABLE "shopify_customer_redactions" ADD CONSTRAINT "shopify_customer_redactions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "shopify_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
