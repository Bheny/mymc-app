import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAttendanceScope } from "@/lib/attendance-scope";
import { getLaunchDate } from "@/lib/platform";

const SERVICE_TYPES = ["LC_LIVE", "MGS"] as const;
const day = (d: Date) => d.toISOString().slice(0, 10);

// GET /api/attendance/history?months=12  (+ the same acting* params as the overview)
// Everything the attendance dashboard draws from, for the caller's scope: the cells and
// shepherds, every LC Live / MGS service in the window with its present / absent / excused
// counts (also split by shepherd) and first timers, plus the dated outreach results. The page
// filters and aggregates in the browser, so changing a filter never needs another request.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const sp = new URL(request.url).searchParams;
  const scope = resolveAttendanceScope(session.user as never, sp);
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const months = Math.min(Math.max(parseInt(sp.get("months") ?? "12") || 12, 1), 36);
  const now = new Date();
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  // Nothing before the platform went live counts — not the numbers, and not the "missing services"
  const launch = new Date((await getLaunchDate()) + "T00:00:00Z");
  const sinceLaunch = launch > windowStart;
  const since = sinceLaunch ? launch : windowStart;

  const cells = await prisma.cell.findMany({
    where: scope.cellWhere,
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, createdAt: true, buscentreId: true,
      buscentre: { select: { name: true, mcId: true, mc: { select: { name: true } } } },
    },
  });
  const cellIds = cells.map((c) => c.id);

  const serviceWhere: Prisma.ServiceWhereInput = {
    cell: scope.cellWhere, type: { in: [...SERVICE_TYPES] }, date: { gte: since },
  };

  // Members present / absent / excused at each service, split by the shepherd they sit under.
  // A raw query because Prisma can't group by a related table's column.
  const perShepherd = cellIds.length === 0 ? Promise.resolve([] as ShepherdRow[]) : prisma.$queryRaw<ShepherdRow[]>(Prisma.sql`
    SELECT a.service_id AS "serviceId", m.shepherd_id AS "shepherdId", a.status::text AS "status", COUNT(*)::int AS "n"
    FROM attendance a
    JOIN members  m ON m.id = a.member_id
    JOIN services s ON s.id = a.service_id
    WHERE s.cancelled = false
      AND s.type::text IN (${Prisma.join([...SERVICE_TYPES])})
      AND s.date >= ${since}
      AND s.cell_id IN (${Prisma.join(cellIds)})
    GROUP BY a.service_id, m.shepherd_id, a.status`);

  const [services, rows, shepherds, firstTimers, joined, souls, scopeName] = await Promise.all([
    prisma.service.findMany({
      where: serviceWhere,
      select: { id: true, cellId: true, type: true, date: true, mode: true, cancelled: true },
    }),
    perShepherd,
    prisma.shepherd.findMany({
      where: { cell: scope.cellWhere },
      select: { id: true, cellId: true, user: { select: { name: true } }, person: { select: { firstName: true, lastName: true } } },
    }),
    prisma.firstTimer.groupBy({
      by: ["serviceId"],
      where: { service: { ...serviceWhere, cancelled: false } },
      _count: { _all: true },
    }),
    // First timers who have since become members, by the day it happened
    prisma.firstTimer.findMany({
      where: { cell: scope.cellWhere, convertedAt: { gte: since } },
      select: { cellId: true, convertedAt: true },
    }),
    // Souls won: the cell soul tracker plus anyone who received Christ in an outreach
    prisma.soul.findMany({
      where: { cell: scope.cellWhere, date: { gte: since } },
      select: { cellId: true, date: true },
    }),
    scopeNameFor(scope.level, scope.scopeId),
  ]);

  // Outreach decisions live in the evangelism tables, which may not exist yet — never fail the page over them
  let decisions: { cellId: string; date: string }[] = [];
  try {
    const enc = await prisma.encounter.findMany({
      where: {
        response: "RECEIVED_CHRIST", metAt: { gte: since },
        contact: { cellId: { in: cellIds } },
        // Souls copied across from the soul tracker are already counted above
        OR: [{ clientRef: null }, { NOT: { clientRef: { startsWith: "backfill:soul:" } } }],
      },
      select: { metAt: true, contact: { select: { cellId: true } } },
    });
    decisions = enc.filter((e) => e.contact.cellId).map((e) => ({ cellId: e.contact.cellId!, date: day(e.metAt) }));
  } catch { /* evangelism tables not migrated yet */ }

  // Who has been followed up. A first timer counts if someone marked them reached out (the first
  // timers page) or logged a call, visit, message or invite on their evangelism contact.
  const FOLLOW_UP = ["CALL", "WHATSAPP", "VISIT", "INVITED"] as const;
  const firstTimerList = await prisma.firstTimer.findMany({
    where: { cell: scope.cellWhere, service: { ...serviceWhere, cancelled: false } },
    select: { cellId: true, reachedOutAt: true, convertedAt: true, contactId: true, service: { select: { date: true, type: true } } },
  });
  const touched = new Set<string>();
  const linkedIds = firstTimerList.map((f) => f.contactId).filter((x): x is string => !!x);
  if (linkedIds.length) {
    try {
      const acts = await prisma.contactActivity.groupBy({ by: ["contactId"], where: { contactId: { in: linkedIds }, type: { in: [...FOLLOW_UP] } } });
      acts.forEach((a) => touched.add(a.contactId));
    } catch { /* evangelism tables not migrated yet */ }
  }

  // Returning guests (not yet members) in the room at each service
  const guests = new Map<string, number>();
  try {
    const g = await prisma.guestVisit.groupBy({
      by: ["serviceId"], where: { service: { ...serviceWhere, cancelled: false } }, _count: { _all: true },
    });
    g.forEach((x) => guests.set(x.serviceId, x._count._all));
  } catch { /* guest visits not set up yet */ }

  // Fold the counts onto their services: totals, and the same split per shepherd
  type Counts = { present: number; absent: number; excused: number; sh: Map<string, { s: string | null; p: number; t: number }> };
  const byService = new Map<string, Counts>();
  for (const r of rows) {
    const c = byService.get(r.serviceId) ?? { present: 0, absent: 0, excused: 0, sh: new Map() };
    if (r.status === "PRESENT") c.present += r.n; else if (r.status === "ABSENT") c.absent += r.n; else c.excused += r.n;
    const key = r.shepherdId ?? "none";
    const e = c.sh.get(key) ?? { s: r.shepherdId, p: 0, t: 0 };
    e.t += r.n; if (r.status === "PRESENT") e.p += r.n;
    c.sh.set(key, e); byService.set(r.serviceId, c);
  }
  const ft = new Map(firstTimers.map((f) => [f.serviceId, f._count._all]));

  return NextResponse.json({
    scopeLevel: scope.level,
    scopeName,
    since: day(since),
    sinceLaunch,
    today: day(now),
    cells: cells.map((c) => ({
      id: c.id, name: c.name, createdAt: day(c.createdAt),
      buscentreId: c.buscentreId, buscentre: c.buscentre.name, mcId: c.buscentre.mcId, mc: c.buscentre.mc.name,
    })),
    shepherds: shepherds.map((s) => ({
      id: s.id, cellId: s.cellId,
      name: s.user?.name ?? (s.person ? `${s.person.firstName} ${s.person.lastName}` : "Unfilled slot"),
    })),
    services: services.map((s) => {
      const c = byService.get(s.id);
      return {
        cellId: s.cellId, type: s.type, date: day(s.date), online: s.mode === "ONLINE", cancelled: s.cancelled,
        present: c?.present ?? 0, absent: c?.absent ?? 0, excused: c?.excused ?? 0,
        firstTimers: ft.get(s.id) ?? 0,
        guests: guests.get(s.id) ?? 0,
        sh: c ? Array.from(c.sh.values()) : [],
      };
    }),
    joined: joined.filter((j) => j.convertedAt).map((j) => ({ cellId: j.cellId, date: day(j.convertedAt!) })),
    souls: [
      ...souls.map((s) => ({ cellId: s.cellId, date: day(s.date), src: "tracker" as const })),
      ...decisions.map((d) => ({ ...d, src: "outreach" as const })),
    ],
    firstTimerRows: firstTimerList.map((f) => ({
      cellId: f.cellId, date: day(f.service.date), type: f.service.type,
      followedUp: !!f.reachedOutAt || (!!f.contactId && touched.has(f.contactId)), joined: !!f.convertedAt,
    })),

  });
}

type ShepherdRow = { serviceId: string; shepherdId: string | null; status: string; n: number };

async function scopeNameFor(level: string, id: string | null): Promise<string> {
  if (!id) return "All branches";
  switch (level) {
    case "cell":      return (await prisma.cell.findUnique({ where: { id }, select: { name: true } }))?.name ?? "Cell";
    case "buscentre": return (await prisma.buscentre.findUnique({ where: { id }, select: { name: true } }))?.name ?? "Buscentre";
    case "mc":        return (await prisma.megaChurch.findUnique({ where: { id }, select: { name: true } }))?.name ?? "Mega Church";
    default:          return (await prisma.branch.findUnique({ where: { id }, select: { name: true } }))?.name ?? "Branch";
  }
}
