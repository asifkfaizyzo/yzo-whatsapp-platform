-- backend/prisma/migrations/20260727060626_add_password_changed_audit_action/migration.sql (do not remove this comment)
-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'PASSWORD_CHANGED';
