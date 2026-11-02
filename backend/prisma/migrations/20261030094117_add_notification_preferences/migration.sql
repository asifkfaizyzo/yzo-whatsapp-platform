-- backend/prisma/migrations/20261030094117_add_notification_preferences/migration.sql (do not remove this comment)
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notificationPreferences" JSONB;
