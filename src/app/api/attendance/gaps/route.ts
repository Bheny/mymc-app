import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const WEEKS_BACK = 4; // maximum fill-back window

/** Returns the ISO date string (YYYY-MM-DD) for a Date in local time */
function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * Build the list of Wednesdays (LC_LIVE) and Sundays (MGS) that should
 * have attendance records for the given cell, going back WEEKS_BACK weeks
 * from yesterday (today's service may not have happened yet).
 */
function expectedDates(): { date: string; type: "LC_LIVE" | "MGS"; label: string }[] {
  const results: { date: string; type: "LC_LIVE" | "MGS"; label: string }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 1; i <= WEEKS_BACK * 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const day = d.getDay(); // 0=Sun, 3=Wed
    if (day === 3 || day === 0) {
      results.push({
        date:  toDateStr(d),
        type:  day === 3 ? "LC_LIVE" : "MGS",
        label: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
      });
    }
  }

  return results; // already sorted newest-first
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const sp                = new URL(request.url).searchParams;
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

  if (actingCellId && actingAt.cell_id === actingCellId)                 cellId      = actingCellId;
  if (actingBuscentreId && actingAt.buscentre_id === actingBuscentreId)  buscentreId = actingBuscentreId;

  const candidates = expectedDates();
  if (!candidates.length) return NextResponse.json({ gaps: [], cells: [] });

  const dateRange = {
    gte: new Date(candidates[candidates.length - 1].date),
    lte: new Date(candidates[0].date + "T23:59:59"),
  };

  // ── Cell scope (cell_shepherd / acting cell) ────────────────────────────────
  const isCellScope = (userRole === "cell_shepherd" || userRole === "shepherd" || !!actingCellId) && !actingBuscentreId;

  if (isCellScope) {
    if (!cellId) return NextResponse.json({ gaps: [], cells: [] });

    const existing = await prisma.service.findMany({
      where:  { cellId, date: dateRange },
      select: { type: true, date: true },
    });
    const existingSet = new Set(existing.map((s) => `${toDateStr(s.date)}_${s.type}`));
    const gaps = candidates.filter((c) => !existingSet.has(`${c.date}_${c.type}`));
    return NextResponse.json({ gaps, cells: [] });
  }

  // ── Buscentre scope — return per-cell gap summary ───────────────────────────
  if (userRole === "buscentre_head" || actingBuscentreId) {
    if (!buscentreId) return NextResponse.json({ gaps: [], cells: [] });

    const cells = await prisma.cell.findMany({
      where:   { buscentreId },
      select: {
        id: true, name: true,
        userRoles: { where: { role: "cell_shepherd" }, select: { user: { select: { name: true } } } },
      },
      orderBy: { name: "asc" },
    });

    const allServices = await prisma.service.findMany({
      where:  { cellId: { in: cells.map((c) => c.id) }, date: dateRange },
      select: { type: true, date: true, cellId: true },
    });

    const existingByCell = new Map<string, Set<string>>();
    for (const svc of allServices) {
      const cid = svc.cellId;
      if (!existingByCell.has(cid)) existingByCell.set(cid, new Set());
      existingByCell.get(cid)!.add(`${toDateStr(svc.date)}_${svc.type}`);
    }

    const cellResults = cells
      .map((cell) => {
        const existing = existingByCell.get(cell.id) ?? new Set();
        const gaps     = candidates.filter((c) => !existing.has(`${c.date}_${c.type}`));
        return {
          cellId:        cell.id,
          cellName:      cell.name,
          cellShepherd:  cell.userRoles[0]?.user?.name ?? null,
          gapCount:      gaps.length,
          gaps,
        };
      })
      .filter((c) => c.gapCount > 0)
      .sort((a, b) => b.gapCount - a.gapCount);

    const totalGaps = cellResults.reduce((s, c) => s + c.gapCount, 0);
    return NextResponse.json({ gaps: [], cells: cellResults, totalGaps });
  }

  return NextResponse.json({ gaps: [], cells: [] });
}
