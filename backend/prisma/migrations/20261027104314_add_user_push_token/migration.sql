-- backend/prisma/migrations/20261027104314_add_user_push_token/migration.sql (do not remove this comment)
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pushToken" TEXT,
ADD COLUMN     "pushTokenUpdatedAt" TIMESTAMP(3);
