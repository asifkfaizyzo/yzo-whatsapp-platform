-- CreateEnum
CREATE TYPE "QuickReplyScope" AS ENUM ('GLOBAL', 'PERSONAL');

-- CreateEnum
CREATE TYPE "QuickReplyMediaType" AS ENUM ('IMAGE', 'DOCUMENT', 'VIDEO', 'AUDIO');

-- CreateTable
CREATE TABLE "QuickReply" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shortcut" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "scope" "QuickReplyScope" NOT NULL DEFAULT 'GLOBAL',
    "userId" TEXT,
    "createdByType" TEXT NOT NULL DEFAULT 'TENANT',
    "createdByName" TEXT,
    "mediaUrl" TEXT,
    "mediaName" TEXT,
    "mediaSize" INTEGER,
    "mediaMimeType" TEXT,
    "mediaType" "QuickReplyMediaType",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuickReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuickReply_tenantId_shortcut_idx" ON "QuickReply"("tenantId", "shortcut");

-- CreateIndex
CREATE INDEX "QuickReply_tenantId_category_idx" ON "QuickReply"("tenantId", "category");

-- CreateIndex
CREATE INDEX "QuickReply_tenantId_scope_isActive_idx" ON "QuickReply"("tenantId", "scope", "isActive");

-- CreateIndex
CREATE INDEX "QuickReply_userId_idx" ON "QuickReply"("userId");

-- AddForeignKey
ALTER TABLE "QuickReply" ADD CONSTRAINT "QuickReply_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickReply" ADD CONSTRAINT "QuickReply_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create partial unique indexes
CREATE UNIQUE INDEX "QuickReply_tenant_shortcut_global_unique" 
  ON "QuickReply" ("tenantId", "shortcut") 
  WHERE "scope" = 'GLOBAL';

CREATE UNIQUE INDEX "QuickReply_tenant_shortcut_personal_unique" 
  ON "QuickReply" ("tenantId", "shortcut", "userId") 
  WHERE "scope" = 'PERSONAL';
