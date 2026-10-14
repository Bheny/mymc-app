import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { moveMembers, type Dest, type MoveLevel } from "@/lib/member-moves";

const LEVELS: MoveLevel[] = ["shepherd", "cell", "buscentre", "mc"];

// POST /api/members/move — move several members at once.
// Body: { memberIds: string[] }  or  { fromShepherdId }  (everyone currently under that shepherd)
//       + { level, shepherdId | cellId | buscentreId | mcId, reason? }
// Members that can't be moved (outside your scope, leaders, already there…) are
// returned in `skipped` with a reason; the rest still move.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const b = await request.json().catch(() => null) as (Dest & { memberIds?: string[]; fromShepherdId?: string; reason?: string }) | null;
  if (!b || !LEVELS.includes(b.level)) return NextResponse.json({ error: "level is required" }, { status: 400 });

  let memberIds = Array.isArray(b.memberIds) ? b.memberIds : [];
  if (b.fromShepherdId) {
    const under = await prisma.member.findMany({ where: { shepherdId: b.fromShepherdId }, select: { id: true } });
    memberIds = under.map((m) => m.id);
    if (memberIds.length === 0) return NextResponse.json({ error: "That shepherd has no members to move" }, { status: 400 });
  }

  const r = await moveMembers(session.user.id, { memberIds, dest: b, reason: b.reason });
  return NextResponse.json(r.body, { status: r.status });
}
