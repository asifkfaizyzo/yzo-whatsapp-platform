CREATE TYPE "SenderType_new" AS ENUM ('SUPER_ADMIN', 'TENANT', 'USER', 'CONTACT', 'SYSTEM');
ALTER TABLE "Message" ALTER COLUMN "senderType" TYPE "SenderType_new" USING ("senderType"::text::"SenderType_new");
ALTER TYPE "SenderType" RENAME TO "SenderType_old";
ALTER TYPE "SenderType_new" RENAME TO "SenderType";
DROP TYPE "public"."SenderType_old";