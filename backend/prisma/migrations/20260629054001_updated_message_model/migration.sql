-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'FILE', 'VIDEO', 'AUDIO');

-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('SUPER_ADMIN', 'TENANT', 'AGENT', 'CONTACT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- Step 1: Add new columns
ALTER TABLE "Message" 
  ADD COLUMN IF NOT EXISTS "caption"       TEXT,
  ADD COLUMN IF NOT EXISTS "direction"     "MessageDirection" NOT NULL DEFAULT 'OUTBOUND',
  ADD COLUMN IF NOT EXISTS "mediaMimeType" TEXT,
  ADD COLUMN IF NOT EXISTS "mediaName"     TEXT,
  ADD COLUMN IF NOT EXISTS "mediaSize"     INTEGER,
  ADD COLUMN IF NOT EXISTS "mediaUrl"      TEXT;

-- Step 2: Make text optional
ALTER TABLE "Message"
  ALTER COLUMN "text" DROP NOT NULL;

-- Step 3: Drop old default on type column first
ALTER TABLE "Message"
  ALTER COLUMN "type" DROP DEFAULT;

-- Step 4: Convert type column String → Enum
ALTER TABLE "Message"
  ALTER COLUMN "type" TYPE "MessageType"
  USING "type"::"MessageType";

-- Step 5: Set new default for type
ALTER TABLE "Message"
  ALTER COLUMN "type" SET DEFAULT 'TEXT'::"MessageType";

-- Step 6: Convert senderType column String → Enum
ALTER TABLE "Message"
  ALTER COLUMN "senderType" TYPE "SenderType"
  USING "senderType"::"SenderType";

-- Step 7: Create indexes
CREATE INDEX IF NOT EXISTS "Message_senderType_idx" ON "Message"("senderType");
CREATE INDEX IF NOT EXISTS "Message_direction_idx" ON "Message"("direction");