-- CreateTable
CREATE TABLE "sheet_fields" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL DEFAULT 'text',
    "fieldCategory" TEXT NOT NULL DEFAULT 'custom',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "columnOrder" INTEGER NOT NULL,
    "options" JSONB,
    "defaultValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sheet_fields_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sheet_fields_tenantId_idx" ON "sheet_fields"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "sheet_fields_tenantId_fieldKey_key" ON "sheet_fields"("tenantId", "fieldKey");

-- AddForeignKey
ALTER TABLE "sheet_fields" ADD CONSTRAINT "sheet_fields_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
