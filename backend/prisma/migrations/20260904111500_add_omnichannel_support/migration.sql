-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('WHATSAPP', 'MESSENGER', 'INSTAGRAM');

-- AlterTable Tenant: Add Facebook & Instagram credentials
ALTER TABLE "Tenant" ADD COLUMN "facebookPageId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "facebookPageName" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "facebookPageAccessToken" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "instagramAccountId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "instagramUsername" TEXT;

-- AlterTable Contact: Add multi-channel identity & make phone nullable
ALTER TABLE "Contact" ADD COLUMN "channel" "ChannelType" NOT NULL DEFAULT 'WHATSAPP';
ALTER TABLE "Contact" ADD COLUMN "channelId" TEXT;
ALTER TABLE "Contact" ADD COLUMN "username" TEXT;
ALTER TABLE "Contact" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "Contact" ALTER COLUMN "phone" DROP NOT NULL;

-- Backfill existing WhatsApp contacts before applying unique constraint
UPDATE "Contact" SET "channelId" = "phone", "channel" = 'WHATSAPP' WHERE "channelId" IS NULL AND "phone" IS NOT NULL;

-- CreateIndex on Contact
CREATE UNIQUE INDEX "Contact_tenantId_channel_channelId_key" ON "Contact"("tenantId", "channel", "channelId");
CREATE INDEX "Contact_tenantId_channel_idx" ON "Contact"("tenantId", "channel");

-- AlterTable Conversation: Add channel tracking
ALTER TABLE "Conversation" ADD COLUMN "channel" "ChannelType" NOT NULL DEFAULT 'WHATSAPP';

-- CreateIndex on Conversation
CREATE INDEX "Conversation_tenantId_channel_idx" ON "Conversation"("tenantId", "channel");
