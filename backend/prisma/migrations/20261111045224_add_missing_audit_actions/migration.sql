-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'SIGNUP';
ALTER TYPE "AuditAction" ADD VALUE 'LOGIN_SUCCESS';
ALTER TYPE "AuditAction" ADD VALUE 'PROFILE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'EMAIL_VERIFIED';
ALTER TYPE "AuditAction" ADD VALUE 'ONBOARDING_STEP_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'PASSWORD_SET';
ALTER TYPE "AuditAction" ADD VALUE 'USERNAME_SET';
