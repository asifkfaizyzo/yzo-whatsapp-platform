/*
  Warnings:

  - A unique constraint covering the columns `[wamid]` on the table `Message` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "firstResponseAt" TIMESTAMP(3),
ADD COLUMN     "incomingAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "failedAt" TIMESTAMP(3),
ADD COLUMN     "failureCode" INTEGER,
ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "readAt" TIMESTAMP(3),
ADD COLUMN     "wamid" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Message_wamid_key" ON "Message"("wamid");
