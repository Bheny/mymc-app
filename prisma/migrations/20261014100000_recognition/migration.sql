-- AlterTable
ALTER TABLE "souls" ADD COLUMN "won_by_member_id" TEXT;

-- AlterTable
ALTER TABLE "first_timers" ADD COLUMN "brought_by_member_id" TEXT;

-- CreateTable
CREATE TABLE "recognition_snapshots" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recognition_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "souls_won_by_member_id_date_idx" ON "souls"("won_by_member_id", "date");

-- CreateIndex
CREATE INDEX "first_timers_brought_by_member_id_idx" ON "first_timers"("brought_by_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "recognition_snapshots_branch_id_period_key" ON "recognition_snapshots"("branch_id", "period");

-- AddForeignKey
ALTER TABLE "souls" ADD CONSTRAINT "souls_won_by_member_id_fkey" FOREIGN KEY ("won_by_member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "first_timers" ADD CONSTRAINT "first_timers_brought_by_member_id_fkey" FOREIGN KEY ("brought_by_member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
