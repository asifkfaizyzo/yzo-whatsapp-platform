-- backend/prisma/migrations/20261022153000_add_ecommerce_order_cart_recovery_id/migration.sql (do not remove this comment)
ALTER TABLE "ecommerce_orders"
ADD COLUMN "cartRecoveryId" TEXT;

CREATE INDEX "ecommerce_orders_tenantId_cartRecoveryId_idx"
ON "ecommerce_orders"("tenantId", "cartRecoveryId");
