import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canCertify, CANDIDATE_CELL_SELECT } from "@/lib/shepherd-candidates";

type Params = { params: { id: string } };

/**
 * POST — certify a candidate as ready to serve as a shepherd.
 * Permitted for anyone who outranks a cell shepherd AND oversees the candidate's cell
 * (buscentre head, MC pastor, chief shepherd, admin).
 */
export async function POST(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const candidate = await prisma.shepherdCandidate.findUnique({
    where:   { id: params.id },
    include: { cell: { select: CANDIDATE_CELL_SELECT } },
  });
  if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

  if (!canCertify(session.user, candidate.cell)) {
    return NextResponse.json({ error: "You're not permitted to certify this candidate" }, { status: 403 });
  }

  if (candidate.status === "CERTIFIED") {
    return NextResponse.json({ error: "Candidate is already certified" }, { status: 409 });
  }

  const updated = await prisma.shepherdCandidate.update({
    where: { id: params.id },
    data:  { status: "CERTIFIED", certifiedById: session.user.id, certifiedAt: new Date() },
  });

  return NextResponse.json(updated);
}
