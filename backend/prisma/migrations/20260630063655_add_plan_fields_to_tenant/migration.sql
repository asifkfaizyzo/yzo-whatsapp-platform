-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "billingType" TEXT DEFAULT 'monthly',
ADD COLUMN     "planActivatedAt" TIMESTAMP(3),
ADD COLUMN     "planStatus" TEXT DEFAULT 'inactive';
