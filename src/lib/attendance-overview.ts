import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ServiceType = "LC_LIVE" | "MGS" | "SHEPHERDS_MEETING" | "SPECIAL_MEETING";

export type Snapshot = {
  date:        string;
  present:     number;
  absent:      number;
  excused:     number;
  total:       number;
  rate:        number;
  firstTimers: number;
} | null;

export function calcRate(present: number, total: number): number {
  return total > 0 ? Math.round((present / total) * 100) : 0;
}

export function snapshotFromAttendance(
  date: Date,
  attendance: { status: string }[],
  firstTimers = 0,
): Snapshot {
  const present = attendance.filter((a) => a.status === "PRESENT").length;
  const absent  = attendance.filter((a) => a.status === "ABSENT").length;
  const excused = attendance.filter((a) => a.status === "EXCUSED").length;
  const total   = attendance.length;
  return { date: date.toISOString(), present, absent, excused, total, rate: calcRate(present, total), firstTimers };
}

export function combine(snapshots: Snapshot[]): Snapshot {
  const valid = snapshots.filter((s): s is NonNullable<Snapshot> => s !== null);
  if (valid.length === 0) return null;
  const present     = valid.reduce((sum, s) => sum + s.present, 0);
  const absent      = valid.reduce((sum, s) => sum + s.absent, 0);
  const excused     = valid.reduce((sum, s) => sum + s.excused, 0);
  const total       = valid.reduce((sum, s) => sum + s.total, 0);
  const firstTimers = valid.reduce((sum, s) => sum + s.firstTimers, 0);
  const date        = valid.reduce((latest, s) => (s.date > latest ? s.date : latest), valid[0].date);
  return { date, present, absent, excused, total, rate: calcRate(present, total), firstTimers };
}

export async function latestService(cellId: string, type: ServiceType) {
  return prisma.service.findFirst({
    where:   { cellId, type, cancelled: false },
    orderBy: { date: "desc" },
    select: {
      date:       true,
      attendance: { select: { status: true, memberId: true } },
      _count:     { select: { firstTimers: true } },
    },
  });
}

// Latest two occurrences of a service type for a cell — used to compare the
// most recent service against the one before it (e.g. for trend indicators).
export async function recentServices(cellId: string, type: ServiceType) {
  return prisma.service.findMany({
    where:   { cellId, type, cancelled: false },
    orderBy: { date: "desc" },
    take:    2,
    select: {
      id:         true,
      date:       true,
      speaker:    true,
      attendance: { select: { status: true, memberId: true } },
      _count:     { select: { firstTimers: true } },
    },
  });
}

export async function cellSnapshot(cellId: string): Promise<{ lcLive: Snapshot; mgs: Snapshot }> {
  const [lc, mgs] = await Promise.all([latestService(cellId, "LC_LIVE"), latestService(cellId, "MGS")]);
  return {
    lcLive: lc  ? snapshotFromAttendance(lc.date,  lc.attendance,  lc._count.firstTimers)  : null,
    mgs:    mgs ? snapshotFromAttendance(mgs.date, mgs.attendance, mgs._count.firstTimers) : null,
  };
}

export type CellRef = {
  id: string; name: string;
  buscentreId: string; buscentreName: string;
  mcId: string; mcName: string;
  branchId: string; branchName: string;
};

export async function cellsForFilter(where: Prisma.CellWhereInput): Promise<CellRef[]> {
  const cells = await prisma.cell.findMany({
    where,
    select: {
      id: true, name: true, buscentreId: true,
      buscentre: {
        select: {
          name: true, mcId: true,
          mc: { select: { name: true, branchId: true, branch: { select: { name: true } } } },
        },
      },
    },
  });
  return cells.map((c) => ({
    id: c.id, name: c.name,
    buscentreId: c.buscentreId, buscentreName: c.buscentre.name,
    mcId: c.buscentre.mcId, mcName: c.buscentre.mc.name,
    branchId: c.buscentre.mc.branchId, branchName: c.buscentre.mc.branch.name,
  }));
}

export type CellSnap = CellRef & { lcLive: Snapshot; mgs: Snapshot };

export async function snapshotsForFilter(where: Prisma.CellWhereInput): Promise<CellSnap[]> {
  const cells = await cellsForFilter(where);
  return Promise.all(cells.map(async (c) => ({ ...c, ...(await cellSnapshot(c.id)) })));
}

export type LevelRow = { id: string; name: string; lcLive: Snapshot; mgs: Snapshot };

// Groups cell snapshots by an arbitrary key (e.g. mcId, buscentreId), combining
// their latest-service counts into one row per group.
export function groupRows(
  snaps: CellSnap[],
  keyOf: (s: CellSnap) => { id: string; name: string },
): LevelRow[] {
  const groups = new Map<string, { name: string; lcLive: Snapshot[]; mgs: Snapshot[] }>();
  for (const s of snaps) {
    const k = keyOf(s);
    const entry = groups.get(k.id) ?? { name: k.name, lcLive: [], mgs: [] };
    entry.lcLive.push(s.lcLive);
    entry.mgs.push(s.mgs);
    groups.set(k.id, entry);
  }
  return Array.from(groups.entries()).map(([id, g]) => ({
    id, name: g.name, lcLive: combine(g.lcLive), mgs: combine(g.mgs),
  }));
}
