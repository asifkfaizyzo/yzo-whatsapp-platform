-- AlterTable
ALTER TABLE "ecommerce_orders" ADD COLUMN     "cartReminder1SentAt" TIMESTAMP(3),
ADD COLUMN     "cartReminder24SentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "woocommerce_connections" ADD COLUMN     "cartReminder1Text" TEXT,
ADD COLUMN     "cartReminder24Text" TEXT;
