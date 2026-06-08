import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { candidateScopeWhere } from "@/lib/shepherd-candidates";

/**
 * GET — list shepherd candidates visible to the requester (scoped to their
 * place in the hierarchy — same scoping rules as the org tree).
 *
 * POST — a cell shepherd recommends a member from their own cell.
 * Body: { memberId, notes? }
 */

const LINK_HREF = "/org/shepherd-candidates";

// ── Recommendation notification helper ───────────────────────────────────────
// Runs after the candidate is created; never throws (caller catches).
async function fireRecommendationNotification(
  cellId: string,
  memberName: string,
  recommenderName: string
) {
  const cell = await prisma.cell.findUnique({
    where:  { id: cellId },
    select: { name: true, buscentreId: true },
  });
  if (!cell?.buscentreId) return;

  const buscentreHeadRole = await prisma.userRole.findFirst({
    where:  { role: "buscentre_head", buscentreId: cell.buscentreId },
    select: { userId: true },
  });
  if (!buscentreHeadRole) return;

  await prisma.notification.create({
    data: {
      userId:   buscentreHeadRole.userId,
      type:     "shepherd_candidate",
      title:    `New shepherd candidate — ${memberName}`,
      body:     `${recommenderName} recommended ${memberName} from ${cell.name} as ready to be considered for shepherding.`,
      linkHref: LINK_HREF,
    },
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const candidates = await prisma.shepherdCandidate.findMany({
    where: candidateScopeWhere(session.user),
    include: {
      member:         { select: { id: true, firstName: true, lastName: true, gender: true } },
      cell:           { select: { id: true, name: true } },
      recommendedBy:  { select: { id: true, name: true } },
      certifiedBy:    { select: { id: true, name: true } },
      wtgfRecordedBy: { select: { id: true, name: true } },
    },
    orderBy: { recommendedAt: "desc" },
  });

  return NextResponse.json(candidates);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  if (session.user.role !== "cell_shepherd" || !session.user.cellId) {
    return NextResponse.json({ error: "Only cell shepherds can recommend a member as a shepherd" }, { status: 403 });
  }

  const { memberId, notes } = await request.json();
  if (!memberId) return NextResponse.json({ error: "memberId is required" }, { status: 400 });

  const member = await prisma.member.findUnique({
    where:  { id: memberId },
    select: { id: true, cellId: true, firstName: true, lastName: true },
  });
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  if (member.cellId !== session.user.cellId) {
    return NextResponse.json({ error: "You can only recommend members from your own cell" }, { status: 403 });
  }

  const existing = await prisma.shepherdCandidate.findUnique({ where: { memberId } });
  if (existing) {
    return NextResponse.json({ error: "This member has already been put forward" }, { status: 409 });
  }

  const candidate = await prisma.shepherdCandidate.create({
    data: {
      memberId,
      cellId:          session.user.cellId,
      recommendedById: session.user.id,
      notes:           notes || null,
    },
  });

  fireRecommendationNotification(
    session.user.cellId,
    `${member.firstName} ${member.lastName}`,
    session.user.name ?? "A cell shepherd"
  ).catch(console.error);

  return NextResponse.json(candidate, { status: 201 });
}
