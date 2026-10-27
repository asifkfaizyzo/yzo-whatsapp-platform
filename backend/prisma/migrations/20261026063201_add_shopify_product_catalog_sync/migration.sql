-- CreateEnum
CREATE TYPE "ShopifyProductStatus" AS ENUM ('ACTIVE', 'DRAFT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ShopifySyncStatus" AS ENUM ('SYNCED', 'ERROR', 'PENDING', 'DELETED');

-- CreateTable
CREATE TABLE "shopify_products" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "handle" TEXT NOT NULL,
    "productUrl" TEXT NOT NULL,
    "vendor" TEXT,
    "productType" TEXT,
    "tags" TEXT,
    "status" "ShopifyProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "syncStatus" "ShopifySyncStatus" NOT NULL DEFAULT 'SYNCED',
    "syncError" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shopifyUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopify_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopify_product_variants" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "shopifyVariantId" TEXT NOT NULL,
    "title" TEXT,
    "sku" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "compareAtPrice" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "inventoryQuantity" INTEGER NOT NULL DEFAULT 0,
    "inventoryPolicy" TEXT,
    "availability" TEXT NOT NULL DEFAULT 'in_stock',
    "weight" DOUBLE PRECISION,
    "weightUnit" TEXT,
    "requiresShipping" BOOLEAN NOT NULL DEFAULT true,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "barcode" TEXT,
    "option1" TEXT,
    "option2" TEXT,
    "option3" TEXT,
    "shopifyUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopify_product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopify_product_images" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "shopifyImageId" TEXT NOT NULL,
    "src" TEXT NOT NULL,
    "alt" TEXT,
    "position" INTEGER NOT NULL DEFAULT 1,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopify_product_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shopify_products_tenantId_status_idx" ON "shopify_products"("tenantId", "status");

-- CreateIndex
CREATE INDEX "shopify_products_tenantId_syncStatus_idx" ON "shopify_products"("tenantId", "syncStatus");

-- CreateIndex
CREATE INDEX "shopify_products_tenantId_handle_idx" ON "shopify_products"("tenantId", "handle");

-- CreateIndex
CREATE UNIQUE INDEX "shopify_products_tenantId_shopifyProductId_key" ON "shopify_products"("tenantId", "shopifyProductId");

-- CreateIndex
CREATE INDEX "shopify_product_variants_productId_idx" ON "shopify_product_variants"("productId");

-- CreateIndex
CREATE INDEX "shopify_product_variants_sku_idx" ON "shopify_product_variants"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "shopify_product_variants_productId_shopifyVariantId_key" ON "shopify_product_variants"("productId", "shopifyVariantId");

-- CreateIndex
CREATE INDEX "shopify_product_images_productId_position_idx" ON "shopify_product_images"("productId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "shopify_product_images_productId_shopifyImageId_key" ON "shopify_product_images"("productId", "shopifyImageId");

-- AddForeignKey
ALTER TABLE "shopify_products" ADD CONSTRAINT "shopify_products_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopify_product_variants" ADD CONSTRAINT "shopify_product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "shopify_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopify_product_images" ADD CONSTRAINT "shopify_product_images_productId_fkey" FOREIGN KEY ("productId") REFERENCES "shopify_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
