import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scopeContainsCell, CANDIDATE_CELL_SELECT } from "@/lib/shepherd-candidates";
import { WtgfStatus } from "@prisma/client";

type Params = { params: { id: string } };

const VALID_STATUSES: WtgfStatus[] = ["NOT_TAKEN", "SCHEDULED", "PASSED", "FAILED"];

/**
 * PATCH — record/update a candidate's WTGF (Welcome To God's Family) status.
 * Independent of certification — can be updated at any point, including after
 * the candidate has already been certified or placed as a shepherd.
 * Body: { wtgfStatus, wtgfDate? }
 */
export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { wtgfStatus, wtgfDate } = await request.json();
  if (!wtgfStatus || !VALID_STATUSES.includes(wtgfStatus)) {
    return NextResponse.json({ error: "A valid wtgfStatus is required" }, { status: 400 });
  }

  const candidate = await prisma.shepherdCandidate.findUnique({
    where:   { id: params.id },
    include: { cell: { select: CANDIDATE_CELL_SELECT } },
  });
  if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

  if (!scopeContainsCell(session.user, candidate.cell)) {
    return NextResponse.json({ error: "You're not permitted to update this candidate" }, { status: 403 });
  }

  const updated = await prisma.shepherdCandidate.update({
    where: { id: params.id },
    data: {
      wtgfStatus,
      wtgfDate:         wtgfDate ? new Date(wtgfDate) : null,
      wtgfRecordedById: session.user.id,
      wtgfUpdatedAt:    new Date(),
    },
  });

  return NextResponse.json(updated);
}
