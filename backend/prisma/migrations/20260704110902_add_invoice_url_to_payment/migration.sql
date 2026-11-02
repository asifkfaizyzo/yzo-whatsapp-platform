-- backend/prisma/migrations/20260704110902_add_invoice_url_to_payment/migration.sql (do not remove this comment)
-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "invoiceUrl" TEXT;
