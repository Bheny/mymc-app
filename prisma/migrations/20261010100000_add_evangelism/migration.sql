-- CreateEnum
CREATE TYPE "OutreachLevel" AS ENUM ('CELL', 'BUSCENTRE', 'MC', 'BRANCH');

-- CreateEnum
CREATE TYPE "OutreachStatus" AS ENUM ('PLANNED', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OutreachType" AS ENUM ('STREET', 'DOOR_TO_DOOR', 'CAMPUS', 'MARKET', 'EVENT', 'ONLINE', 'OTHER');

-- CreateEnum
CREATE TYPE "ContactStage" AS ENUM ('NEW', 'CONTACTED', 'INVITED', 'ATTENDED', 'CONVERTED', 'NOT_INTERESTED', 'UNREACHABLE', 'OUT_OF_AREA', 'DO_NOT_CONTACT');

-- CreateEnum
CREATE TYPE "ContactSource" AS ENUM ('OUTREACH', 'PERSONAL_INVITE', 'WALK_IN', 'CELL_SOUL', 'LEGACY_IMPORT');

-- CreateEnum
CREATE TYPE "AgeRange" AS ENUM ('CHILD', 'TEEN', 'YOUTH', 'ADULT', 'ELDER');

-- CreateEnum
CREATE TYPE "EncounterResponse" AS ENUM ('RECEIVED_CHRIST', 'INTERESTED', 'NEUTRAL', 'DECLINED');

-- CreateEnum
CREATE TYPE "ContactActivityType" AS ENUM ('CALL', 'WHATSAPP', 'VISIT', 'INVITED', 'NOTE', 'REASSIGNED', 'STAGE_CHANGE');

-- CreateTable
CREATE TABLE "outreaches" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "OutreachType" NOT NULL DEFAULT 'STREET',
    "status" "OutreachStatus" NOT NULL DEFAULT 'PLANNED',
    "level" "OutreachLevel" NOT NULL,
    "branch_id" TEXT NOT NULL,
    "mc_id" TEXT,
    "buscentre_id" TEXT,
    "cell_id" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "location_name" TEXT NOT NULL,
    "area" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "notes" TEXT,
    "lead_member_id" TEXT,
    "target_count" INTEGER,
    "people_spoken_to" INTEGER,
    "decisions_for_christ" INTEGER,
    "summary" TEXT,
    "cancelled_reason" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outreaches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_team_members" (
    "id" TEXT NOT NULL,
    "outreach_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "is_lead" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outreach_team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT,
    "phone" TEXT,
    "phone_normalized" TEXT,
    "gender" "Gender",
    "age_range" "AgeRange",
    "home_area" TEXT,
    "notes" TEXT,
    "stage" "ContactStage" NOT NULL DEFAULT 'NEW',
    "source" "ContactSource" NOT NULL DEFAULT 'OUTREACH',
    "do_not_contact" BOOLEAN NOT NULL DEFAULT false,
    "branch_id" TEXT NOT NULL,
    "mc_id" TEXT,
    "buscentre_id" TEXT,
    "cell_id" TEXT,
    "follow_up_owner_id" TEXT,
    "first_met_at" TIMESTAMP(3) NOT NULL,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "converted_member_id" TEXT,
    "converted_at" TIMESTAMP(3),
    "merged_into_id" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounters" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "outreach_id" TEXT,
    "met_at" TIMESTAMP(3) NOT NULL,
    "met_location" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "response" "EncounterResponse" NOT NULL DEFAULT 'NEUTRAL',
    "prayed_with" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "met_by_member_id" TEXT,
    "recorded_by_id" TEXT NOT NULL,
    "client_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "encounters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_activities" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "type" "ContactActivityType" NOT NULL,
    "outcome" TEXT,
    "note" TEXT,
    "invited_service_date" DATE,
    "invited_service_type" "ServiceType",
    "by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outreaches_branch_id_starts_at_idx" ON "outreaches"("branch_id", "starts_at");

-- CreateIndex
CREATE INDEX "outreaches_mc_id_starts_at_idx" ON "outreaches"("mc_id", "starts_at");

-- CreateIndex
CREATE INDEX "outreaches_buscentre_id_starts_at_idx" ON "outreaches"("buscentre_id", "starts_at");

-- CreateIndex
CREATE INDEX "outreaches_cell_id_starts_at_idx" ON "outreaches"("cell_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "outreach_team_members_outreach_id_member_id_key" ON "outreach_team_members"("outreach_id", "member_id");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_converted_member_id_key" ON "contacts"("converted_member_id");

-- CreateIndex
CREATE INDEX "contacts_mc_id_stage_idx" ON "contacts"("mc_id", "stage");

-- CreateIndex
CREATE INDEX "contacts_buscentre_id_stage_idx" ON "contacts"("buscentre_id", "stage");

-- CreateIndex
CREATE INDEX "contacts_cell_id_stage_idx" ON "contacts"("cell_id", "stage");

-- CreateIndex
CREATE INDEX "contacts_follow_up_owner_id_idx" ON "contacts"("follow_up_owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_branch_id_phone_normalized_key" ON "contacts"("branch_id", "phone_normalized");

-- CreateIndex
CREATE UNIQUE INDEX "encounters_client_ref_key" ON "encounters"("client_ref");

-- CreateIndex
CREATE INDEX "encounters_contact_id_met_at_idx" ON "encounters"("contact_id", "met_at");

-- CreateIndex
CREATE UNIQUE INDEX "encounters_outreach_id_contact_id_key" ON "encounters"("outreach_id", "contact_id");

-- CreateIndex
CREATE INDEX "contact_activities_contact_id_created_at_idx" ON "contact_activities"("contact_id", "created_at");

-- AddForeignKey
ALTER TABLE "outreaches" ADD CONSTRAINT "outreaches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreaches" ADD CONSTRAINT "outreaches_mc_id_fkey" FOREIGN KEY ("mc_id") REFERENCES "mega_churches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreaches" ADD CONSTRAINT "outreaches_buscentre_id_fkey" FOREIGN KEY ("buscentre_id") REFERENCES "buscentres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreaches" ADD CONSTRAINT "outreaches_cell_id_fkey" FOREIGN KEY ("cell_id") REFERENCES "cells"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreaches" ADD CONSTRAINT "outreaches_lead_member_id_fkey" FOREIGN KEY ("lead_member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreaches" ADD CONSTRAINT "outreaches_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_team_members" ADD CONSTRAINT "outreach_team_members_outreach_id_fkey" FOREIGN KEY ("outreach_id") REFERENCES "outreaches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_team_members" ADD CONSTRAINT "outreach_team_members_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_mc_id_fkey" FOREIGN KEY ("mc_id") REFERENCES "mega_churches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_buscentre_id_fkey" FOREIGN KEY ("buscentre_id") REFERENCES "buscentres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_cell_id_fkey" FOREIGN KEY ("cell_id") REFERENCES "cells"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_follow_up_owner_id_fkey" FOREIGN KEY ("follow_up_owner_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_converted_member_id_fkey" FOREIGN KEY ("converted_member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_merged_into_id_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_outreach_id_fkey" FOREIGN KEY ("outreach_id") REFERENCES "outreaches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_met_by_member_id_fkey" FOREIGN KEY ("met_by_member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_activities" ADD CONSTRAINT "contact_activities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_activities" ADD CONSTRAINT "contact_activities_by_user_id_fkey" FOREIGN KEY ("by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

