-- backend/prisma/migrations/20261012104257_add_broadcast_woo_segments/migration.sql (do not remove this comment)
-- AlterEnum
ALTER TYPE "BroadcastTarget" ADD VALUE 'WOO_SEGMENT';

-- AlterTable
ALTER TABLE "Broadcast" ADD COLUMN     "segmentInactiveDays" INTEGER,
ADD COLUMN     "segmentIncludeAllWoo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "segmentMinOrders" INTEGER,
ADD COLUMN     "segmentMinSpend" DOUBLE PRECISION;
