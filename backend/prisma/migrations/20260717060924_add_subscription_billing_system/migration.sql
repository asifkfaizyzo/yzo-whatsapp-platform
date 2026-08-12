-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'cancel_at_period_end', 'expired', 'paused');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('paid', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "CancellationReason" AS ENUM ('too_expensive', 'missing_features', 'switching_tool', 'not_using_enough', 'other');

-- CreateEnum
CREATE TYPE "CompanySize" AS ENUM ('size_1_10', 'size_11_50', 'size_51_200', 'size_200_plus');

-- CreateEnum
CREATE TYPE "ContactTimeline" AS ENUM ('urgent', 'one_to_3_months', 'exploring');

-- CreateEnum
CREATE TYPE "PreferredContact" AS ENUM ('email', 'phone', 'video_call');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "cancelRequestedAt" TIMESTAMP(3),
ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "currentPlan" TEXT,
ADD COLUMN     "dataDeletionDate" TIMESTAMP(3),
ADD COLUMN     "planPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "planPeriodStart" TIMESTAMP(3),
ADD COLUMN     "reactivatedAt" TIMESTAMP(3),
ADD COLUMN     "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'active';

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'paid',
    "billingPeriodStart" TIMESTAMP(3) NOT NULL,
    "billingPeriodEnd" TIMESTAMP(3) NOT NULL,
    "paymentMethodLast4" TEXT,
    "paymentMethodBrand" TEXT,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancellationSurvey" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reason" "CancellationReason" NOT NULL,
    "additionalComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CancellationSurvey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantDataDeletion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedBy" TEXT NOT NULL DEFAULT 'system',
    "note" TEXT,

    CONSTRAINT "TenantDataDeletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CancellationSurvey_tenantId_key" ON "CancellationSurvey"("tenantId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationSurvey" ADD CONSTRAINT "CancellationSurvey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantDataDeletion" ADD CONSTRAINT "TenantDataDeletion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
