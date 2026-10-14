-- CreateTable
CREATE TABLE "member_moves" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "from_shepherd_id" TEXT,
    "from_cell_id" TEXT,
    "from_buscentre_id" TEXT,
    "from_mc_id" TEXT,
    "from_label" TEXT NOT NULL,
    "to_shepherd_id" TEXT,
    "to_cell_id" TEXT,
    "to_buscentre_id" TEXT,
    "to_mc_id" TEXT,
    "to_label" TEXT NOT NULL,
    "reason" TEXT,
    "batch_id" TEXT,
    "moved_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_moves_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "member_moves_member_id_created_at_idx" ON "member_moves"("member_id", "created_at");

-- CreateIndex
CREATE INDEX "member_moves_batch_id_idx" ON "member_moves"("batch_id");

-- AddForeignKey
ALTER TABLE "member_moves" ADD CONSTRAINT "member_moves_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_moves" ADD CONSTRAINT "member_moves_moved_by_id_fkey" FOREIGN KEY ("moved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

