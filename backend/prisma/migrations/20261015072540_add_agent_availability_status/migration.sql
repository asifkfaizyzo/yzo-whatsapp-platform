-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('AVAILABLE', 'AWAY', 'OFFLINE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "availabilityStatus" "AvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE';
