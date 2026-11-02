-- backend/prisma/migrations/20261005080000_add_ecommerce_order_tracking/migration.sql (do not remove this comment)
ALTER TABLE "ecommerce_orders"
ADD COLUMN "trackingInfo" JSONB;