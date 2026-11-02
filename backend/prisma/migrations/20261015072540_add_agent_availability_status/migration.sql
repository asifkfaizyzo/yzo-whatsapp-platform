-- backend/prisma/migrations/20261015072540_add_agent_availability_status/migration.sql (do not remove this comment)
-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('AVAILABLE', 'AWAY', 'OFFLINE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "availabilityStatus" "AvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE';
