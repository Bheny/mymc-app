import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAttendanceScope } from "@/lib/attendance-scope";

// GET /api/services/recent?take=20 (+ actingBuscentreId)
// The services recorded across a buscentre, newest first, so a buscentre head can open one to
// check or correct it. (A cell shepherd already sees their own cell's services on the Attendance page.)
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const sp = new URL(request.url).searchParams;
  const scope = resolveAttendanceScope(session.user as never, sp);
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (scope.level !== "buscentre") return NextResponse.json({ error: "This list is for buscentre heads" }, { status: 403 });

  const take = Math.min(parseInt(sp.get("take") ?? "20") || 20, 60);
  const services = await prisma.service.findMany({
    where: { cell: scope.cellWhere },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take,
    select: {
      id: true, type: true, date: true, mode: true, cancelled: true,
      cell: { select: { id: true, name: true } },
      attendance: { select: { status: true } },
      _count: { select: { firstTimers: true } },
    },
  });

  return NextResponse.json(services.map((s) => ({
    id: s.id, type: s.type, date: s.date, mode: s.mode, cancelled: s.cancelled, cell: s.cell, firstTimers: s._count.firstTimers,
    stats: {
      total:   s.attendance.length,
      present: s.attendance.filter((a) => a.status === "PRESENT").length,
      absent:  s.attendance.filter((a) => a.status === "ABSENT").length,
      excused: s.attendance.filter((a) => a.status === "EXCUSED").length,
    },
  })));
}
