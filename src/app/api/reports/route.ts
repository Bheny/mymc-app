import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildLeadershipIndex, resolveFromIndex } from "@/lib/leadership";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDates(from: string | null, to: string | null) {
  const start = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
  const end   = to   ? new Date(to + "T23:59:59") : new Date();
  return { start, end };
}

async function resolveCellIds(scope: string | null, scopeId: string | null): Promise<string[]> {
  if (scope === "cell"      && scopeId) return [scopeId];
  if (scope === "buscentre" && scopeId) {
    const rows = await prisma.cell.findMany({ where: { buscentreId: scopeId }, select: { id: true } });
    return rows.map((r) => r.id);
  }
  if (scope === "mc" && scopeId) {
    const rows = await prisma.cell.findMany({ where: { buscentre: { mcId: scopeId } }, select: { id: true } });
    return rows.map((r) => r.id);
  }
  return [];
}

// ─── Report handlers ──────────────────────────────────────────────────────────

async function cellsReadyToDivide(scope: string | null, scopeId: string | null, threshold: number) {
  const where =
    scope === "buscentre" && scopeId ? { buscentreId: scopeId }
    : scope === "mc"      && scopeId ? { buscentre: { mcId: scopeId } }
    : scope === "cell"    && scopeId ? { id: scopeId }
    : {};

  const cells = await prisma.cell.findMany({
    where,
    select: {
      id: true, name: true,
      buscentre: { select: { name: true } },
      userRoles: { where: { role: "cell_shepherd" }, select: { user: { select: { name: true } } } },
      _count:    { select: { members: { where: { isActive: true } } } },
    },
    orderBy: { members: { _count: "desc" } },
  });

  const rows = cells.map((c) => ({
    id:           c.id,
    name:         c.name,
    buscentre:    c.buscentre.name,
    cellShepherd: c.userRoles[0]?.user?.name ?? null,
    memberCount:  c._count.members,
    overBy:       Math.max(0, c._count.members - threshold),
    status:       c._count.members >= threshold ? "ready" : c._count.members >= threshold * 0.7 ? "approaching" : "ok",
  }));

  const readyCount = rows.filter((r) => r.status === "ready").length;
  return {
    threshold, readyCount, rows,
    summary: `${readyCount} cell${readyCount !== 1 ? "s" : ""} at or above the ${threshold}-member cap`,
  };
}

async function consistentAbsentees(
  scope: string | null, scopeId: string | null,
  from: string | null, to: string | null, minAbsences: number,
  branchId: string | null
) {
  const { start, end } = parseDates(from, to);
  const cellIds = await resolveCellIds(scope, scopeId);

  const grouped = await prisma.attendance.groupBy({
    by:    ["memberId"],
    where: {
      status:  "ABSENT",
      service: { date: { gte: start, lte: end }, ...(cellIds.length ? { cellId: { in: cellIds } } : {}) },
    },
    _count:  { memberId: true },
    having:  { memberId: { _count: { gte: minAbsences } } },
    orderBy: { _count: { memberId: "desc" } },
  });

  const memberIds = grouped.map((g) => g.memberId);
  const countMap  = Object.fromEntries(grouped.map((g) => [g.memberId, g._count.memberId]));

  const members = await prisma.member.findMany({
    where:  { id: { in: memberIds } },
    select: {
      id: true, firstName: true, lastName: true, phone: true,
      userId: true, shepherdId: true, cellId: true, buscentreId: true, mcId: true,
      shepherd: {
        select: {
          user:   { select: { id: true, name: true } },
          person: { select: { firstName: true, lastName: true } },
        },
      },
      cell: { select: { name: true, buscentre: { select: { name: true } } } },
    },
  });

  const index = branchId ? await buildLeadershipIndex(branchId) : null;

  const rows = members.map((m) => ({
    id:          m.id,
    name:        `${m.firstName} ${m.lastName}`,
    phone:       m.phone,
    cell:        m.cell?.name ?? "—",
    buscentre:   m.cell?.buscentre?.name ?? "—",
    shepherd:    index ? resolveFromIndex(m, index) : "Unassigned",
    absentCount: countMap[m.id] ?? 0,
  })).sort((a, b) => b.absentCount - a.absentCount);

  return {
    minAbsences,
    dateRange: { from: start.toISOString(), to: end.toISOString() },
    totalMembers: rows.length,
    rows,
    summary: `${rows.length} member${rows.length !== 1 ? "s" : ""} absent ${minAbsences}+ times in the selected period`,
  };
}

async function shepherdLoad(scope: string | null, scopeId: string | null, cap: number) {
  const cellWhere =
    scope === "buscentre" && scopeId ? { buscentreId: scopeId }
    : scope === "mc"      && scopeId ? { buscentre: { mcId: scopeId } }
    : scope === "cell"    && scopeId ? { id: scopeId }
    : {};

  const shepherds = await prisma.shepherd.findMany({
    where:   { cell: cellWhere },
    select: {
      id: true,
      user:   { select: { name: true } },
      person: { select: { firstName: true, lastName: true } },
      cell:   { select: { name: true, buscentre: { select: { name: true } } } },
      _count: { select: { members: { where: { isActive: true } } } },
    },
    orderBy: { members: { _count: "desc" } },
  });

  const rows = shepherds.map((s) => {
    const name  = s.user?.name ?? (s.person ? `${s.person.firstName} ${s.person.lastName}` : null);
    const count = s._count.members;
    return {
      id: s.id, name, cell: s.cell.name, buscentre: s.cell.buscentre.name,
      memberCount: count, capacity: cap,
      overBy:  Math.max(0, count - cap),
      status:  count >= cap ? "overloaded" : count >= cap * 0.8 ? "near-cap" : "ok",
    };
  });

  const overloaded = rows.filter((r) => r.status === "overloaded").length;
  const unassigned = rows.filter((r) => !r.name).length;
  return {
    cap, rows, overloadedCount: overloaded, unassignedCount: unassigned,
    summary: `${overloaded} shepherd${overloaded !== 1 ? "s" : ""} over the ${cap}-member cap · ${unassigned} unfilled slot${unassigned !== 1 ? "s" : ""}`,
  };
}

async function firstTimerConversion(
  scope: string | null, scopeId: string | null,
  from: string | null, to: string | null
) {
  const { start, end } = parseDates(from, to);
  const cellIds = await resolveCellIds(scope, scopeId);
  const cellFilter = cellIds.length ? { cellId: { in: cellIds } } : {};

  const [fts, convertedCount] = await Promise.all([
    prisma.firstTimer.findMany({
      where:  { service: { date: { gte: start, lte: end } }, ...cellFilter },
      select: {
        id: true, firstName: true, lastName: true, intent: true,
        convertedToMemberId: true, cellId: true,
        cell:    { select: { name: true, buscentre: { select: { name: true } } } },
        service: { select: { date: true } },
      },
    }),
    prisma.firstTimer.count({
      where: { convertedAt: { gte: start, lte: end }, convertedToMemberId: { not: null }, ...cellFilter },
    }),
  ]);

  const byCellMap: Record<string, { cell: string; buscentre: string; total: number; converted: number }> = {};
  for (const ft of fts) {
    const key = ft.cellId;
    if (!byCellMap[key]) byCellMap[key] = { cell: ft.cell?.name ?? "—", buscentre: ft.cell?.buscentre?.name ?? "—", total: 0, converted: 0 };
    byCellMap[key].total++;
    if (ft.convertedToMemberId) byCellMap[key].converted++;
  }

  const byCell = Object.values(byCellMap)
    .map((r) => ({ ...r, rate: r.total > 0 ? Math.round((r.converted / r.total) * 100) : 0 }))
    .sort((a, b) => b.total - a.total);

  const total = fts.length;
  const rate  = total > 0 ? Math.round((convertedCount / total) * 100) : 0;
  const wantsJoin = fts.filter((f) => f.intent === "WANTS_TO_JOIN").length;

  return {
    dateRange: { from: start.toISOString(), to: end.toISOString() },
    total, converted: convertedCount, rate, wantsJoin, byCell,
    summary: `${total} first timers · ${convertedCount} converted (${rate}%) · ${wantsJoin} expressed intent to join`,
  };
}

async function highestAttendance(
  scope: string | null, scopeId: string | null,
  from: string | null, to: string | null, topN: number
) {
  const { start, end } = parseDates(from, to);
  const cellIds = await resolveCellIds(scope, scopeId);

  const services = await prisma.service.findMany({
    where: {
      date: { gte: start, lte: end },
      ...(cellIds.length ? { cellId: { in: cellIds } } : {}),
    },
    select: {
      id: true, type: true, date: true, mode: true, speaker: true,
      cell:       { select: { name: true, buscentre: { select: { name: true } } } },
      _count:     { select: { attendance: true } },
      attendance: { where: { status: "PRESENT" }, select: { id: true } },
    },
  });

  const rows = services
    .filter((s) => s._count.attendance > 0)
    .map((s) => ({
      id: s.id, type: s.type, date: s.date.toISOString(),
      mode: s.mode, speaker: s.speaker,
      cell: s.cell.name, buscentre: s.cell.buscentre.name,
      presentCount: s.attendance.length,
      totalMarked:  s._count.attendance,
      rate: Math.round((s.attendance.length / s._count.attendance) * 100),
    }))
    .sort((a, b) => b.rate - a.rate || b.presentCount - a.presentCount)
    .slice(0, topN);

  const best  = rows[0] ?? null;
  return {
    dateRange: { from: start.toISOString(), to: end.toISOString() },
    topN, rows, best, totalServices: services.length,
    summary: `Top ${rows.length} of ${services.length} service${services.length !== 1 ? "s" : ""}${best ? ` · Best: ${best.rate}% on ${new Date(best.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}`,
  };
}

async function monthlySummary(
  scope: string | null, scopeId: string | null,
  from: string | null, to: string | null
) {
  const { start, end } = parseDates(from, to);
  const cellIds = await resolveCellIds(scope, scopeId);
  const cf = cellIds.length ? { cellId: { in: cellIds } } : {};

  const memberWhere = cellIds.length
    ? { OR: [{ cellId: { in: cellIds } }, { buscentreId: scopeId ?? undefined, cellId: null }] }
    : {};

  const [total, active, newM, services, ftTotal, ftConverted, souls] = await Promise.all([
    prisma.member.count({ where: memberWhere }),
    prisma.member.count({ where: { ...memberWhere, isActive: true } }),
    prisma.member.count({ where: { ...memberWhere, createdAt: { gte: start, lte: end } } }),
    prisma.service.findMany({
      where: { date: { gte: start, lte: end }, ...cf },
      select: { type: true, _count: { select: { attendance: true } }, attendance: { where: { status: "PRESENT" }, select: { id: true } } },
    }),
    prisma.firstTimer.count({ where: { service: { date: { gte: start, lte: end } }, ...cf } }),
    prisma.firstTimer.count({ where: { convertedAt: { gte: start, lte: end }, convertedToMemberId: { not: null }, ...cf } }),
    prisma.soul.count({ where: { date: { gte: start, lte: end }, ...cf } }),
  ]);

  function avgRate(type: string) {
    const svcs = services.filter((s) => s.type === type);
    if (!svcs.length) return { sessions: 0, avgPresent: 0, rate: 0 };
    const present = svcs.reduce((s, v) => s + v.attendance.length, 0);
    const total2  = svcs.reduce((s, v) => s + v._count.attendance, 0);
    return {
      sessions:   svcs.length,
      avgPresent: Math.round((present / svcs.length) * 10) / 10,
      rate:       total2 > 0 ? Math.round((present / total2) * 100) : 0,
    };
  }

  return {
    dateRange: { from: start.toISOString(), to: end.toISOString() },
    members:    { total, active, inactive: total - active, newInPeriod: newM },
    attendance: {
      lcLive:           avgRate("LC_LIVE"),
      mgs:              avgRate("MGS"),
      shepherdsMeeting: avgRate("SHEPHERDS_MEETING"),
      specialMeeting:   avgRate("SPECIAL_MEETING"),
    },
    growth: { firstTimers: ftTotal, converted: ftConverted, conversionRate: ftTotal > 0 ? Math.round((ftConverted / ftTotal) * 100) : 0, soulsWon: souls },
    summary: `${active} active members · ${newM} joined · ${ftTotal} first timers · ${souls} souls won`,
  };
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const sp          = new URL(request.url).searchParams;
  const type        = sp.get("type");
  const scope       = sp.get("scope");
  const scopeId     = sp.get("scopeId");
  const from        = sp.get("from");
  const to          = sp.get("to");
  const threshold   = parseInt(sp.get("threshold")  ?? "13");
  const cap         = parseInt(sp.get("cap")         ?? "5");
  const minAbsences = parseInt(sp.get("minAbsences") ?? "2");
  const topN        = parseInt(sp.get("topN")        ?? "10");

  let scopeName = "All";
  if (scopeId) {
    if (scope === "cell")      scopeName = (await prisma.cell.findUnique({ where: { id: scopeId }, select: { name: true } }))?.name ?? scopeId;
    if (scope === "buscentre") scopeName = (await prisma.buscentre.findUnique({ where: { id: scopeId }, select: { name: true } }))?.name ?? scopeId;
    if (scope === "mc")        scopeName = (await prisma.megaChurch.findUnique({ where: { id: scopeId }, select: { name: true } }))?.name ?? scopeId;
  }

  let data: unknown;
  switch (type) {
    case "cells-ready-to-divide":   data = await cellsReadyToDivide(scope, scopeId, threshold); break;
    case "consistent-absentees":    data = await consistentAbsentees(scope, scopeId, from, to, minAbsences, session.user.branchId ?? null); break;
    case "shepherd-load":           data = await shepherdLoad(scope, scopeId, cap); break;
    case "first-timer-conversion":  data = await firstTimerConversion(scope, scopeId, from, to); break;
    case "highest-attendance":      data = await highestAttendance(scope, scopeId, from, to, topN); break;
    case "monthly-summary":         data = await monthlySummary(scope, scopeId, from, to); break;
    default: return NextResponse.json({ error: `Unknown report type: ${type}` }, { status: 400 });
  }

  return NextResponse.json({ type, generatedAt: new Date().toISOString(), scope: { level: scope ?? "all", name: scopeName }, data });
}
