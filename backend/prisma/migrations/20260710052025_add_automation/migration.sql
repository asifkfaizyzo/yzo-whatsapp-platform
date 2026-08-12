-- CreateEnum
CREATE TYPE "FlowNodeType" AS ENUM ('SEND_MESSAGE', 'ASK_QUESTION', 'CONDITION', 'ASSIGN_AGENT', 'END_FLOW');

-- CreateEnum
CREATE TYPE "ConversationMode" AS ENUM ('BOT', 'AGENT', 'QUEUED');

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "botPaused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "currentFlowId" TEXT,
ADD COLUMN     "currentNodeId" TEXT,
ADD COLUMN     "flowData" JSONB DEFAULT '{}',
ADD COLUMN     "mode" "ConversationMode" NOT NULL DEFAULT 'BOT';

-- CreateTable
CREATE TABLE "Flow" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerKeyword" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Flow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlowNode" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "type" "FlowNodeType" NOT NULL,
    "content" TEXT,
    "options" JSONB,
    "nextNodeId" TEXT,
    "position" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlowNode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Flow_tenantId_idx" ON "Flow"("tenantId");

-- CreateIndex
CREATE INDEX "Flow_tenantId_isActive_idx" ON "Flow"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "Flow_tenantId_triggerKeyword_idx" ON "Flow"("tenantId", "triggerKeyword");

-- CreateIndex
CREATE INDEX "FlowNode_flowId_idx" ON "FlowNode"("flowId");

-- CreateIndex
CREATE INDEX "FlowNode_flowId_order_idx" ON "FlowNode"("flowId", "order");

-- CreateIndex
CREATE INDEX "Conversation_tenantId_mode_idx" ON "Conversation"("tenantId", "mode");

-- CreateIndex
CREATE INDEX "Conversation_currentFlowId_idx" ON "Conversation"("currentFlowId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_currentFlowId_fkey" FOREIGN KEY ("currentFlowId") REFERENCES "Flow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flow" ADD CONSTRAINT "Flow_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowNode" ADD CONSTRAINT "FlowNode_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
