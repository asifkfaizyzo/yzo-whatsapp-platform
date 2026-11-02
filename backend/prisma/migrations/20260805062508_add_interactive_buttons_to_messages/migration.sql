-- backend/prisma/migrations/20260805062508_add_interactive_buttons_to_messages/migration.sql (do not remove this comment)
-- AlterEnum
ALTER TYPE "MessageType" ADD VALUE 'INTERACTIVE_BUTTONS';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "buttons" JSONB;
