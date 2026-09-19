-- CreateEnum
CREATE TYPE "OrderPaymentStatus" AS ENUM ('UNPAID', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'REFUND_FAILED', 'EXPIRED', 'CANCELLED', 'AMOUNT_MISMATCH');

-- CreateEnum
CREATE TYPE "OrderPaymentMethod" AS ENUM ('RAZORPAY', 'COD');

-- AlterEnum
ALTER TYPE "FlowNodeType" ADD VALUE 'PAYMENT';

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'REVIEW_REQUIRED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentAmount" DECIMAL(10,2),
ADD COLUMN     "paymentCurrency" TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN     "paymentLinkExpiresAt" TIMESTAMP(3),
ADD COLUMN     "paymentLinkUrl" TEXT,
ADD COLUMN     "paymentMethod" "OrderPaymentMethod",
ADD COLUMN     "paymentStatus" "OrderPaymentStatus" NOT NULL DEFAULT 'UNPAID',
ADD COLUMN     "razorpayOrderId" TEXT,
ADD COLUMN     "razorpayPaymentId" TEXT,
ADD COLUMN     "razorpayPaymentLinkId" TEXT,
ADD COLUMN     "refundId" TEXT,
ADD COLUMN     "refundedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "autoConfirmOnPayment" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "defaultCurrency" TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN     "enableCod" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "enableOnlinePayment" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentLinkExpiryMins" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "razorpayKeyId" TEXT,
ADD COLUMN     "razorpayKeySecret" TEXT,
ADD COLUMN     "razorpayWebhookSecret" TEXT;

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'RAZORPAY',
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebhookEvent_tenantId_processedAt_idx" ON "WebhookEvent"("tenantId", "processedAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_processedAt_idx" ON "WebhookEvent"("processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_eventId_key" ON "WebhookEvent"("provider", "eventId");

-- CreateIndex
CREATE INDEX "Order_razorpayPaymentLinkId_idx" ON "Order"("razorpayPaymentLinkId");

-- CreateIndex
CREATE INDEX "Order_razorpayPaymentId_idx" ON "Order"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");
