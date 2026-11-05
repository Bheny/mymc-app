import { prisma } from "@/lib/prisma";
import type { ServiceType } from "@prisma/client";

// Senior shepherds (bacenta-level members) and MC pastors (MC-level members) sit above the cells.
// They're counted through LeaderAttendance, never the cell's own attendance table.
//
//   MGS      → a leader is listed at their HOME cell
//   LC Live  → senior shepherds move: they're listed at whichever cell of their bacenta they VISIT.
//              MC pastors stay at their home cell.
//
// Counting: senior shepherds count at every level (cell, buscentre, MC); MC pastors only at MC level and above.

export const LEADER_SERVICE_TYPES: ServiceType[] = ["LC_LIVE", "MGS"];
export const isLeaderService = (t: string): t is "LC_LIVE" | "MGS" => t === "LC_LIVE" || t === "MGS";

export type LeaderKind = "senior_shepherd" | "mc_pastor";
export type LeaderOption = {
  id: string;
  name: string;
  kind: LeaderKind;
  /** home = on this cell's list as of right; visiting = a senior shepherd calling in on LC Live */
  mode: "home" | "visiting";
  homeCellName: string | null;
  /** Already counted at another cell for this service type and date — can't be counted again */
  takenBy: string | null;
};

const kindOf = (m: { mcId: string | null }): LeaderKind => (m.mcId ? "mc_pastor" : "senior_shepherd");

export async function leadersForCell(cellId: string, type: string, date: string, excludeServiceId?: string): Promise<LeaderOption[]> {
  if (!isLeaderService(type)) return [];
  const cell = await prisma.cell.findUnique({ where: { id: cellId }, select: { buscentreId: true } });
  if (!cell) return [];

  const select = {
    id: true, firstName: true, lastName: true, buscentreId: true, mcId: true,
    homeCell: { select: { id: true, name: true } },
  } as const;

  // Home leaders: whoever has this as their home cell. On LC Live senior shepherds are excluded, they roam.
  const homeAll = await prisma.member.findMany({
    where: { isActive: true, homeCellId: cellId, OR: [{ buscentreId: { not: null } }, { mcId: { not: null } }] },
    select, orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const home = type === "LC_LIVE" ? homeAll.filter((m) => m.mcId) : homeAll;

  // Visiting: the bacenta's senior shepherds, on LC Live only
  const visiting = type === "LC_LIVE"
    ? await prisma.member.findMany({
        where: { isActive: true, buscentreId: cell.buscentreId, mcId: null },
        select, orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      })
    : [];

  const all = [
    ...home.map((m) => ({ m, mode: "home" as const })),
    ...visiting.map((m) => ({ m, mode: "visiting" as const })),
  ];
  const ids = all.map((x) => x.m.id);
  const taken = ids.length === 0 ? [] : await prisma.leaderAttendance.findMany({
    where: {
      memberId: { in: ids }, serviceType: type as ServiceType, date: new Date(date),
      ...(excludeServiceId ? { NOT: { serviceId: excludeServiceId } } : {}),
    },
    select: { memberId: true, service: { select: { cell: { select: { name: true } } } } },
  });
  const takenBy = new Map(taken.map((t) => [t.memberId, t.service.cell.name]));

  return all.map(({ m, mode }) => ({
    id: m.id,
    name: `${m.firstName} ${m.lastName}`,
    kind: kindOf(m),
    mode,
    homeCellName: m.homeCell?.name ?? null,
    takenBy: takenBy.get(m.id) ?? null,
  }));
}

export type LeaderMark = { memberId: string; visiting?: boolean };

/** Checks the marks against who may be listed at this cell and returns rows ready to store */
export async function prepareLeaderRows(cellId: string, type: string, date: string, marks: LeaderMark[], excludeServiceId?: string) {
  const seen = new Set<string>();
  const clean = marks.filter((m) => m && typeof m.memberId === "string" && !seen.has(m.memberId) && seen.add(m.memberId));
  if (clean.length === 0) return { rows: [] as { memberId: string; visiting: boolean }[] };
  if (!isLeaderService(type)) return { error: "Leaders are only counted at LC Live and MGS" };

  const options = new Map((await leadersForCell(cellId, type, date, excludeServiceId)).map((o) => [o.id, o]));
  const rows: { memberId: string; visiting: boolean }[] = [];
  for (const m of clean) {
    const o = options.get(m.memberId);
    if (!o) return { error: "One of the leaders can't be counted at this cell for this service" };
    if (o.takenBy) return { error: `${o.name} is already counted at ${o.takenBy} for this service` };
    rows.push({ memberId: o.id, visiting: o.mode === "visiting" });
  }
  return { rows };
}
