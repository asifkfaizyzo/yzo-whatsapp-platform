-- AlterTable
ALTER TABLE "ecommerce_orders" ADD COLUMN     "cartReminder48SentAt" TIMESTAMP(3),
ADD COLUMN     "cartStatus" TEXT;

-- AlterTable
ALTER TABLE "shopify_connections" ADD COLUMN     "cartDiscountCode" TEXT,
ADD COLUMN     "cartDiscountLabel" TEXT,
ADD COLUMN     "cartIncludeImage" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cartRecoveryEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cartReminder1Enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cartReminder1Text" TEXT,
ADD COLUMN     "cartReminder24Enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cartReminder24Text" TEXT,
ADD COLUMN     "cartReminder48Enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cartReminder48Text" TEXT;

-- AlterTable
ALTER TABLE "woocommerce_connections" ADD COLUMN     "cartDiscountCode" TEXT,
ADD COLUMN     "cartDiscountLabel" TEXT,
ADD COLUMN     "cartIncludeImage" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cartRecoveryEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cartReminder1Enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cartReminder24Enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cartReminder48Enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cartReminder48Text" TEXT;
