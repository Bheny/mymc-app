import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveRecordingCell } from "@/lib/recording-scope";
import { prepareLeaderRows, type LeaderMark } from "@/lib/leader-attendance";

type Params = { params: { id: string } };

// PUT — replace which leaders were counted at an already-recorded service
export async function PUT(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const service = await prisma.service.findUnique({ where: { id: params.id }, select: { cellId: true, type: true, date: true, cancelled: true } });
  if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const allowed = await resolveRecordingCell(session.user, service.cellId);
  if ("error" in allowed) return NextResponse.json({ error: "You can't change attendance for this cell" }, { status: 403 });
  if (service.cancelled) return NextResponse.json({ error: "This service was cancelled" }, { status: 409 });

  const body = await request.json().catch(() => ({}));
  const marks: LeaderMark[] = Array.isArray(body.leaders) ? body.leaders : [];
  const date = service.date.toISOString().slice(0, 10);
  const prepared = await prepareLeaderRows(service.cellId, service.type, date, marks, params.id);
  if ("error" in prepared) return NextResponse.json({ error: prepared.error }, { status: 409 });

  try {
    await prisma.$transaction([
      prisma.leaderAttendance.deleteMany({ where: { serviceId: params.id } }),
      prisma.leaderAttendance.createMany({
        data: prepared.rows.map((r) => ({
          serviceId: params.id, memberId: r.memberId, visiting: r.visiting,
          serviceType: service.type, date: service.date, markedById: session.user.id,
        })),
      }),
    ]);
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "A leader was just counted at another cell — refresh and try again." }, { status: 409 });
    }
    throw e;
  }
  return NextResponse.json({ ok: true, count: prepared.rows.length });
}
