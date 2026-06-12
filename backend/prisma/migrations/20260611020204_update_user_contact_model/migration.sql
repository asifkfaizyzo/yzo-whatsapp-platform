-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
