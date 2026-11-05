import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAttendanceScope } from "@/lib/attendance-scope";
import type { AttendanceReportData, ReportCell } from "@/lib/attendance-report";

const day = (d: Date) => d.toISOString().slice(0, 10);

// GET /api/attendance/report?type=LC_LIVE|MGS&buscentreId=&date=YYYY-MM-DD  (+ acting* params)
// Everything the WhatsApp attendance report needs for one bacenta at one service: its head, each cell
// with its shepherd, and who was present (and whether they joined online). With no date, the most
// recent date that service was recorded.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const sp = new URL(request.url).searchParams;
  const type = sp.get("type");
  if (type !== "LC_LIVE" && type !== "MGS") return NextResponse.json({ error: "Choose LC Live or MGS" }, { status: 400 });

  const scope = resolveAttendanceScope(session.user as never, sp);
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  // A bacenta head's report is always their own bacenta; everyone else names one
  const wanted = scope.level === "buscentre" ? scope.scopeId : sp.get("buscentreId");
  const cells = await prisma.cell.findMany({
    where: wanted ? { AND: [scope.cellWhere, { buscentreId: wanted }] } : scope.cellWhere,
    orderBy: { name: "asc" },
    select: {
      id: true, name: true,
      buscentre: { select: { id: true, name: true } },
      userRoles: { where: { role: "cell_shepherd" }, select: { user: { select: { name: true, member: { select: { id: true } } } } } },
    },
  });
  if (cells.length === 0) return NextResponse.json({ error: "Choose a bacenta" }, { status: 400 });
  if (new Set(cells.map((c) => c.buscentre.id)).size > 1) return NextResponse.json({ error: "Choose a bacenta" }, { status: 400 });

  const bacenta = cells[0].buscentre;
  const cellIds = cells.map((c) => c.id);

  const recent = await prisma.service.findMany({
    where: { cellId: { in: cellIds }, type, cancelled: false },
    distinct: ["date"], orderBy: { date: "desc" }, take: 8, select: { date: true },
  });
  const dates = recent.map((r) => day(r.date));
  const wantedDate = sp.get("date");
  const date = wantedDate && /^\d{4}-\d{2}-\d{2}$/.test(wantedDate) ? wantedDate : dates[0] ?? null;

  const services = date ? await prisma.service.findMany({
    where: { cellId: { in: cellIds }, type, date: new Date(date) },
    select: {
      cellId: true, cancelled: true, mode: true,
      attendance: { where: { status: "PRESENT" }, select: { online: true, member: { select: { id: true, firstName: true, lastName: true } } } },
    },
  }) : [];
  const byCell = new Map(services.map((s) => [s.cellId, s]));

  const head = await prisma.userRole.findFirst({
    where: { role: "buscentre_head", buscentreId: bacenta.id },
    select: { user: { select: { name: true } } },
  });

  const reportCells: ReportCell[] = cells.map((c) => {
    const csUser = c.userRoles[0]?.user;
    const svc = byCell.get(c.id);
    const members = (svc?.attendance ?? [])
      .filter((a) => a.member.id !== csUser?.member?.id)          // the shepherd is the heading, not a line
      .map((a) => ({ name: `${a.member.firstName} ${a.member.lastName}`.trim(), online: a.online || svc?.mode === "ONLINE" }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { id: c.id, name: c.name, shepherd: csUser?.name ?? null, recorded: !!svc, cancelled: !!svc?.cancelled, members };
  });

  const data: AttendanceReportData = { bacenta, head: head?.user.name ?? null, type, date, dates, cells: reportCells };
  return NextResponse.json(data);
}
