-- AlterEnum
ALTER TYPE "SubscriptionStatus" ADD VALUE 'payment_failed';

-- DropIndex
DROP INDEX "Payment_razorpayOrderId_key";

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "offlineReference" TEXT,
ALTER COLUMN "currency" SET DEFAULT 'INR';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "offlineReference" TEXT,
ADD COLUMN     "paymentType" TEXT NOT NULL DEFAULT 'ONLINE',
ALTER COLUMN "razorpayOrderId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SubscriptionPlan" ADD COLUMN     "hasTrial" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "razorpayAnnualPlanId" TEXT,
ADD COLUMN     "razorpayMonthlyPlanId" TEXT,
ADD COLUMN     "trialDays" INTEGER DEFAULT 14;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "autopayEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autopayMethod" TEXT,
ADD COLUMN     "hasUsedTrial" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "razorpayCustomerId" TEXT,
ADD COLUMN     "razorpaySubscriptionId" TEXT,
ADD COLUMN     "trialExtendedByAdmin" TEXT,
ADD COLUMN     "trialExtendedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trialPlanId" TEXT;

-- AlterTable
ALTER TABLE "platform_settings" ADD COLUMN     "defaultTrialDays" INTEGER NOT NULL DEFAULT 14;

-- CreateIndex
CREATE INDEX "Payment_offlineReference_idx" ON "Payment"("offlineReference");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_razorpaySubscriptionId_key" ON "Tenant"("razorpaySubscriptionId");
