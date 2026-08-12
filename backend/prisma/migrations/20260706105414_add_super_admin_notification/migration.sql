-- CreateTable
CREATE TABLE "SuperAdminNotification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuperAdminNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SuperAdminNotification_isRead_idx" ON "SuperAdminNotification"("isRead");

-- CreateIndex
CREATE INDEX "SuperAdminNotification_createdAt_idx" ON "SuperAdminNotification"("createdAt");
