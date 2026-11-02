-- backend/prisma/migrations/20261006123000_add_woocommerce_tracking_url_templates/migration.sql (do not remove this comment)
ALTER TABLE "woocommerce_connections"
ADD COLUMN "trackingUrlTemplates" JSONB NOT NULL DEFAULT '{}';
