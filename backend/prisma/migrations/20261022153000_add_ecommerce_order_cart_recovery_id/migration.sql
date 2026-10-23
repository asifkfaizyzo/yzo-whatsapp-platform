ALTER TABLE "ecommerce_orders"
ADD COLUMN "cartRecoveryId" TEXT;

CREATE INDEX "ecommerce_orders_tenantId_cartRecoveryId_idx"
ON "ecommerce_orders"("tenantId", "cartRecoveryId");
