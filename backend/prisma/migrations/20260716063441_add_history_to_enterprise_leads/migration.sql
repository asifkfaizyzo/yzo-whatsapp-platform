-- backend/prisma/migrations/20260716063441_add_history_to_enterprise_leads/migration.sql (do not remove this comment)
-- AlterTable
ALTER TABLE "enterprise_leads" ADD COLUMN     "history" JSONB DEFAULT '[]';
