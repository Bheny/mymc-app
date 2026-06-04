-- CreateTable
CREATE TABLE "souls" (
    "id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT,
    "location" TEXT,
    "date" DATE NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "cell_id" TEXT NOT NULL,
    "recorded_by_id" TEXT NOT NULL,

    CONSTRAINT "souls_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "souls" ADD CONSTRAINT "souls_cell_id_fkey" FOREIGN KEY ("cell_id") REFERENCES "cells"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "souls" ADD CONSTRAINT "souls_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
