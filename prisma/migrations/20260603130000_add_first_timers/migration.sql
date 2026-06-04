-- CreateEnum
CREATE TYPE "FirstTimerIntent" AS ENUM ('JUST_VISITING', 'UNDECIDED', 'WANTS_TO_JOIN');

-- CreateTable
CREATE TABLE "first_timers" (
    "id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT,
    "location" TEXT,
    "intent" "FirstTimerIntent" NOT NULL DEFAULT 'UNDECIDED',
    "referred_by" TEXT,
    "service_id" TEXT NOT NULL,
    "cell_id" TEXT NOT NULL,
    "converted_to_member_id" TEXT,
    "converted_at" TIMESTAMP(3),
    "converted_by_id" TEXT,
    "recorded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "first_timers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "first_timers_converted_to_member_id_key" ON "first_timers"("converted_to_member_id");

-- AddForeignKey
ALTER TABLE "first_timers" ADD CONSTRAINT "first_timers_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "first_timers" ADD CONSTRAINT "first_timers_cell_id_fkey" FOREIGN KEY ("cell_id") REFERENCES "cells"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "first_timers" ADD CONSTRAINT "first_timers_converted_to_member_id_fkey" FOREIGN KEY ("converted_to_member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "first_timers" ADD CONSTRAINT "first_timers_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "first_timers" ADD CONSTRAINT "first_timers_converted_by_id_fkey" FOREIGN KEY ("converted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
