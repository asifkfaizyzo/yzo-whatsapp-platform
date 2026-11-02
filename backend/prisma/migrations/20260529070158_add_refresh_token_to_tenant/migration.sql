-- backend/prisma/migrations/20260529070158_add_refresh_token_to_tenant/migration.sql (do not remove this comment)
-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "refreshToken" TEXT;
