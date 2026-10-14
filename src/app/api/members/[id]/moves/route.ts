import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { actorViews, canEditMember } from "@/lib/member-moves";

// GET /api/members/[id]/moves — where this member has been, newest first
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const member = await prisma.member.findUnique({
    where: { id: params.id },
    select: { id: true, shepherdId: true, cellId: true, buscentreId: true, mcId: true },
  });
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canEditMember(await actorViews(session.user.id), member))) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const moves = await prisma.memberMove.findMany({
    where: { memberId: params.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true, fromLabel: true, toLabel: true, reason: true, batchId: true, createdAt: true,
      movedBy: { select: { name: true } },
    },
  });
  return NextResponse.json(moves);
}
