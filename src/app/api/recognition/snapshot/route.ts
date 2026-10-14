import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { parsePeriod, saveSnapshot, viewerFor } from "@/lib/recognition";

// POST /api/recognition/snapshot { period: "2026-09" }
// Freezes (or re-freezes) a month's results as they stand now. Closed months freeze themselves the
// first time they're opened a week after they end; this is for doing it deliberately — e.g. to pick
// up records entered after that, or to freeze a month early.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const viewer = await viewerFor(session.user.id);
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "chief_shepherd")) {
    return NextResponse.json({ error: "Only an admin or chief shepherd can freeze a month" }, { status: 403 });
  }

  const b = await request.json().catch(() => null);
  const period = parsePeriod(b?.period);
  if (!b?.period || !period || period.kind !== "month") {
    return NextResponse.json({ error: "period must be a month, like 2026-09" }, { status: 400 });
  }
  if (period.start.getTime() > Date.now()) {
    return NextResponse.json({ error: "That month hasn't started yet" }, { status: 400 });
  }

  await saveSnapshot(viewer.branchId, period, undefined, true);
  return NextResponse.json({ ok: true, period: period.key });
}
