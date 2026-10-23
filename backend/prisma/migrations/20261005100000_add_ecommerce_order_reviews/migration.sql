ALTER TABLE "ecommerce_orders"
ADD COLUMN "reviewRequestedAt" TIMESTAMP(3),
ADD COLUMN "reviewRating" INTEGER,
ADD COLUMN "reviewReceivedAt" TIMESTAMP(3),
ADD CONSTRAINT "ecommerce_orders_reviewRating_check"
CHECK ("reviewRating" IS NULL OR "reviewRating" BETWEEN 1 AND 5);