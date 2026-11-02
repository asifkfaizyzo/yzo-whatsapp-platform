-- backend/prisma/migrations/20260708090152_add_tenant_business_details/migration.sql (do not remove this comment)
-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "companySize" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "websiteUrl" TEXT;
