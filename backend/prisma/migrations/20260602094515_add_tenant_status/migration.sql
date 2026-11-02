-- backend/prisma/migrations/20260602094515_add_tenant_status/migration.sql (do not remove this comment)
-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('PENDING', 'APPROVED', 'BLOCKED');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "status" "TenantStatus" NOT NULL DEFAULT 'PENDING';
