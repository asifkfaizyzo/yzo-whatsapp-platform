-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'GST_SETTINGS_UPDATED';

-- AlterEnum
ALTER TYPE "AuditModule" ADD VALUE 'SETTINGS';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "baseAmount" DECIMAL(10,2),
ADD COLUMN     "gstAmount" DECIMAL(10,2),
ADD COLUMN     "gstEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "gstPercent" DOUBLE PRECISION DEFAULT 18,
ADD COLUMN     "gstType" TEXT DEFAULT 'CGST_SGST';

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL,
    "gstEnabled" BOOLEAN NOT NULL DEFAULT true,
    "gstPercent" DOUBLE PRECISION NOT NULL DEFAULT 18.0,
    "gstType" TEXT NOT NULL DEFAULT 'CGST_SGST',
    "companyGstNumber" TEXT NOT NULL DEFAULT '27AABCU9603R1ZM',
    "pricingType" TEXT NOT NULL DEFAULT 'EXCLUSIVE',
    "companyName" TEXT NOT NULL DEFAULT 'SudoReply Technologies Pvt Ltd',
    "companyEmail" TEXT NOT NULL DEFAULT 'support@sudoreply.com',
    "companyAddress" TEXT NOT NULL DEFAULT 'Mumbai, Maharashtra, India',
    "sacCode" TEXT NOT NULL DEFAULT '998314',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);
