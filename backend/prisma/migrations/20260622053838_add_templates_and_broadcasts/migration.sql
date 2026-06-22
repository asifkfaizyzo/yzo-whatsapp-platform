-- CreateEnum
CREATE TYPE "TemplateCategory" AS ENUM ('UTILITY', 'MARKETING', 'AUTHENTICATION');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED', 'DELETED');

-- CreateEnum
CREATE TYPE "BroadcastTarget" AS ENUM ('ALL', 'TAGS');

-- CreateEnum
CREATE TYPE "BroadcastStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PROCESSING', 'PAUSED', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "metaTemplateId" TEXT,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en_US',
    "category" "TemplateCategory" NOT NULL,
    "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "components" JSONB NOT NULL,
    "headerParams" INTEGER NOT NULL DEFAULT 0,
    "bodyParams" INTEGER NOT NULL DEFAULT 0,
    "rejectedReason" TEXT,
    "qualityScore" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Broadcast" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "targetType" "BroadcastTarget" NOT NULL,
    "defaultParams" JSONB,
    "status" "BroadcastStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "read" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "batchSize" INTEGER NOT NULL DEFAULT 50,
    "batchDelayMs" INTEGER NOT NULL DEFAULT 1000,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BroadcastTag" (
    "broadcastId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "BroadcastTag_pkey" PRIMARY KEY ("broadcastId","tagId")
);

-- CreateTable
CREATE TABLE "BroadcastRecipient" (
    "id" TEXT NOT NULL,
    "broadcastId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "params" JSONB,
    "wamid" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BroadcastRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Template_metaTemplateId_key" ON "Template"("metaTemplateId");

-- CreateIndex
CREATE INDEX "Template_status_idx" ON "Template"("status");

-- CreateIndex
CREATE INDEX "Template_category_idx" ON "Template"("category");

-- CreateIndex
CREATE INDEX "Template_tenantId_idx" ON "Template"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Template_name_language_tenantId_key" ON "Template"("name", "language", "tenantId");

-- CreateIndex
CREATE INDEX "Broadcast_status_idx" ON "Broadcast"("status");

-- CreateIndex
CREATE INDEX "Broadcast_scheduledAt_idx" ON "Broadcast"("scheduledAt");

-- CreateIndex
CREATE INDEX "Broadcast_createdById_idx" ON "Broadcast"("createdById");

-- CreateIndex
CREATE INDEX "Broadcast_tenantId_idx" ON "Broadcast"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "BroadcastRecipient_wamid_key" ON "BroadcastRecipient"("wamid");

-- CreateIndex
CREATE INDEX "BroadcastRecipient_broadcastId_status_idx" ON "BroadcastRecipient"("broadcastId", "status");

-- CreateIndex
CREATE INDEX "BroadcastRecipient_wamid_idx" ON "BroadcastRecipient"("wamid");

-- CreateIndex
CREATE INDEX "BroadcastRecipient_status_idx" ON "BroadcastRecipient"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BroadcastRecipient_broadcastId_contactId_key" ON "BroadcastRecipient"("broadcastId", "contactId");

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastTag" ADD CONSTRAINT "BroadcastTag_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "Broadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastTag" ADD CONSTRAINT "BroadcastTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastRecipient" ADD CONSTRAINT "BroadcastRecipient_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "Broadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastRecipient" ADD CONSTRAINT "BroadcastRecipient_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
