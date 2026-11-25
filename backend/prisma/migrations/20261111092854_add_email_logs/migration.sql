-- CreateEnum
CREATE TYPE "EmailCategory" AS ENUM ('AUTH', 'BILLING', 'NOTIFICATION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SENT', 'FAILED');

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "to" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "category" "EmailCategory" NOT NULL,
    "status" "EmailStatus" NOT NULL,
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_logs_tenantId_createdAt_idx" ON "email_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "email_logs_status_idx" ON "email_logs"("status");

-- CreateIndex
CREATE INDEX "email_logs_category_idx" ON "email_logs"("category");

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
