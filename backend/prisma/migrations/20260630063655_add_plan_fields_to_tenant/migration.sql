-- backend/prisma/migrations/20260630063655_add_plan_fields_to_tenant/migration.sql (do not remove this comment)
-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "billingType" TEXT DEFAULT 'monthly',
ADD COLUMN     "planActivatedAt" TIMESTAMP(3),
ADD COLUMN     "planStatus" TEXT DEFAULT 'inactive';
