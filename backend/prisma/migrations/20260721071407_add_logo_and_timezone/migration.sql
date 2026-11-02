-- backend/prisma/migrations/20260721071407_add_logo_and_timezone/migration.sql (do not remove this comment)
-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "logo" TEXT,
ADD COLUMN     "timezone" TEXT DEFAULT 'Asia/Kolkata';
