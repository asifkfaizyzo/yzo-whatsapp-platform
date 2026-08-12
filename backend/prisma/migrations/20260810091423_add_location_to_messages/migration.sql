-- AlterEnum
ALTER TYPE "MessageType" ADD VALUE 'LOCATION';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "locAddress" TEXT,
ADD COLUMN     "locLatitude" DOUBLE PRECISION,
ADD COLUMN     "locLongitude" DOUBLE PRECISION,
ADD COLUMN     "locName" TEXT;
