-- AlterTable
ALTER TABLE "first_timers" ADD COLUMN     "contact_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "first_timers_contact_id_key" ON "first_timers"("contact_id");

-- AddForeignKey
ALTER TABLE "first_timers" ADD CONSTRAINT "first_timers_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

