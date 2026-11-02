-- backend/prisma/migrations/20260526111244_add_superadmin_refresh_token/migration.sql (do not remove this comment)
-- AlterTable
ALTER TABLE "SuperAdmin" ADD COLUMN     "refreshToken" TEXT;
