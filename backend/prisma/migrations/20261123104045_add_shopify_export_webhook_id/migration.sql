/*
  Warnings:

  - A unique constraint covering the columns `[storeId,webhookId]` on the table `shopify_customer_data_exports` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `webhookId` to the `shopify_customer_data_exports` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "shopify_customer_data_exports" ADD COLUMN     "webhookId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "shopify_customer_data_exports_storeId_webhookId_key" ON "shopify_customer_data_exports"("storeId", "webhookId");
