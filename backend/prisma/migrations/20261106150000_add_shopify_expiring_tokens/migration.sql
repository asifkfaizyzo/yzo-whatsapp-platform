-- Store Shopify expiring offline access-token credentials.
ALTER TABLE "shopify_connections"
ADD COLUMN "accessTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN "refreshToken" TEXT,
ADD COLUMN "refreshTokenExpiresAt" TIMESTAMP(3);
