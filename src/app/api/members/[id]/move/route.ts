import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { moveMembers, type Dest, type MoveLevel } from "@/lib/member-moves";

const LEVELS: MoveLevel[] = ["shepherd", "cell", "buscentre", "mc"];

// POST /api/members/[id]/move
// Body: { level, shepherdId | cellId | buscentreId | mcId, reason? }
// Sets shepherd, cell, buscentre and MC together, so the old shepherd never lingers.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const b = await request.json().catch(() => null) as (Dest & { reason?: string }) | null;
  if (!b || !LEVELS.includes(b.level)) return NextResponse.json({ error: "level is required" }, { status: 400 });

  const r = await moveMembers(session.user.id, { memberIds: [params.id], dest: b, reason: b.reason });

  // For one member a skip is an error the person should see
  const skipped = (r.body.skipped as { reason: string }[] | undefined) ?? [];
  if (r.status === 200 && skipped.length > 0) {
    return NextResponse.json({ error: skipped[0].reason }, { status: 409 });
  }
  return NextResponse.json(r.body, { status: r.status });
}
