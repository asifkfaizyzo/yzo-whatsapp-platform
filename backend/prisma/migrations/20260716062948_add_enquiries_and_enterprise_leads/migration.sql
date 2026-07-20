-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('new', 'read', 'replied', 'closed');

-- CreateEnum
CREATE TYPE "EnterpriseCompanySize" AS ENUM ('1-10', '11-50', '51-200', '200+');

-- CreateEnum
CREATE TYPE "EnterpriseTimeline" AS ENUM ('urgent', '1-3months', 'exploring');

-- CreateEnum
CREATE TYPE "EnterprisePreferredContact" AS ENUM ('email', 'phone', 'video_call');

-- CreateEnum
CREATE TYPE "EnterpriseLeadStatus" AS ENUM ('pending', 'contacted', 'negotiating', 'converted', 'rejected');

-- CreateTable
CREATE TABLE "enquiries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "status" "EnquiryStatus" NOT NULL DEFAULT 'new',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enterprise_leads" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT,
    "company_size" "EnterpriseCompanySize" NOT NULL,
    "estimated_users" INTEGER,
    "requirements" TEXT,
    "timeline" "EnterpriseTimeline" NOT NULL,
    "preferred_contact" "EnterprisePreferredContact" NOT NULL,
    "status" "EnterpriseLeadStatus" NOT NULL DEFAULT 'pending',
    "internal_notes" TEXT,
    "activated_at" TIMESTAMP(3),
    "activated_by_admin_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enterprise_leads_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "enterprise_leads" ADD CONSTRAINT "enterprise_leads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enterprise_leads" ADD CONSTRAINT "enterprise_leads_activated_by_admin_id_fkey" FOREIGN KEY ("activated_by_admin_id") REFERENCES "SuperAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
