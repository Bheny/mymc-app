import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAttendanceScope } from "@/lib/attendance-scope";

const SERVICE_TYPES = ["LC_LIVE", "MGS"] as const;
const day = (d: Date) => d.toISOString().slice(0, 10);

// GET /api/attendance/missed?week=current|last  (+ the same acting* params as the overview)
// Everyone marked absent or excused at an LC Live or MGS service during the week, for the caller's
// scope — one row per person with the services they missed. A week runs Sunday to Saturday, the same
// week an MGS (Sun) and the LC Live (Wed) after it belong to.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const sp = new URL(request.url).searchParams;
  const scope = resolveAttendanceScope(session.user as never, sp);
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay() - (sp.get("week") === "last" ? 7 : 0));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);   // exclusive

  const rows = await prisma.attendance.findMany({
    where: {
      status: { in: ["ABSENT", "EXCUSED"] },
      member: { isActive: true },
      service: { cancelled: false, type: { in: [...SERVICE_TYPES] }, date: { gte: start, lt: end }, cell: scope.cellWhere },
    },
    select: {
      status: true,
      member: {
        select: {
          id: true, firstName: true, lastName: true, phone: true,
          shepherd: { select: { user: { select: { name: true } }, person: { select: { firstName: true, lastName: true } } } },
        },
      },
      service: { select: { type: true, date: true, cell: { select: { id: true, name: true, buscentre: { select: { name: true } } } } } },
    },
  });

  type Person = {
    id: string; name: string; phone: string | null; shepherd: string | null;
    cellId: string; cell: string; buscentre: string;
    missed: { type: string; date: string; status: string }[];
  };
  const people = new Map<string, Person>();
  for (const r of rows) {
    const m = r.member;
    const p = people.get(m.id) ?? {
      id: m.id, name: `${m.firstName} ${m.lastName}`, phone: m.phone,
      shepherd: m.shepherd?.user?.name ?? (m.shepherd?.person ? `${m.shepherd.person.firstName} ${m.shepherd.person.lastName}` : null),
      cellId: r.service.cell.id, cell: r.service.cell.name, buscentre: r.service.cell.buscentre.name,
      missed: [],
    };
    p.missed.push({ type: r.service.type, date: day(r.service.date), status: r.status });
    people.set(m.id, p);
  }

  const list = Array.from(people.values());
  list.forEach((p) => p.missed.sort((a, b) => a.date.localeCompare(b.date)));
  // Most missed first, then by cell and name, so the people who need a call most are on top
  list.sort((a, b) =>
    b.missed.length - a.missed.length || a.cell.localeCompare(b.cell) || a.name.localeCompare(b.name));

  const lastDay = new Date(end); lastDay.setUTCDate(lastDay.getUTCDate() - 1);
  return NextResponse.json({
    from: day(start), to: day(lastDay), today: day(today),
    people: list,
    totals: { people: list.length, absences: rows.length, absent: rows.filter((r) => r.status === "ABSENT").length },
  });
}
