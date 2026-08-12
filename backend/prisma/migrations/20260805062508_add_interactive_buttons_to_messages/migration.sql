-- AlterEnum
ALTER TYPE "MessageType" ADD VALUE 'INTERACTIVE_BUTTONS';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "buttons" JSONB;
