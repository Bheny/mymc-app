import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  type Snapshot, type LevelRow,
  combine, snapshotFromAttendance, latestService, snapshotsForFilter, groupRows,
} from "@/lib/attendance-overview";

type ScopeLevel = "cell" | "buscentre" | "mc" | "branch" | "global";

function resolveActing(
  searchParams: URLSearchParams,
  actingAt: Record<string, string>,
  paramName: string,
  actingKey: string,
  fallback: string | null | undefined,
): { id: string | null; ok: boolean } {
  const acting = searchParams.get(paramName);
  if (!acting) return { id: fallback ?? null, ok: true };
  if (actingAt[actingKey] === acting) return { id: acting, ok: true };
  return { id: null, ok: false };
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const role = session.user.role;
  const { searchParams } = new URL(request.url);
  const actingAt = (session.user.actingAt ?? {}) as Record<string, string>;

  let level: ScopeLevel;
  let scopeId: string | null = null;
  let breakdownLabel: string;
  let cellWhere: Prisma.CellWhereInput;

  switch (role) {
    case "cell_shepherd":
    case "shepherd": {
      const r = resolveActing(searchParams, actingAt, "actingCellId", "cell_id", session.user.cellId);
      if (!r.ok) return NextResponse.json({ error: "No acting access to this cell" }, { status: 403 });
      if (!r.id) return NextResponse.json({ error: "No cell assigned" }, { status: 400 });
      level = "cell"; scopeId = r.id;
      cellWhere = { id: r.id };
      breakdownLabel = "By shepherd";
      break;
    }
    case "buscentre_head": {
      const r = resolveActing(searchParams, actingAt, "actingBuscentreId", "buscentre_id", session.user.buscentreId);
      if (!r.ok) return NextResponse.json({ error: "No acting access to this buscentre" }, { status: 403 });
      if (!r.id) return NextResponse.json({ error: "No buscentre assigned" }, { status: 400 });
      level = "buscentre"; scopeId = r.id;
      cellWhere = { buscentreId: r.id };
      breakdownLabel = "By cell";
      break;
    }
    case "mc_pastor": {
      const r = resolveActing(searchParams, actingAt, "actingMcId", "mc_id", session.user.mcId);
      if (!r.ok) return NextResponse.json({ error: "No acting access to this mega church" }, { status: 403 });
      if (!r.id) return NextResponse.json({ error: "No mega church assigned" }, { status: 400 });
      level = "mc"; scopeId = r.id;
      cellWhere = { buscentre: { mcId: r.id } };
      breakdownLabel = "By buscentre";
      break;
    }
    case "chief_shepherd": {
      const r = resolveActing(searchParams, actingAt, "actingBranchId", "branch_id", session.user.branchId);
      if (!r.ok) return NextResponse.json({ error: "No acting access to this branch" }, { status: 403 });
      if (!r.id) return NextResponse.json({ error: "No branch assigned" }, { status: 400 });
      level = "branch"; scopeId = r.id;
      cellWhere = { buscentre: { mc: { branchId: r.id } } };
      breakdownLabel = "By mega church";
      break;
    }
    case "admin": {
      level = "global"; scopeId = null;
      cellWhere = {};
      breakdownLabel = "By branch";
      break;
    }
    default:
      return NextResponse.json({ error: "Attendance overview is not available for this role" }, { status: 403 });
  }

  // ── Cell level: breakdown by shepherd within the single cell ────────────────
  if (level === "cell") {
    const cellId = scopeId!;
    const [cellInfo, shepherds, members, lcRaw, mgsRaw] = await Promise.all([
      prisma.cell.findUnique({ where: { id: cellId }, select: { name: true } }),
      prisma.shepherd.findMany({
        where:  { cellId },
        select: { id: true, person: { select: { firstName: true, lastName: true } }, user: { select: { name: true } } },
      }),
      prisma.member.findMany({ where: { cellId }, select: { id: true, shepherdId: true } }),
      latestService(cellId, "LC_LIVE"),
      latestService(cellId, "MGS"),
    ]);

    const shepherdNames = new Map(
      shepherds.map((sh) => [
        sh.id,
        sh.person ? `${sh.person.firstName} ${sh.person.lastName}` : (sh.user?.name ?? "Shepherd"),
      ]),
    );
    const memberToShepherd = new Map(members.map((m) => [m.id, m.shepherdId]));

    const groupByShepherd = (svc: { date: Date; attendance: { status: string; memberId: string }[] } | null) => {
      const out = new Map<string, Snapshot>();
      if (!svc) return out;
      const groups = new Map<string, { status: string }[]>();
      for (const a of svc.attendance) {
        const key = memberToShepherd.get(a.memberId) ?? "__unassigned__";
        const arr = groups.get(key) ?? [];
        arr.push(a);
        groups.set(key, arr);
      }
      Array.from(groups.entries()).forEach(([key, arr]) => out.set(key, snapshotFromAttendance(svc.date, arr)));
      return out;
    };

    const lcByShepherd  = groupByShepherd(lcRaw);
    const mgsByShepherd = groupByShepherd(mgsRaw);

    const shepherdIds = new Set<string>([
      ...Array.from(lcByShepherd.keys()),
      ...Array.from(mgsByShepherd.keys()),
      ...shepherds.map((s) => s.id),
    ]);
    const breakdown: LevelRow[] = Array.from(shepherdIds)
      .map((id) => ({
        id,
        name:   id === "__unassigned__" ? "Unassigned" : (shepherdNames.get(id) ?? "Shepherd"),
        lcLive: lcByShepherd.get(id) ?? null,
        mgs:    mgsByShepherd.get(id) ?? null,
      }))
      .sort((a, b) => {
        if (a.name === "Unassigned") return 1;
        if (b.name === "Unassigned") return -1;
        return a.name.localeCompare(b.name);
      });

    return NextResponse.json({
      scopeLevel:     level,
      scopeName:      cellInfo?.name ?? "Cell",
      breakdownLabel,
      lcLive: lcRaw  ? snapshotFromAttendance(lcRaw.date,  lcRaw.attendance,  lcRaw._count.firstTimers)  : null,
      mgs:    mgsRaw ? snapshotFromAttendance(mgsRaw.date, mgsRaw.attendance, mgsRaw._count.firstTimers) : null,
      breakdown,
    });
  }

  // ── Buscentre and above: breakdown by the next level down ───────────────────
  const cellSnaps = await snapshotsForFilter(cellWhere);

  let breakdown: LevelRow[];
  if (level === "buscentre") {
    breakdown = cellSnaps.map((s) => ({ id: s.id, name: s.name, lcLive: s.lcLive, mgs: s.mgs }));
  } else {
    const keyOf = level === "mc"
      ? (s: typeof cellSnaps[number]) => ({ id: s.buscentreId, name: s.buscentreName })
      : level === "branch"
      ? (s: typeof cellSnaps[number]) => ({ id: s.mcId, name: s.mcName })
      : (s: typeof cellSnaps[number]) => ({ id: s.branchId, name: s.branchName });
    breakdown = groupRows(cellSnaps, keyOf);
  }

  let scopeName: string;
  switch (level) {
    case "buscentre":
      scopeName = (await prisma.buscentre.findUnique({ where: { id: scopeId! }, select: { name: true } }))?.name ?? "Buscentre";
      break;
    case "mc":
      scopeName = (await prisma.megaChurch.findUnique({ where: { id: scopeId! }, select: { name: true } }))?.name ?? "Mega Church";
      break;
    case "branch":
      scopeName = (await prisma.branch.findUnique({ where: { id: scopeId! }, select: { name: true } }))?.name ?? "Branch";
      break;
    default:
      scopeName = "All branches";
  }

  return NextResponse.json({
    scopeLevel:     level,
    scopeName,
    breakdownLabel,
    lcLive: combine(breakdown.map((b) => b.lcLive)),
    mgs:    combine(breakdown.map((b) => b.mgs)),
    breakdown,
  });
}
