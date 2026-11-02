-- backend/prisma/migrations/20260810091423_add_location_to_messages/migration.sql (do not remove this comment)
-- AlterEnum
ALTER TYPE "MessageType" ADD VALUE 'LOCATION';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "locAddress" TEXT,
ADD COLUMN     "locLatitude" DOUBLE PRECISION,
ADD COLUMN     "locLongitude" DOUBLE PRECISION,
ADD COLUMN     "locName" TEXT;
