-- backend/prisma/migrations/20261012092912_add_cart_recovery_fields/migration.sql (do not remove this comment)
-- AlterTable
ALTER TABLE "ecommerce_orders" ADD COLUMN     "cartReminder1SentAt" TIMESTAMP(3),
ADD COLUMN     "cartReminder24SentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "woocommerce_connections" ADD COLUMN     "cartReminder1Text" TEXT,
ADD COLUMN     "cartReminder24Text" TEXT;
