-- backend/prisma/migrations/20260730114340_add_bulk_reassign_audit_enums/migration.sql (do not remove this comment)
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'BULK_REASSIGN';
ALTER TYPE "AuditAction" ADD VALUE 'CONVERSATION_ASSIGNED';

-- AlterEnum
ALTER TYPE "AuditModule" ADD VALUE 'CONVERSATIONS';
