-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "whatsappAccessToken" TEXT,
ADD COLUMN     "whatsappPhoneId" TEXT,
ADD COLUMN     "whatsappVerifyToken" TEXT DEFAULT 'yzo_default_verification_token',
ADD COLUMN     "whatsappWabaId" TEXT;
