-- CreateTable
CREATE TABLE "shopify_connections" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "webhookSecret" TEXT,
    "connectedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopify_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "woocommerce_connections" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "storeUrl" TEXT NOT NULL,
    "consumerKey" TEXT NOT NULL,
    "consumerSecret" TEXT NOT NULL,
    "webhookSecret" TEXT,
    "connectedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "woocommerce_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shopify_connections_tenantId_key" ON "shopify_connections"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "woocommerce_connections_tenantId_key" ON "woocommerce_connections"("tenantId");

-- AddForeignKey
ALTER TABLE "shopify_connections" ADD CONSTRAINT "shopify_connections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "woocommerce_connections" ADD CONSTRAINT "woocommerce_connections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
