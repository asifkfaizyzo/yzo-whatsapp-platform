-- CreateTable
CREATE TABLE "ecommerce_orders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'WOOCOMMERCE',
    "externalOrderId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "paymentStatus" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "customerName" TEXT,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "shippingAddress" JSONB,
    "lineItems" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ecommerce_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ecommerce_orders_tenantId_customerPhone_idx" ON "ecommerce_orders"("tenantId", "customerPhone");

-- CreateIndex
CREATE INDEX "ecommerce_orders_tenantId_createdAt_idx" ON "ecommerce_orders"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ecommerce_orders_tenantId_source_externalOrderId_key" ON "ecommerce_orders"("tenantId", "source", "externalOrderId");

-- AddForeignKey
ALTER TABLE "ecommerce_orders" ADD CONSTRAINT "ecommerce_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
