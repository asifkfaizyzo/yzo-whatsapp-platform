-- AlterTable
ALTER TABLE "ecommerce_orders" ADD COLUMN     "crossSellSentAt" TIMESTAMP(3),
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "reorderReminderSentAt" TIMESTAMP(3),
ADD COLUMN     "upsellSentAt" TIMESTAMP(3),
ADD COLUMN     "winBackSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "shopify_connections" ADD COLUMN     "postPurchaseCrossSellEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "postPurchaseReorderDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "postPurchaseReorderEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "postPurchaseReviewDelayDays" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "postPurchaseReviewEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "postPurchaseUpsellEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "postPurchaseWinBackDays" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "postPurchaseWinBackEnabled" BOOLEAN NOT NULL DEFAULT false;
