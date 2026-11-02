-- backend/prisma/migrations/20260611020204_update_user_contact_model/migration.sql (do not remove this comment)
-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
