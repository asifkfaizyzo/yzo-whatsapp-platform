-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FlowNodeType" ADD VALUE 'SHOPIFY_ORDER_LOOKUP';
ALTER TYPE "FlowNodeType" ADD VALUE 'FAQ_LOOKUP';

-- CreateTable
CREATE TABLE "bot_faqs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "keywords" TEXT[],
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_faqs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bot_faqs_tenantId_isActive_idx" ON "bot_faqs"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "bot_faqs_tenantId_category_idx" ON "bot_faqs"("tenantId", "category");

-- AddForeignKey
ALTER TABLE "bot_faqs" ADD CONSTRAINT "bot_faqs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
