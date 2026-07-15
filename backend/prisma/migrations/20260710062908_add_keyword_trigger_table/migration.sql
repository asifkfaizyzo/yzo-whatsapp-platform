/*
  Warnings:

  - You are about to drop the column `triggerKeyword` on the `Flow` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Flow_tenantId_triggerKeyword_idx";

-- AlterTable
ALTER TABLE "Flow" DROP COLUMN "triggerKeyword";

-- CreateTable
CREATE TABLE "KeywordTrigger" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeywordTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KeywordTrigger_tenantId_idx" ON "KeywordTrigger"("tenantId");

-- CreateIndex
CREATE INDEX "KeywordTrigger_flowId_idx" ON "KeywordTrigger"("flowId");

-- CreateIndex
CREATE INDEX "KeywordTrigger_tenantId_keyword_idx" ON "KeywordTrigger"("tenantId", "keyword");

-- CreateIndex
CREATE UNIQUE INDEX "KeywordTrigger_tenantId_keyword_key" ON "KeywordTrigger"("tenantId", "keyword");

-- AddForeignKey
ALTER TABLE "KeywordTrigger" ADD CONSTRAINT "KeywordTrigger_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordTrigger" ADD CONSTRAINT "KeywordTrigger_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
