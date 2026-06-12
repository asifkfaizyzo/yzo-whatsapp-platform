-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "assignedTo" TEXT,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "lastMessageAt" TIMESTAMP(3),
ADD COLUMN     "reopenCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reopenedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ConversationActivity" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performedBy" TEXT,
    "performedByType" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoReopenConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "reopenWindowHours" INTEGER NOT NULL DEFAULT 72,
    "maxReopenCount" INTEGER NOT NULL DEFAULT 5,
    "smartFilterEnabled" BOOLEAN NOT NULL DEFAULT true,
    "assignmentStrategy" TEXT NOT NULL DEFAULT 'original_agent',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoReopenConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConversationActivity_conversationId_idx" ON "ConversationActivity"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "AutoReopenConfig_tenantId_key" ON "AutoReopenConfig"("tenantId");

-- CreateIndex
CREATE INDEX "Conversation_tenantId_status_idx" ON "Conversation"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "ConversationActivity" ADD CONSTRAINT "ConversationActivity_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
