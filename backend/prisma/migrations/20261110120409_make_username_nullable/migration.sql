-- AlterTable
ALTER TABLE "tenants" ALTER COLUMN "username" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "username" DROP NOT NULL;
