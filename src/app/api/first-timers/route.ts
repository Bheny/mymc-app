import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const sp           = new URL(request.url).searchParams;
  const status       = sp.get("status");       // "GREEN" | "YELLOW" | "RED" | "unreached" | null (all)
  const take         = parseInt(sp.get("take") ?? "50");
  const actingCellId      = sp.get("actingCellId")      ?? null;
  const actingBuscentreId = sp.get("actingBuscentreId") ?? null;

  // Resolve scope fresh from DB
  const freshRole = await prisma.userRole.findUnique({
    where:  { userId: session.user.id },
    select: { role: true, cellId: true, buscentreId: true, actingAt: true },
  });

  const actingAt  = (freshRole?.actingAt ?? {}) as Record<string, string>;
  let cellId      = freshRole?.cellId      ?? session.user.cellId      ?? null;
  let buscentreId = freshRole?.buscentreId ?? session.user.buscentreId ?? null;
  const userRole  = freshRole?.role        ?? session.user.role        ?? null;

  if (actingCellId && actingAt.cell_id === actingCellId)           cellId      = actingCellId;
  if (actingBuscentreId && actingAt.buscentre_id === actingBuscentreId) buscentreId = actingBuscentreId;

  // Build cell scope
  let cellFilter: object = {};
  if (userRole === "cell_shepherd" || userRole === "shepherd" || actingCellId) {
    if (!cellId) return NextResponse.json({ error: "No cell assigned" }, { status: 400 });
    cellFilter = { cellId };
  } else if (userRole === "buscentre_head" || actingBuscentreId) {
    if (!buscentreId) return NextResponse.json({ error: "No buscentre assigned" }, { status: 400 });
    cellFilter = { cell: { buscentreId } };
  }

  // Build status filter
  let statusFilter: object = {};
  if (status === "unreached") statusFilter = { reachOutStatus: null };
  else if (status)            statusFilter = { reachOutStatus: status };

  const firstTimers = await prisma.firstTimer.findMany({
    where:   { ...cellFilter, ...statusFilter },
    select: {
      id: true, firstName: true, lastName: true, phone: true,
      location: true, referredBy: true, intent: true,
      reachOutStatus: true, reachOutNote: true, reachedOutAt: true,
      convertedToMemberId: true, convertedAt: true,
      createdAt: true,
      cell:    { select: { id: true, name: true } },
      service: { select: { date: true, type: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });

  // Summary counts
  const [total, green, yellow, red, unreached] = await Promise.all([
    prisma.firstTimer.count({ where: { ...cellFilter } }),
    prisma.firstTimer.count({ where: { ...cellFilter, reachOutStatus: "GREEN"  } }),
    prisma.firstTimer.count({ where: { ...cellFilter, reachOutStatus: "YELLOW" } }),
    prisma.firstTimer.count({ where: { ...cellFilter, reachOutStatus: "RED"    } }),
    prisma.firstTimer.count({ where: { ...cellFilter, reachOutStatus: null     } }),
  ]);

  return NextResponse.json({ firstTimers, summary: { total, green, yellow, red, unreached } });
}
