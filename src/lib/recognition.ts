import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Recognition — who is bearing the most fruit. Everything is computed from the records already
// kept (souls, first timers, encounters, attendance); nothing is stored per member except a
// frozen copy of each closed month (RecognitionSnapshot) so an award doesn't move when records
// are edited afterwards.
//
//   computeBoard()  →  every member's and group's counts for a date range (the expensive part)
//   rankBoard()     →  filters a board to what the viewer may see and ranks it (pure)
//   loadBoard()     →  the board for a period: a frozen snapshot for a closed month, live otherwise

import { METRICS, MIN_GROUP_SIZE, type Counts, type Metric, type Mode, type RankedRow, type Subject } from "@/lib/recognition-meta";

// A closed month is only frozen this many days after it ends, so late entries still land in it
export const SNAPSHOT_GRACE_DAYS = 7;

const zero = (): Counts => ({ souls: 0, firstTimers: 0, converted: 0, encounters: 0, attendance: 0 });
const add = (a: Counts, b: Counts) => { for (const m of METRICS) a[m] += b[m]; };
const isEmpty = (c: Counts) => METRICS.every((m) => c[m] === 0);

// ── The board ────────────────────────────────────────────────────────────────

export type MemberRow = {
  id: string; name: string;
  role: string;                 // a Role, or "none" for members without a login
  place: string;                // "Cell · Buscentre"
  cellId: string | null; buscentreId: string | null; mcId: string | null;
  counts: Counts;
};

export type GroupType = "cell" | "buscentre" | "mc";
export type GroupRow = {
  type: GroupType; id: string; name: string; place: string;
  buscentreId: string | null; mcId: string | null;
  headcount: number;            // active members
  counts: Counts;
};

export type Board = { members: MemberRow[]; groups: GroupRow[] };

type Range = { start: Date; end: Date }; // [start, end)

export async function computeBoard(branchId: string | null, { start, end }: Range): Promise<Board> {
  const inBranch = (path: "mc" | "buscentre" | "cell"): Prisma.MemberWhereInput => {
    if (!branchId) return {};
    return path === "mc" ? { mc: { branchId } }
         : path === "buscentre" ? { buscentre: { mc: { branchId } } }
         : { cell: { buscentre: { mc: { branchId } } } };
  };

  const [members, cells, buscentres, mcs] = await Promise.all([
    prisma.member.findMany({
      where: branchId ? { OR: [inBranch("mc"), inBranch("buscentre"), inBranch("cell")] } : {},
      select: {
        id: true, firstName: true, lastName: true, isActive: true,
        user: { select: { role: { select: { role: true } } } },
        cell:      { select: { id: true, name: true, buscentre: { select: { id: true, name: true, mcId: true, mc: { select: { name: true } } } } } },
        buscentre: { select: { id: true, name: true, mcId: true, mc: { select: { name: true } } } },
        mc:        { select: { id: true, name: true } },
      },
    }),
    prisma.cell.findMany({
      where: branchId ? { buscentre: { mc: { branchId } } } : {},
      select: { id: true, name: true, buscentreId: true, buscentre: { select: { name: true, mcId: true, mc: { select: { name: true } } } } },
    }),
    prisma.buscentre.findMany({
      where: branchId ? { mc: { branchId } } : {},
      select: { id: true, name: true, mcId: true, mc: { select: { name: true } } },
    }),
    prisma.megaChurch.findMany({ where: branchId ? { branchId } : {}, select: { id: true, name: true } }),
  ]);

  const dateIn = { gte: start, lt: end };
  const [souls, firstTimers, converted, encounters, attendance] = await Promise.all([
    prisma.soul.groupBy({ by: ["wonByMemberId"], where: { wonByMemberId: { not: null }, date: dateIn }, _count: { _all: true } }),
    prisma.firstTimer.groupBy({
      by: ["broughtByMemberId"],
      where: { broughtByMemberId: { not: null }, service: { date: dateIn, cancelled: false } },
      _count: { _all: true },
    }),
    prisma.firstTimer.groupBy({
      by: ["broughtByMemberId"],
      where: { broughtByMemberId: { not: null }, convertedAt: dateIn },
      _count: { _all: true },
    }),
    prisma.encounter.groupBy({ by: ["metByMemberId"], where: { metByMemberId: { not: null }, metAt: dateIn }, _count: { _all: true } }),
    prisma.attendance.groupBy({
      by: ["memberId"],
      where: { status: "PRESENT", service: { date: dateIn, cancelled: false, type: { not: "SHEPHERDS_MEETING" } } },
      _count: { _all: true },
    }),
  ]);

  const byMember = new Map<string, Counts>();
  const credit = (id: string | null, metric: Metric, n: number) => {
    if (!id) return;
    const c = byMember.get(id) ?? zero();
    c[metric] += n;
    byMember.set(id, c);
  };
  souls.forEach((r) => credit(r.wonByMemberId, "souls", r._count._all));
  firstTimers.forEach((r) => credit(r.broughtByMemberId, "firstTimers", r._count._all));
  converted.forEach((r) => credit(r.broughtByMemberId, "converted", r._count._all));
  encounters.forEach((r) => credit(r.metByMemberId, "encounters", r._count._all));
  attendance.forEach((r) => credit(r.memberId, "attendance", r._count._all));

  // Groups start empty so a group with no activity is still on the board
  const groups = new Map<string, GroupRow>();
  const key = (t: GroupType, id: string) => `${t}:${id}`;
  for (const c of cells) {
    groups.set(key("cell", c.id), { type: "cell", id: c.id, name: c.name, place: `${c.buscentre.name} · ${c.buscentre.mc.name}`,
      buscentreId: c.buscentreId, mcId: c.buscentre.mcId, headcount: 0, counts: zero() });
  }
  for (const b of buscentres) {
    groups.set(key("buscentre", b.id), { type: "buscentre", id: b.id, name: b.name, place: b.mc.name,
      buscentreId: null, mcId: b.mcId, headcount: 0, counts: zero() });
  }
  for (const m of mcs) {
    groups.set(key("mc", m.id), { type: "mc", id: m.id, name: m.name, place: "", buscentreId: null, mcId: null, headcount: 0, counts: zero() });
  }

  const rows: MemberRow[] = [];
  for (const m of members) {
    // Resolve the one level a member is placed at into the full chain above them
    const cell = m.cell, bus = cell?.buscentre ?? m.buscentre;
    const cellId = cell?.id ?? null, buscentreId = bus?.id ?? null, mcId = bus?.mcId ?? m.mc?.id ?? null;
    const counts = byMember.get(m.id) ?? zero();

    // Everyone's work counts toward their group — including a member who has since gone
    // inactive, since they did it while active. Only active members are headcount.
    for (const g of [cellId && groups.get(key("cell", cellId)), buscentreId && groups.get(key("buscentre", buscentreId)), mcId && groups.get(key("mc", mcId))]) {
      if (!g) continue;
      add(g.counts, counts);
      if (m.isActive) g.headcount += 1;
    }

    // Only active members with something to show are ranked as individuals
    if (!m.isActive || isEmpty(counts)) continue;
    rows.push({
      id: m.id, name: `${m.firstName} ${m.lastName}`,
      role: m.user?.role?.role ?? "none",
      place: cell ? `${cell.name} · ${cell.buscentre.name}` : bus ? bus.name : m.mc?.name ?? "",
      cellId, buscentreId, mcId, counts,
    });
  }

  return { members: rows, groups: Array.from(groups.values()) };
}

// ── Periods ──────────────────────────────────────────────────────────────────

export type Period = { key: string; label: string; kind: "month" | "quarter" | "year"; start: Date; end: Date };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// "2026-09" (a month) · "2026-Q3" (a quarter) · "2026" (a year). Boundaries are UTC.
export function parsePeriod(key: string | null | undefined, now = new Date()): Period | null {
  const k = key?.trim() || `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  let m: RegExpExecArray | null;
  if ((m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(k))) {
    const y = +m[1], mo = +m[2] - 1;
    return { key: k, label: `${MONTHS[mo]} ${y}`, kind: "month", start: new Date(Date.UTC(y, mo, 1)), end: new Date(Date.UTC(y, mo + 1, 1)) };
  }
  if ((m = /^(\d{4})-Q([1-4])$/.exec(k))) {
    const y = +m[1], q = +m[2] - 1;
    return { key: k, label: `Q${q + 1} ${y}`, kind: "quarter", start: new Date(Date.UTC(y, q * 3, 1)), end: new Date(Date.UTC(y, q * 3 + 3, 1)) };
  }
  if ((m = /^(\d{4})$/.exec(k))) {
    const y = +m[1];
    return { key: k, label: String(y), kind: "year", start: new Date(Date.UTC(y, 0, 1)), end: new Date(Date.UTC(y + 1, 0, 1)) };
  }
  return null;
}

const DAY = 86_400_000;
export const isFreezable = (p: Period, now = new Date()) => p.kind === "month" && now.getTime() >= p.end.getTime() + SNAPSHOT_GRACE_DAYS * DAY;

// ── Loading (snapshot or live) ───────────────────────────────────────────────

const scopeKey = (branchId: string | null) => branchId ?? "all";

export async function saveSnapshot(branchId: string | null, p: Period, board?: Board, overwrite = false): Promise<Board> {
  const data = board ?? await computeBoard(branchId, p);
  const payload = data as unknown as Prisma.InputJsonValue;
  try {
    if (overwrite) {
      await prisma.recognitionSnapshot.upsert({
        where:  { branchId_period: { branchId: scopeKey(branchId), period: p.key } },
        create: { branchId: scopeKey(branchId), period: p.key, data: payload },
        update: { data: payload, createdAt: new Date() },
      });
    } else {
      await prisma.recognitionSnapshot.create({ data: { branchId: scopeKey(branchId), period: p.key, data: payload } });
    }
  } catch (e) {
    // Two people opened the same closed month at once — the first snapshot wins
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
  }
  return data;
}

export type Loaded = { board: Board; frozen: boolean; generatedAt: string | null };

export async function loadBoard(branchId: string | null, p: Period, now = new Date()): Promise<Loaded> {
  if (p.kind === "month" && p.start.getTime() < now.getTime()) {
    const snap = await prisma.recognitionSnapshot.findUnique({ where: { branchId_period: { branchId: scopeKey(branchId), period: p.key } } });
    if (snap) return { board: snap.data as unknown as Board, frozen: true, generatedAt: snap.createdAt.toISOString() };
    if (isFreezable(p, now)) {
      const board = await saveSnapshot(branchId, p);
      return { board, frozen: true, generatedAt: new Date().toISOString() };
    }
  }
  return { board: await computeBoard(branchId, p), frozen: false, generatedAt: null };
}

// ── Viewing: scope, filter, rank ─────────────────────────────────────────────

export type Viewer = {
  role: Role;
  branchId: string | null; mcId: string | null; buscentreId: string | null; cellId: string | null;
};

// The signed-in user's scope, read fresh from the database. Only people with system access (a
// role) may see Recognition — members who don't log in never get this far.
export async function viewerFor(userId: string): Promise<Viewer | null> {
  const r = await prisma.userRole.findUnique({
    where:  { userId },
    select: { role: true, branchId: true, mcId: true, buscentreId: true, cellId: true },
  });
  return r ? { role: r.role, branchId: r.branchId, mcId: r.mcId, buscentreId: r.buscentreId, cellId: r.cellId } : null;
}

const memberVisible = (v: Viewer, m: MemberRow) => {
  switch (v.role) {
    case "cell_shepherd":
    case "shepherd":       return !!v.cellId && m.cellId === v.cellId;
    case "buscentre_head": return !!v.buscentreId && m.buscentreId === v.buscentreId;
    case "mc_pastor":      return !!v.mcId && m.mcId === v.mcId;
    default:               return true; // chief_shepherd / admin — the board is already this branch
  }
};

// Groups are compared with their peers: a cell sees the cells of its buscentre, a buscentre the
// buscentres of its MC, and every MC is compared across the branch. Leaders above see their whole
// area at the level they pick.
const groupVisible = (v: Viewer, g: GroupRow) => {
  if (v.role === "admin" || v.role === "chief_shepherd") return true;
  switch (g.type) {
    case "mc":        return true;
    case "buscentre": return !!v.mcId && g.mcId === v.mcId;
    case "cell":
      return v.role === "mc_pastor" ? !!v.mcId && g.mcId === v.mcId : !!v.buscentreId && g.buscentreId === v.buscentreId;
  }
};

export type Ranked = { rows: RankedRow[]; tooSmall: number };

export function rankBoard(
  board: Board,
  opts: { viewer: Viewer; metric: Metric; subject: Subject; mode: Mode; role?: string | null },
): Ranked {
  const { viewer, metric, subject, mode, role } = opts;
  let rows: Omit<RankedRow, "rank">[] = [];
  let tooSmall = 0;

  if (subject === "members") {
    rows = board.members
      .filter((m) => memberVisible(viewer, m) && (!role || m.role === role))
      .map((m) => ({ id: m.id, name: m.name, place: m.place, count: m.counts[metric], headcount: null, value: m.counts[metric], isYours: false }));
  } else {
    for (const g of board.groups) {
      if (g.type !== subject || !groupVisible(viewer, g)) continue;
      const count = g.counts[metric];
      if (mode === "perCapita") {
        if (g.headcount < MIN_GROUP_SIZE) { if (count > 0) tooSmall += 1; continue; }
      }
      rows.push({
        id: g.id, name: g.name, place: g.place, count, headcount: g.headcount,
        value: mode === "perCapita" ? count / g.headcount : count,
        isYours: g.id === (g.type === "cell" ? viewer.cellId : g.type === "buscentre" ? viewer.buscentreId : viewer.mcId),
      });
    }
  }

  // Nobody is celebrated for nothing; ties share a place (1, 2, 2, 4)
  const sorted = rows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value || b.count - a.count || a.name.localeCompare(b.name));
  let rank = 0;
  const ranked = sorted.map((r, i) => {
    if (i === 0 || r.value !== sorted[i - 1].value) rank = i + 1;
    return { ...r, rank };
  });
  return { rows: ranked, tooSmall };
}
