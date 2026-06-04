/*
  Warnings:

  - You are about to drop the column `mcName` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "mcName",
ADD COLUMN     "megaCentreId" TEXT;

-- CreateTable
CREATE TABLE "MegaCentre" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assignedPastorId" TEXT,

    CONSTRAINT "MegaCentre_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MegaCentre" ADD CONSTRAINT "MegaCentre_assignedPastorId_fkey" FOREIGN KEY ("assignedPastorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_megaCentreId_fkey" FOREIGN KEY ("megaCentreId") REFERENCES "MegaCentre"("id") ON DELETE SET NULL ON UPDATE CASCADE;
