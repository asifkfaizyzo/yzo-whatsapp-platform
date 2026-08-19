-- CreateEnum
CREATE TYPE "TemplateHeaderType" AS ENUM ('NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION');

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "buttons" JSONB,
ADD COLUMN     "footerText" TEXT,
ADD COLUMN     "headerLocationAddress" TEXT,
ADD COLUMN     "headerLocationLat" DOUBLE PRECISION,
ADD COLUMN     "headerLocationLng" DOUBLE PRECISION,
ADD COLUMN     "headerLocationName" TEXT,
ADD COLUMN     "headerMediaHandle" TEXT,
ADD COLUMN     "headerMediaUrl" TEXT,
ADD COLUMN     "headerText" TEXT,
ADD COLUMN     "headerType" "TemplateHeaderType" NOT NULL DEFAULT 'NONE';
