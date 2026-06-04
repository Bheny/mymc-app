import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getMonth(d: Date | string) { return new Date(d).getMonth() + 1; }

function avgPresent(svcs: { attendance: { id: string }[] }[]): number {
  if (!svcs.length) return 0;
  const total = svcs.reduce((s, svc) => s + svc.attendance.length, 0);
  return Math.round((total / svcs.length) * 10) / 10;
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
      lcLiveServices: lc.length,
      mgsAvg:         avgPresent(mgs),
      mgsServices:    mgs.length,
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
};

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

  const yearStart = new Date(year, 0, 1);
  const yearEnd   = new Date(year, 11, 31, 23, 59, 59);

  // ── Resolve acting overrides — read fresh from DB so stale JWTs don't break scope ──

  const freshRole = await prisma.userRole.findUnique({
    where:  { userId: session.user.id },
    select: { role: true, buscentreId: true, cellId: true, mcId: true, actingAt: true },
  });

  const actingAt  = (freshRole?.actingAt  ?? session.user.actingAt  ?? {}) as Record<string, string>;
  let cellId      = freshRole?.cellId      ?? session.user.cellId      ?? null;
  let buscentreId = freshRole?.buscentreId ?? session.user.buscentreId ?? null;
  const mcId      = freshRole?.mcId        ?? session.user.mcId        ?? null;
  const userRole  = freshRole?.role        ?? session.user.role        ?? null;

  if (actingCellId) {
    if (actingAt.cell_id === actingCellId) cellId = actingCellId;
    else return NextResponse.json({ error: "No acting access to this cell" }, { status: 403 });
  }

  if (actingBuscentreId) {
    if (actingAt.buscentre_id === actingBuscentreId) buscentreId = actingBuscentreId;
    else return NextResponse.json({ error: "No acting access to this buscentre" }, { status: 403 });
  }

  // Scope priority: cell > buscentre > mc/admin
  const isCellScope = !actingBuscentreId && (
    userRole === "cell_shepherd" ||
    userRole === "shepherd" ||
    !!actingCellId
  );
  const isBuscentreScope = !isCellScope && (
    userRole === "buscentre_head" || !!actingBuscentreId
  );
  const isMcScope = !isCellScope && !isBuscentreScope && (
    userRole === "mc_pastor" ||
    userRole === "admin" ||
    userRole === "chief_shepherd"
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
          select: { id: true, date: true },
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
      lcLiveServices: lcSvcs.length,
      mgsAvg:         avgPresent(mgsSvcs),
      mgsServices:    mgsSvcs.length,
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
          lcLiveAvg:  lcSvcs.length  > 0 ? Math.round(lcPresent.reduce( (s, n) => s + n, 0) / lcSvcs.length  * 10) / 10 : 0,
          mgsAvg:     mgsSvcs.length > 0 ? Math.round(mgsPresent.reduce((s, n) => s + n, 0) / mgsSvcs.length * 10) / 10 : 0,
        };
      });

    // Per-service detail — only when a specific month is selected
    let services: ServiceEntry[] = [];
    if (month !== null) {
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd   = new Date(year, month,     0, 23, 59, 59);
      const raw = await prisma.service.findMany({
        where:   { cellId, date: { gte: monthStart, lte: monthEnd } },
        select:  {
          id: true, type: true, date: true, mode: true, speaker: true, notes: true,
          attendance: { select: { status: true } },
        },
        orderBy: { date: "asc" },
      });
      services = raw.map((s) => ({
        id:           s.id,
        type:         s.type,
        date:         s.date.toISOString(),
        mode:         s.mode,
        speaker:      s.speaker,
        notes:        s.notes,
        presentCount: s.attendance.filter((a) => a.status === "PRESENT").length,
        totalMarked:  s.attendance.length,
      }));
    }

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
  if (!isBuscentreScope && !isMcScope) {
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
    lcLiveAvg: 0, lcLiveServices: 0, mgsAvg: 0, mgsServices: 0,
    firstTimers: 0, retained: 0, soulsWon: 0,
  }));

  if (!cellIds.length) {
    return NextResponse.json({
      scope:     { type: "buscentre", name: buscentre.name, id: buscentre.id },
      period:    { year, month },
      summary:   { lcLiveAvg: 0, lcLiveServices: 0, mgsAvg: 0, mgsServices: 0, firstTimers: 0, retained: 0, soulsWon: 0, activeMembers: 0 },
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
    lcLiveServices: lcSvcs.length,
    mgsAvg:         avgPresent(mgsSvcs),
    mgsServices:    mgsSvcs.length,
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

  // Per-service detail — only when a specific month is selected
  let bcServices: ServiceEntry[] = [];
  if (month !== null) {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd   = new Date(year, month,     0, 23, 59, 59);
    const scopedCellIds = filterCellId ? [filterCellId] : cellIds;
    const raw = await prisma.service.findMany({
      where:   { cellId: { in: scopedCellIds }, date: { gte: monthStart, lte: monthEnd } },
      select:  {
        id: true, type: true, date: true, mode: true, speaker: true, notes: true,
        cell:       { select: { name: true } },
        attendance: { select: { status: true } },
      },
      orderBy: [{ date: "asc" }, { type: "asc" }],
    });
    bcServices = raw.map((s) => ({
      id:           s.id,
      type:         s.type,
      date:         s.date.toISOString(),
      mode:         s.mode,
      speaker:      s.speaker,
      notes:        s.notes,
      cellName:     s.cell.name,
      presentCount: s.attendance.filter((a) => a.status === "PRESENT").length,
      totalMarked:  s.attendance.length,
    }));
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

  // ── MC / Admin scope ─────────────────────────────────────────────────────────
  // mc_pastor uses their own mcId; admin/chief_shepherd must supply filterMcId.

  const mcIdToUse = (userRole === "mc_pastor") ? mcId : filterMcId;

  const emptyMonthly = MONTH_LABELS.map((label, i) => ({
    month: i + 1, label,
    lcLiveAvg: 0, lcLiveServices: 0, mgsAvg: 0, mgsServices: 0,
    firstTimers: 0, retained: 0, soulsWon: 0,
  }));

  // Admin hasn't chosen an MC yet — return empty shell so the frontend can render
  if (!mcIdToUse) {
    return NextResponse.json({
      scope:     { type: "admin", name: "All", id: "" },
      period:    { year, month },
      summary:   { lcLiveAvg: 0, lcLiveServices: 0, mgsAvg: 0, mgsServices: 0, firstTimers: 0, retained: 0, soulsWon: 0, activeMembers: 0 },
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
      summary:   { lcLiveAvg: 0, lcLiveServices: 0, mgsAvg: 0, mgsServices: 0, firstTimers: 0, retained: 0, soulsWon: 0, activeMembers: 0 },
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
    lcLiveServices: mcLcSvcs.length,
    mgsAvg:         avgPresent(mcMgsSvcs),
    mgsServices:    mcMgsSvcs.length,
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

  let mcServices: ServiceEntry[] = [];
  if (month !== null) {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd   = new Date(year, month,     0, 23, 59, 59);
    const raw = await prisma.service.findMany({
      where:   { cellId: { in: mcCellIds }, date: { gte: monthStart, lte: monthEnd } },
      select:  {
        id: true, type: true, date: true, mode: true, speaker: true, notes: true,
        cell:       { select: { name: true } },
        attendance: { select: { status: true } },
      },
      orderBy: [{ date: "asc" }, { type: "asc" }],
    });
    mcServices = raw.map((s) => ({
      id:           s.id,
      type:         s.type,
      date:         s.date.toISOString(),
      mode:         s.mode,
      speaker:      s.speaker,
      notes:        s.notes,
      cellName:     s.cell.name,
      presentCount: s.attendance.filter((a) => a.status === "PRESENT").length,
      totalMarked:  s.attendance.length,
    }));
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
