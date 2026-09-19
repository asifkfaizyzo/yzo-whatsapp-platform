-- CreateEnum
CREATE TYPE "RazorpayAuthType" AS ENUM ('DIRECT_KEYS', 'OAUTH');

-- CreateEnum
CREATE TYPE "RazorpayAccountStatus" AS ENUM ('CONNECTED', 'KYC_PENDING', 'VERIFIED', 'SUSPENDED', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "RazorpayKycStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'NOT_APPLICABLE');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "razorpayAccessToken" TEXT,
ADD COLUMN     "razorpayAccountId" TEXT,
ADD COLUMN     "razorpayAccountStatus" "RazorpayAccountStatus" NOT NULL DEFAULT 'DISCONNECTED',
ADD COLUMN     "razorpayAuthType" "RazorpayAuthType" NOT NULL DEFAULT 'DIRECT_KEYS',
ADD COLUMN     "razorpayKycStatus" "RazorpayKycStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "razorpayRefreshToken" TEXT,
ADD COLUMN     "razorpayTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "razorpayWebhookId" TEXT;

-- AlterTable
ALTER TABLE "WebhookEvent" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "payload" JSONB,
ADD COLUMN     "processed" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "tenantId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Tenant_razorpayAccountId_idx" ON "Tenant"("razorpayAccountId");

-- CreateIndex
CREATE INDEX "WebhookEvent_createdAt_idx" ON "WebhookEvent"("createdAt");
