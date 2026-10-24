-- AlterTable
ALTER TABLE "woocommerce_connections" ADD COLUMN     "alertPhone" TEXT,
ADD COLUMN     "dailySummaryAlert" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dailySummaryHour" INTEGER NOT NULL DEFAULT 21,
ADD COLUMN     "lastDailySummaryAt" TIMESTAMP(3),
ADD COLUMN     "lowStockAlert" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lowStockAlertCache" JSONB DEFAULT '{}',
ADD COLUMN     "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "newOrderAlert" BOOLEAN NOT NULL DEFAULT false;
