import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { median, groupPresentByDate } from "@/lib/attendance-stats";

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getMonth(d: Date | string) { return new Date(d).getMonth() + 1; }

// Average/median present count, one sample per distinct date rather than per
// (cell, date) record — so at buscentre/mc/branch scope, a Sunday where 4 cells
// recorded 20/30/15/25 counts as ONE data point of 90, not four separate ones.
// A no-op for a single-cell input (at most one service per date per type).
function avgPresent(svcs: { date: Date; attendance: { id: string }[] }[]): number {
  const grouped = groupPresentByDate(svcs);
  if (!grouped.length) return 0;
  const total = grouped.reduce((s, n) => s + n, 0);
  return Math.round(total / grouped.length);
}

function medianPresent(svcs: { date: Date; attendance: { id: string }[] }[]): number {
  return median(groupPresentByDate(svcs));
}

// "N services" for the KPI subtitle — distinct dates, matching avgPresent/medianPresent
// above (e.g. 4 Sundays, not 4 cells × 4 Sundays).
function serviceOccurrences(svcs: { date: Date; attendance: { id: string }[] }[]): number {
  return groupPresentByDate(svcs).length;
}

function buildMonthly(
  yearServices:   { type: string; date: Date; attendance: { id: string }[] }[],
  yearFirstTimers: { service: { date: Date } }[],
  yearRetained:   { convertedAt: Date | null }[],
  yearSouls:      { date: Date }[],
) {
  return MONTH_LABELS.map((label, i) => {
    const m     = i + 1;
    const svcs  = yearServices.filter((s) => getMonth(s.date) === m);
    const lc        = svcs.filter((s) => s.type === "LC_LIVE");
    const mgs       = svcs.filter((s) => s.type === "MGS");
    return {
      month: m, label,
      lcLiveAvg:      avgPresent(lc),
      lcLiveMedian:   medianPresent(lc),
      lcLiveServices: serviceOccurrences(lc),
      mgsAvg:         avgPresent(mgs),
      mgsMedian:      medianPresent(mgs),
      mgsServices:    serviceOccurrences(mgs),
      firstTimers: yearFirstTimers.filter((ft) => getMonth(ft.service.date) === m).length,
      retained:    yearRetained.filter((ft) => ft.convertedAt && getMonth(ft.convertedAt) === m).length,
      soulsWon:    yearSouls.filter((s) => getMonth(s.date) === m).length,
    };
  });
}

function filterPeriod<T extends { date?: Date; service?: { date: Date }; convertedAt?: Date | null }>(
  items: T[], key: "date" | "service" | "convertedAt", month: number | null
): T[] {
  if (month === null) return items;
  return items.filter((item) => {
    const d = key === "service" ? (item as { service: { date: Date } }).service.date
            : key === "convertedAt" ? (item as { convertedAt?: Date | null }).convertedAt
            : (item as { date: Date }).date;
    return d && getMonth(d) === month;
  });
}

type ServiceEntry = {
  id:           string;
  type:         string;
  date:         string;
  mode:         string;
  speaker:      string | null;
  notes:        string | null;
  cellName?:    string; // buscentre scope only
  presentCount: number;
  totalMarked:  number;
  // Role-bucketed breakdown — cell + buscentre scope only (see route below)
  cellShepherdPresent?: number; // 0 or 1
  shepherdsPresent?:    number;
  membersPresent?:      number;
  firstTimersCount?:    number;
  firstTimersRetained?: number; // of this service's first-timers, converted to date
  soulsWonCount?:       number; // cellId + same calendar date match — approximate, see comment below
  totalAttendance?:     number; // cellShepherdPresent + shepherdsPresent + membersPresent + firstTimersCount
};

// ── Per-service role-bucketed breakdown ─────────────────────────────────────
//
// Builds cellId -> lookup maps once (not per service) for:
//   - which Member is the cell's cell_shepherd (via the cell_shepherd UserRole -> User -> Member)
//   - which Member ids occupy a shepherd slot in that cell (named directly, or via an activated User)
// then buckets each service's PRESENT attendance rows into cellShepherd / shepherds / members,
// and joins in first-timers (direct serviceId FK) and souls (cellId + calendar-date match — Soul
// has no serviceId FK, so if a cell logs two services on the same date, that day's souls will be
// counted on both rows).
async function buildServiceBreakdown(
  cellIds: string[],
  rawServices: {
    id: string; type: string; date: Date; mode: string; speaker: string | null; notes: string | null;
    cellId: string; cellName?: string;
    attendance: { status: string; member: { id: string } }[];
    firstTimers: { id: string; convertedToMemberId: string | null }[];
  }[],
  periodSouls: { cellId: string; date: Date }[],
): Promise<ServiceEntry[]> {
  const [cellShepherdRoles, shepherdSlots] = await Promise.all([
    prisma.userRole.findMany({
      where:  { role: "cell_shepherd", cellId: { in: cellIds } },
      select: { cellId: true, user: { select: { member: { select: { id: true } } } } },
    }),
    prisma.shepherd.findMany({
      where:  { cellId: { in: cellIds } },
      select: { cellId: true, memberId: true, user: { select: { member: { select: { id: true } } } } },
    }),
  ]);

  const cellShepherdMemberIdByCell = new Map<string, string | null>();
  for (const r of cellShepherdRoles) {
    if (r.cellId) cellShepherdMemberIdByCell.set(r.cellId, r.user?.member?.id ?? null);
  }

  const shepherdMemberIdsByCell = new Map<string, Set<string>>();
  for (const s of shepherdSlots) {
    const memberId = s.memberId ?? s.user?.member?.id ?? null;
    if (!memberId) continue;
    if (!shepherdMemberIdsByCell.has(s.cellId)) shepherdMemberIdsByCell.set(s.cellId, new Set());
    shepherdMemberIdsByCell.get(s.cellId)!.add(memberId);
  }

  const soulsByCellDate = new Map<string, number>();
  for (const s of periodSouls) {
    const key = `${s.cellId}|${s.date.toISOString().slice(0, 10)}`;
    soulsByCellDate.set(key, (soulsByCellDate.get(key) ?? 0) + 1);
  }

  return rawServices.map((s) => {
    const cellShepherdId = cellShepherdMemberIdByCell.get(s.cellId) ?? null;
    const shepherdIds    = shepherdMemberIdsByCell.get(s.cellId) ?? new Set<string>();

    let cellShepherdPresent = 0, shepherdsPresent = 0, membersPresent = 0;
    for (const a of s.attendance) {
      if (a.status !== "PRESENT") continue;
      if (cellShepherdId && a.member.id === cellShepherdId) cellShepherdPresent++;
      else if (shepherdIds.has(a.member.id))                shepherdsPresent++;
      else                                                  membersPresent++;
    }

    const firstTimersCount    = s.firstTimers.length;
    const firstTimersRetained = s.firstTimers.filter((ft) => ft.convertedToMemberId !== null).length;
    const soulsWonCount       = soulsByCellDate.get(`${s.cellId}|${s.date.toISOString().slice(0, 10)}`) ?? 0;

    return {
      id: s.id, type: s.type, date: s.date.toISOString(), mode: s.mode, speaker: s.speaker, notes: s.notes,
      cellName: s.cellName,
      presentCount: s.attendance.filter((a) => a.status === "PRESENT").length,
      totalMarked:  s.attendance.length,
      cellShepherdPresent, shepherdsPresent, membersPresent,
      firstTimersCount, firstTimersRetained, soulsWonCount,
      totalAttendance: cellShepherdPresent + shepherdsPresent + membersPresent + firstTimersCount,
    };
  });
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const sp    = new URL(request.url).searchParams;
  const year  = parseInt(sp.get("year")  ?? String(new Date().getFullYear()));
  const month = sp.get("month") ? parseInt(sp.get("month")!) : null;
  const filterShepherdId   = sp.get("shepherdId")      ?? null;
  const filterCellId       = sp.get("cellId")          ?? null;
  const filterBuscentreId  = sp.get("filterBuscentreId") ?? null;
  const filterMcId         = sp.get("filterMcId")      ?? null;
  const actingCellId       = sp.get("actingCellId")    ?? null;
  const actingBuscentreId  = sp.get("actingBuscentreId") ?? null;
  const actingMcId         = sp.get("actingMcId")      ?? null;
  const actingBranchId     = sp.get("actingBranchId")  ?? null;

  const yearStart = new Date(year, 0, 1);
  const yearEnd   = new Date(year, 11, 31, 23, 59, 59);

  // ── Resolve acting overrides — read fresh from DB so stale JWTs don't break scope ──

  const freshRole = await prisma.userRole.findUnique({
    where:  { userId: session.user.id },
    select: { role: true, buscentreId: true, cellId: true, mcId: true, branchId: true, actingAt: true },
  });

  const actingAt  = (freshRole?.actingAt  ?? session.user.actingAt  ?? {}) as Record<string, string>;
  let cellId      = freshRole?.cellId      ?? session.user.cellId      ?? null;
  let buscentreId = freshRole?.buscentreId ?? session.user.buscentreId ?? null;
  let mcId        = freshRole?.mcId        ?? session.user.mcId        ?? null;
  let branchId    = freshRole?.branchId    ?? session.user.branchId    ?? null;
  const userRole  = freshRole?.role        ?? session.user.role        ?? null;

  if (actingCellId) {
    if (actingAt.cell_id === actingCellId) cellId = actingCellId;
    else return NextResponse.json({ error: "No acting access to this cell" }, { status: 403 });
  }

  if (actingBuscentreId) {
    if (actingAt.buscentre_id === actingBuscentreId) buscentreId = actingBuscentreId;
    else return NextResponse.json({ error: "No acting access to this buscentre" }, { status: 403 });
  }

  if (actingMcId) {
    if (actingAt.mc_id === actingMcId) mcId = actingMcId;
    else return NextResponse.json({ error: "No acting access to this MC" }, { status: 403 });
  }

  if (actingBranchId) {
    if (actingAt.branch_id === actingBranchId) branchId = actingBranchId;
    else return NextResponse.json({ error: "No acting access to this branch" }, { status: 403 });
  }

  // Scope priority: cell > buscentre > branch > mc/admin
  const isCellScope = !actingBuscentreId && !actingMcId && !actingBranchId && (
    userRole === "cell_shepherd" ||
    userRole === "shepherd" ||
    !!actingCellId
  );
  const isBuscentreScope = !isCellScope && !actingMcId && !actingBranchId && (
    userRole === "buscentre_head" || !!actingBuscentreId
  );
  const isBranchScope = !isCellScope && !isBuscentreScope && !actingMcId && (
    userRole === "chief_shepherd" || !!actingBranchId
  );
  const isMcScope = !isCellScope && !isBuscentreScope && !isBranchScope && (
    userRole === "mc_pastor" ||
    userRole === "admin" ||
    !!actingMcId
  );

  if (isCellScope) {
    if (!cellId) return NextResponse.json({ error: "No cell assigned" }, { status: 400 });

    const cell = await prisma.cell.findUnique({
      where: { id: cellId },
      select: { id: true, name: true },
    });
    if (!cell) return NextResponse.json({ error: "Cell not found" }, { status: 404 });

    // Bulk fetch the whole year — group in JS (avoids 12× round trips)
    const [yearServices, yearFirstTimers, yearRetained, yearSouls, activeMembers, shepherds] =
      await Promise.all([
        prisma.service.findMany({
          where:  { cellId, date: { gte: yearStart, lte: yearEnd } },
          select: {
            id: true, type: true, date: true,
            attendance: {
              where:  { status: "PRESENT" },
              select: { id: true, member: { select: { id: true, shepherdId: true } } },
            },
          },
        }),
        prisma.firstTimer.findMany({
          where:  { cellId, service: { date: { gte: yearStart, lte: yearEnd } } },
          select: { id: true, service: { select: { date: true } } },
        }),
        prisma.firstTimer.findMany({
          where:  { cellId, convertedAt: { gte: yearStart, lte: yearEnd }, convertedToMemberId: { not: null } },
          select: { id: true, convertedAt: true },
        }),
        prisma.soul.findMany({
          where:  { cellId, date: { gte: yearStart, lte: yearEnd } },
          select: { id: true, cellId: true, date: true },
        }),
        prisma.member.count({ where: { cellId, isActive: true } }),
        prisma.shepherd.findMany({
          where:  { cellId },
          select: {
            id: true,
            user:   { select: { name: true } },
            person: { select: { firstName: true, lastName: true } },
            members: { where: { isActive: true }, select: { id: true } },
          },
          orderBy: { createdAt: "asc" },
        }),
      ]);

    // Period slice
    const periodSvcs      = filterPeriod(yearServices,    "date",        month) as typeof yearServices;
    const periodFT        = filterPeriod(yearFirstTimers, "service",     month) as typeof yearFirstTimers;
    const periodRetained  = filterPeriod(yearRetained,    "convertedAt", month) as typeof yearRetained;
    const periodSouls     = filterPeriod(yearSouls,       "date",        month) as typeof yearSouls;

    const lcSvcs  = periodSvcs.filter((s) => s.type === "LC_LIVE");
    const mgsSvcs = periodSvcs.filter((s) => s.type === "MGS");

    const summary = {
      lcLiveAvg:      avgPresent(lcSvcs),
      lcLiveMedian:   medianPresent(lcSvcs),
      lcLiveServices: serviceOccurrences(lcSvcs),
      mgsAvg:         avgPresent(mgsSvcs),
      mgsMedian:      medianPresent(mgsSvcs),
      mgsServices:    serviceOccurrences(mgsSvcs),
      firstTimers:    periodFT.length,
      retained:       periodRetained.length,
      soulsWon:       periodSouls.length,
      activeMembers,
    };

    // Shepherd breakdown — avg attendance for each shepherd's members in period
    const breakdown = shepherds
      .filter((sh) => !filterShepherdId || sh.id === filterShepherdId)
      .map((sh) => {
        const memberIds = new Set(sh.members.map((m) => m.id));
        const name = sh.user?.name
          ?? (sh.person ? `${sh.person.firstName} ${sh.person.lastName}` : "Unassigned");

        const lcPresent  = lcSvcs.map((svc)  => svc.attendance.filter((a) => memberIds.has(a.member.id)).length);
        const mgsPresent = mgsSvcs.map((svc) => svc.attendance.filter((a) => memberIds.has(a.member.id)).length);

        return {
          id:          sh.id,
          name,
          memberCount: sh.members.length,
          lcLiveAvg:  lcSvcs.length  > 0 ? Math.round(lcPresent.reduce( (s, n) => s + n, 0) / lcSvcs.length)  : 0,
          mgsAvg:     mgsSvcs.length > 0 ? Math.round(mgsPresent.reduce((s, n) => s + n, 0) / mgsSvcs.length) : 0,
        };
      });

    // Per-service detail — always built for a single cell (a full year here is only
    // ~100-150 services, cheap either way); month narrows the date range when set.
    const cellRangeStart = month !== null ? new Date(year, month - 1, 1)        : yearStart;
    const cellRangeEnd   = month !== null ? new Date(year, month,     0, 23, 59, 59) : yearEnd;
    const rawCellServices = await prisma.service.findMany({
      where:   { cellId, date: { gte: cellRangeStart, lte: cellRangeEnd } },
      select:  {
        id: true, type: true, date: true, mode: true, speaker: true, notes: true, cellId: true,
        attendance:  { select: { status: true, member: { select: { id: true } } } },
        firstTimers: { select: { id: true, convertedToMemberId: true } },
      },
      orderBy: { date: "asc" },
    });
    const services = await buildServiceBreakdown([cellId], rawCellServices, periodSouls);

    return NextResponse.json({
      scope:    { type: "cell", name: cell.name, id: cell.id },
      period:   { year, month },
      summary,
      monthly:  buildMonthly(yearServices, yearFirstTimers, yearRetained, yearSouls),
      breakdown,
      services,
    });
  }

  // ── Buscentre scope ──────────────────────────────────────────────────────────
  if (!isBuscentreScope && !isBranchScope && !isMcScope) {
    return NextResponse.json({ error: "No scope available for your role" }, { status: 400 });
  }

  if (isBuscentreScope && !buscentreId) {
    return NextResponse.json({ error: "No buscentre assigned to your account" }, { status: 400 });
  }

  if (isBuscentreScope) {
  const buscentre = await prisma.buscentre.findUnique({
    where:  { id: buscentreId! },
    select: { id: true, name: true },
  });
  if (!buscentre) return NextResponse.json({ error: "Buscentre not found" }, { status: 404 });

  const cells = await prisma.cell.findMany({
    where:   { buscentreId: buscentreId!, ...(filterCellId ? { id: filterCellId } : {}) },
    select: {
      id: true, name: true,
      userRoles: {
        where:  { role: "cell_shepherd" },
        select: { user: { select: { name: true } } },
      },
      _count: { select: { members: { where: { isActive: true } } } },
    },
    orderBy: { name: "asc" },
  });

  const cellIds = cells.map((c) => c.id);

  const emptyMonthly = MONTH_LABELS.map((label, i) => ({
    month: i + 1, label,
    lcLiveAvg: 0, lcLiveMedian: 0, lcLiveServices: 0, mgsAvg: 0, mgsMedian: 0, mgsServices: 0,
    firstTimers: 0, retained: 0, soulsWon: 0,
  }));

  if (!cellIds.length) {
    return NextResponse.json({
      scope:     { type: "buscentre", name: buscentre.name, id: buscentre.id },
      period:    { year, month },
      summary:   { lcLiveAvg: 0, lcLiveMedian: 0, lcLiveServices: 0, mgsAvg: 0, mgsMedian: 0, mgsServices: 0, firstTimers: 0, retained: 0, soulsWon: 0, activeMembers: 0 },
      monthly:   emptyMonthly,
      breakdown: [],
    });
  }

  const [yearServices, yearFirstTimers, yearRetained, yearSouls, activeMembersTotal] =
    await Promise.all([
      prisma.service.findMany({
        where:  { cellId: { in: cellIds }, date: { gte: yearStart, lte: yearEnd } },
        select: {
          id: true, type: true, date: true, cellId: true,
          attendance: { where: { status: "PRESENT" }, select: { id: true } },
        },
      }),
      prisma.firstTimer.findMany({
        where:  { cellId: { in: cellIds }, service: { date: { gte: yearStart, lte: yearEnd } } },
        select: { id: true, cellId: true, service: { select: { date: true } } },
      }),
      prisma.firstTimer.findMany({
        where:  { cellId: { in: cellIds }, convertedAt: { gte: yearStart, lte: yearEnd }, convertedToMemberId: { not: null } },
        select: { id: true, cellId: true, convertedAt: true },
      }),
      prisma.soul.findMany({
        where:  { cellId: { in: cellIds }, date: { gte: yearStart, lte: yearEnd } },
        select: { id: true, cellId: true, date: true },
      }),
      prisma.member.count({ where: { cell: { buscentreId: buscentreId! }, isActive: true } }),
    ]);

  const periodSvcs     = filterPeriod(yearServices,    "date",        month) as typeof yearServices;
  const periodFT       = filterPeriod(yearFirstTimers, "service",     month) as typeof yearFirstTimers;
  const periodRetained = filterPeriod(yearRetained,    "convertedAt", month) as typeof yearRetained;
  const periodSouls    = filterPeriod(yearSouls,       "date",        month) as typeof yearSouls;

  const lcSvcs  = periodSvcs.filter((s) => s.type === "LC_LIVE");
  const mgsSvcs = periodSvcs.filter((s) => s.type === "MGS");

  const summary = {
    lcLiveAvg:      avgPresent(lcSvcs),
    lcLiveMedian:   medianPresent(lcSvcs),
    lcLiveServices: serviceOccurrences(lcSvcs),
    mgsAvg:         avgPresent(mgsSvcs),
    mgsMedian:      medianPresent(mgsSvcs),
    mgsServices:    serviceOccurrences(mgsSvcs),
    firstTimers:    periodFT.length,
    retained:       periodRetained.length,
    soulsWon:       periodSouls.length,
    activeMembers:  activeMembersTotal,
  };

  const breakdown = cells.map((cell) => {
    const lc  = periodSvcs.filter((s) => s.cellId === cell.id && s.type === "LC_LIVE");
    const mgs = periodSvcs.filter((s) => s.cellId === cell.id && s.type === "MGS");
    return {
      id:           cell.id,
      name:         cell.name,
      cellShepherd: cell.userRoles[0]?.user?.name ?? null,
      memberCount:  cell._count.members,
      lcLiveAvg:    avgPresent(lc),
      mgsAvg:       avgPresent(mgs),
      firstTimers:  periodFT.filter( (ft) => ft.cellId === cell.id).length,
      retained:     periodRetained.filter((ft) => ft.cellId === cell.id).length,
      soulsWon:     periodSouls.filter((s)  => s.cellId  === cell.id).length,
    };
  });

  // Per-service detail — a full year is only built when scoped to a single cell
  // (via filterCellId). With every cell in the buscentre ("All cells"), a full year
  // would mean a year's worth of member-level attendance for every cell at once, so
  // that combination still requires picking a month to keep the query bounded.
  let bcServices: ServiceEntry[] = [];
  const singleCellSelected = !!filterCellId;
  if (month !== null || singleCellSelected) {
    const bcRangeStart = month !== null ? new Date(year, month - 1, 1)        : yearStart;
    const bcRangeEnd   = month !== null ? new Date(year, month,     0, 23, 59, 59) : yearEnd;
    const scopedCellIds = filterCellId ? [filterCellId] : cellIds;
    const raw = await prisma.service.findMany({
      where:   { cellId: { in: scopedCellIds }, date: { gte: bcRangeStart, lte: bcRangeEnd } },
      select:  {
        id: true, type: true, date: true, mode: true, speaker: true, notes: true, cellId: true,
        cell:        { select: { name: true } },
        attendance:  { select: { status: true, member: { select: { id: true } } } },
        firstTimers: { select: { id: true, convertedToMemberId: true } },
      },
      orderBy: [{ date: "asc" }, { type: "asc" }],
    });
    bcServices = await buildServiceBreakdown(
      scopedCellIds,
      raw.map((s) => ({ ...s, cellName: s.cell.name })),
      periodSouls,
    );
  }

  return NextResponse.json({
    scope:    { type: "buscentre", name: buscentre.name, id: buscentre.id },
    period:   { year, month },
    summary,
    monthly:  buildMonthly(yearServices, yearFirstTimers, yearRetained, yearSouls),
    breakdown,
    services: bcServices,
  });
  } // end isBuscentreScope

  // ── Branch scope (chief_shepherd) ────────────────────────────────────────────
  if (isBranchScope) {
    if (!branchId) return NextResponse.json({ error: "No branch assigned to your account" }, { status: 400 });

    const branch = await prisma.branch.findUnique({
      where:  { id: branchId },
      select: { id: true, name: true },
    });
    if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 404 });

    // Cells across the whole branch — self-authorizing via nested where, so an
    // out-of-branch filterMcId/filterBuscentreId simply matches nothing rather
    // than needing a separate authorize call.
    const branchCells = await prisma.cell.findMany({
      where: {
        buscentre: {
          mc: { branchId, ...(filterMcId ? { id: filterMcId } : {}) },
          ...(filterBuscentreId ? { id: filterBuscentreId } : {}),
        },
        ...(filterCellId ? { id: filterCellId } : {}),
      },
      select: {
        id: true, name: true,
        buscentreId: true,
        buscentre: { select: { id: true, name: true, mcId: true, mc: { select: { id: true, name: true } } } },
        userRoles: {
          where:  { role: "cell_shepherd" },
          select: { user: { select: { name: true } } },
        },
        _count: { select: { members: { where: { isActive: true } } } },
      },
      orderBy: [{ buscentre: { mc: { name: "asc" } } }, { buscentre: { name: "asc" } }, { name: "asc" }],
    });

    const branchCellIds = branchCells.map((c) => c.id);

    const emptyMonthly = MONTH_LABELS.map((label, i) => ({
      month: i + 1, label,
      lcLiveAvg: 0, lcLiveMedian: 0, lcLiveServices: 0, mgsAvg: 0, mgsMedian: 0, mgsServices: 0,
      firstTimers: 0, retained: 0, soulsWon: 0,
    }));

    if (!branchCellIds.length) {
      return NextResponse.json({
        scope:     { type: "branch", name: branch.name, id: branch.id },
        period:    { year, month },
        summary:   { lcLiveAvg: 0, lcLiveMedian: 0, lcLiveServices: 0, mgsAvg: 0, mgsMedian: 0, mgsServices: 0, firstTimers: 0, retained: 0, soulsWon: 0, activeMembers: 0 },
        monthly:   emptyMonthly,
        breakdown: [],
        services:  [],
      });
    }

    const [branchYearSvcs, branchYearFT, branchYearRetained, branchYearSouls, branchActiveMembers] =
      await Promise.all([
        prisma.service.findMany({
          where:  { cellId: { in: branchCellIds }, date: { gte: yearStart, lte: yearEnd } },
          select: {
            id: true, type: true, date: true, cellId: true,
            attendance: { where: { status: "PRESENT" }, select: { id: true } },
          },
        }),
        prisma.firstTimer.findMany({
          where:  { cellId: { in: branchCellIds }, service: { date: { gte: yearStart, lte: yearEnd } } },
          select: { id: true, cellId: true, service: { select: { date: true } } },
        }),
        prisma.firstTimer.findMany({
          where:  { cellId: { in: branchCellIds }, convertedAt: { gte: yearStart, lte: yearEnd }, convertedToMemberId: { not: null } },
          select: { id: true, cellId: true, convertedAt: true },
        }),
        prisma.soul.findMany({
          where:  { cellId: { in: branchCellIds }, date: { gte: yearStart, lte: yearEnd } },
          select: { id: true, cellId: true, date: true },
        }),
        prisma.member.count({ where: { cell: { buscentre: { mc: { branchId } } }, isActive: true } }),
      ]);

    const periodSvcs     = filterPeriod(branchYearSvcs,     "date",        month) as typeof branchYearSvcs;
    const periodFT       = filterPeriod(branchYearFT,       "service",     month) as typeof branchYearFT;
    const periodRetained = filterPeriod(branchYearRetained, "convertedAt", month) as typeof branchYearRetained;
    const periodSouls    = filterPeriod(branchYearSouls,    "date",        month) as typeof branchYearSouls;

    const lcSvcs  = periodSvcs.filter((s) => s.type === "LC_LIVE");
    const mgsSvcs = periodSvcs.filter((s) => s.type === "MGS");

    const summary = {
      lcLiveAvg:      avgPresent(lcSvcs),
      lcLiveMedian:   medianPresent(lcSvcs),
      lcLiveServices: serviceOccurrences(lcSvcs),
      mgsAvg:         avgPresent(mgsSvcs),
      mgsMedian:      medianPresent(mgsSvcs),
      mgsServices:    serviceOccurrences(mgsSvcs),
      firstTimers:    periodFT.length,
      retained:       periodRetained.length,
      soulsWon:       periodSouls.length,
      activeMembers:  branchActiveMembers,
    };

    const breakdown = branchCells.map((cell) => {
      const lc  = periodSvcs.filter((s) => s.cellId === cell.id && s.type === "LC_LIVE");
      const mgs = periodSvcs.filter((s) => s.cellId === cell.id && s.type === "MGS");
      return {
        id:            cell.id,
        name:          cell.name,
        cellShepherd:  cell.userRoles[0]?.user?.name ?? null,
        memberCount:   cell._count.members,
        lcLiveAvg:     avgPresent(lc),
        mgsAvg:        avgPresent(mgs),
        firstTimers:   periodFT.filter( (ft) => ft.cellId === cell.id).length,
        retained:      periodRetained.filter((ft) => ft.cellId === cell.id).length,
        soulsWon:      periodSouls.filter((s)  => s.cellId  === cell.id).length,
        buscentreId:   cell.buscentreId,
        buscentreName: cell.buscentre.name,
        mcId:          cell.buscentre.mcId,
        mcName:        cell.buscentre.mc.name,
      };
    });

    // Per-service detail — same rule as buscentre scope: always built for a single
    // cell, otherwise requires a month (a full year across every cell in the branch
    // would mean a year of member-level attendance for potentially many MCs at once).
    let branchServices: ServiceEntry[] = [];
    const singleCellSelected = !!filterCellId;
    if (month !== null || singleCellSelected) {
      const rangeStart = month !== null ? new Date(year, month - 1, 1)        : yearStart;
      const rangeEnd   = month !== null ? new Date(year, month,     0, 23, 59, 59) : yearEnd;
      const scopedCellIds = filterCellId ? [filterCellId] : branchCellIds;
      const raw = await prisma.service.findMany({
        where:   { cellId: { in: scopedCellIds }, date: { gte: rangeStart, lte: rangeEnd } },
        select:  {
          id: true, type: true, date: true, mode: true, speaker: true, notes: true, cellId: true,
          cell:        { select: { name: true } },
          attendance:  { select: { status: true, member: { select: { id: true } } } },
          firstTimers: { select: { id: true, convertedToMemberId: true } },
        },
        orderBy: [{ date: "asc" }, { type: "asc" }],
      });
      branchServices = await buildServiceBreakdown(
        scopedCellIds,
        raw.map((s) => ({ ...s, cellName: s.cell.name })),
        periodSouls,
      );
    }

    return NextResponse.json({
      scope:    { type: "branch", name: branch.name, id: branch.id },
      period:   { year, month },
      summary,
      monthly:  buildMonthly(branchYearSvcs, branchYearFT, branchYearRetained, branchYearSouls),
      breakdown,
      services: branchServices,
    });
  } // end isBranchScope

  // ── MC / Admin scope ─────────────────────────────────────────────────────────
  // mc_pastor uses their own mcId; admin must supply filterMcId (chief_shepherd is
  // handled entirely by the branch-scope block above).

  const mcIdToUse = (userRole === "mc_pastor" || !!actingMcId) ? mcId : filterMcId;

  const emptyMonthly = MONTH_LABELS.map((label, i) => ({
    month: i + 1, label,
    lcLiveAvg: 0, lcLiveMedian: 0, lcLiveServices: 0, mgsAvg: 0, mgsMedian: 0, mgsServices: 0,
    firstTimers: 0, retained: 0, soulsWon: 0,
  }));

  // Admin hasn't chosen an MC yet — return empty shell so the frontend can render
  if (!mcIdToUse) {
    return NextResponse.json({
      scope:     { type: "admin", name: "All", id: "" },
      period:    { year, month },
      summary:   { lcLiveAvg: 0, lcLiveMedian: 0, lcLiveServices: 0, mgsAvg: 0, mgsMedian: 0, mgsServices: 0, firstTimers: 0, retained: 0, soulsWon: 0, activeMembers: 0 },
      monthly:   emptyMonthly,
      breakdown: [],
      services:  [],
    });
  }

  const mc = await prisma.megaChurch.findUnique({
    where:  { id: mcIdToUse },
    select: { id: true, name: true },
  });
  if (!mc) return NextResponse.json({ error: "MegaChurch not found" }, { status: 404 });

  // Cells in this MC, optionally narrowed by buscentre or cell filter
  const mcCells = await prisma.cell.findMany({
    where: {
      buscentre: {
        mcId: mcIdToUse,
        ...(filterBuscentreId ? { id: filterBuscentreId } : {}),
      },
      ...(filterCellId ? { id: filterCellId } : {}),
    },
    select: {
      id: true, name: true,
      buscentreId: true,
      buscentre: { select: { id: true, name: true } },
      userRoles: {
        where:  { role: "cell_shepherd" },
        select: { user: { select: { name: true } } },
      },
      _count: { select: { members: { where: { isActive: true } } } },
    },
    orderBy: [{ buscentre: { name: "asc" } }, { name: "asc" }],
  });

  const mcCellIds = mcCells.map((c) => c.id);

  if (!mcCellIds.length) {
    return NextResponse.json({
      scope:     { type: "mc", name: mc.name, id: mc.id },
      period:    { year, month },
      summary:   { lcLiveAvg: 0, lcLiveMedian: 0, lcLiveServices: 0, mgsAvg: 0, mgsMedian: 0, mgsServices: 0, firstTimers: 0, retained: 0, soulsWon: 0, activeMembers: 0 },
      monthly:   emptyMonthly,
      breakdown: [],
      services:  [],
    });
  }

  const [mcYearSvcs, mcYearFT, mcYearRetained, mcYearSouls, mcActiveMembers] =
    await Promise.all([
      prisma.service.findMany({
        where:  { cellId: { in: mcCellIds }, date: { gte: yearStart, lte: yearEnd } },
        select: {
          id: true, type: true, date: true, cellId: true,
          attendance: { where: { status: "PRESENT" }, select: { id: true } },
        },
      }),
      prisma.firstTimer.findMany({
        where:  { cellId: { in: mcCellIds }, service: { date: { gte: yearStart, lte: yearEnd } } },
        select: { id: true, cellId: true, service: { select: { date: true } } },
      }),
      prisma.firstTimer.findMany({
        where:  { cellId: { in: mcCellIds }, convertedAt: { gte: yearStart, lte: yearEnd }, convertedToMemberId: { not: null } },
        select: { id: true, cellId: true, convertedAt: true },
      }),
      prisma.soul.findMany({
        where:  { cellId: { in: mcCellIds }, date: { gte: yearStart, lte: yearEnd } },
        select: { id: true, cellId: true, date: true },
      }),
      prisma.member.count({ where: { cell: { buscentre: { mcId: mcIdToUse } }, isActive: true } }),
    ]);

  const mcPeriodSvcs     = filterPeriod(mcYearSvcs,     "date",        month) as typeof mcYearSvcs;
  const mcPeriodFT       = filterPeriod(mcYearFT,       "service",     month) as typeof mcYearFT;
  const mcPeriodRetained = filterPeriod(mcYearRetained, "convertedAt", month) as typeof mcYearRetained;
  const mcPeriodSouls    = filterPeriod(mcYearSouls,    "date",        month) as typeof mcYearSouls;

  const mcLcSvcs  = mcPeriodSvcs.filter((s) => s.type === "LC_LIVE");
  const mcMgsSvcs = mcPeriodSvcs.filter((s) => s.type === "MGS");

  const mcSummary = {
    lcLiveAvg:      avgPresent(mcLcSvcs),
    lcLiveMedian:   medianPresent(mcLcSvcs),
    lcLiveServices: serviceOccurrences(mcLcSvcs),
    mgsAvg:         avgPresent(mcMgsSvcs),
    mgsMedian:      medianPresent(mcMgsSvcs),
    mgsServices:    serviceOccurrences(mcMgsSvcs),
    firstTimers:    mcPeriodFT.length,
    retained:       mcPeriodRetained.length,
    soulsWon:       mcPeriodSouls.length,
    activeMembers:  mcActiveMembers,
  };

  const mcBreakdown = mcCells.map((cell) => {
    const lc  = mcPeriodSvcs.filter((s) => s.cellId === cell.id && s.type === "LC_LIVE");
    const mgs = mcPeriodSvcs.filter((s) => s.cellId === cell.id && s.type === "MGS");
    return {
      id:             cell.id,
      name:           cell.name,
      buscentreName:  cell.buscentre.name,
      buscentreId:    cell.buscentreId,
      cellShepherd:   cell.userRoles[0]?.user?.name ?? null,
      memberCount:    cell._count.members,
      lcLiveAvg:      avgPresent(lc),
      mgsAvg:         avgPresent(mgs),
      firstTimers:    mcPeriodFT.filter( (ft) => ft.cellId === cell.id).length,
      retained:       mcPeriodRetained.filter((ft) => ft.cellId === cell.id).length,
      soulsWon:       mcPeriodSouls.filter((s)  => s.cellId  === cell.id).length,
    };
  });

  // Per-service detail — same rule as buscentre/branch scope: always built for a
  // single cell, otherwise requires a month.
  let mcServices: ServiceEntry[] = [];
  const mcSingleCellSelected = !!filterCellId;
  if (month !== null || mcSingleCellSelected) {
    const mcRangeStart = month !== null ? new Date(year, month - 1, 1)        : yearStart;
    const mcRangeEnd   = month !== null ? new Date(year, month,     0, 23, 59, 59) : yearEnd;
    const scopedCellIds = filterCellId ? [filterCellId] : mcCellIds;
    const raw = await prisma.service.findMany({
      where:   { cellId: { in: scopedCellIds }, date: { gte: mcRangeStart, lte: mcRangeEnd } },
      select:  {
        id: true, type: true, date: true, mode: true, speaker: true, notes: true, cellId: true,
        cell:        { select: { name: true } },
        attendance:  { select: { status: true, member: { select: { id: true } } } },
        firstTimers: { select: { id: true, convertedToMemberId: true } },
      },
      orderBy: [{ date: "asc" }, { type: "asc" }],
    });
    mcServices = await buildServiceBreakdown(
      scopedCellIds,
      raw.map((s) => ({ ...s, cellName: s.cell.name })),
      mcPeriodSouls,
    );
  }

  return NextResponse.json({
    scope:    { type: "mc", name: mc.name, id: mc.id },
    period:   { year, month },
    summary:  mcSummary,
    monthly:  buildMonthly(mcYearSvcs, mcYearFT, mcYearRetained, mcYearSouls),
    breakdown: mcBreakdown,
    services:  mcServices,
  });
}
