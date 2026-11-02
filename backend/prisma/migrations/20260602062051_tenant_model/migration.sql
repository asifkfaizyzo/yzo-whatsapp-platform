-- backend/prisma/migrations/20260602062051_tenant_model/migration.sql (do not remove this comment)
-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
