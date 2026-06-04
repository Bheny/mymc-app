-- DropForeignKey
ALTER TABLE "members" DROP CONSTRAINT "members_cell_id_fkey";

-- DropForeignKey
ALTER TABLE "members" DROP CONSTRAINT "members_shepherd_id_fkey";

-- AlterTable
ALTER TABLE "members" ADD COLUMN     "buscentre_id" TEXT,
ADD COLUMN     "mc_id" TEXT,
ALTER COLUMN "shepherd_id" DROP NOT NULL,
ALTER COLUMN "cell_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_shepherd_id_fkey" FOREIGN KEY ("shepherd_id") REFERENCES "shepherds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_cell_id_fkey" FOREIGN KEY ("cell_id") REFERENCES "cells"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_buscentre_id_fkey" FOREIGN KEY ("buscentre_id") REFERENCES "buscentres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_mc_id_fkey" FOREIGN KEY ("mc_id") REFERENCES "mega_churches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
