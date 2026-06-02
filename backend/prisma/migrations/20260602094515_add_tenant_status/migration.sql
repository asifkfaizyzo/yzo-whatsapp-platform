-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('PENDING', 'APPROVED', 'BLOCKED');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "status" "TenantStatus" NOT NULL DEFAULT 'PENDING';
