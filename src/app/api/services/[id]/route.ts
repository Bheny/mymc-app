import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveRecordingCell } from "@/lib/recording-scope";

type Params = { params: { id: string } };

// ── GET — service with full attendance ────────────────────────────────────────
export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const service = await prisma.service.findUnique({
    where: { id: params.id },
    include: {
      attendance: {
        include: {
          member: {
            select: {
              id: true, firstName: true, lastName: true, gender: true, isActive: true,
              shepherd: {
                select: {
                  id: true,
                  user:   { select: { name: true } },
                  person: { select: { firstName: true, lastName: true } },
                },
              },
            },
          },
        },
        orderBy: { member: { lastName: "asc" } },
      },
      firstTimers: {
        orderBy: { createdAt: "asc" },
        include: {
          convertedMember: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Active members of the cell who have no mark for this service — typically someone added after it
  // was recorded. (Not for shepherds meetings, which are marked from the shepherd slots instead.)
  const shepherdSelect = {
    select: { id: true, user: { select: { name: true } }, person: { select: { firstName: true, lastName: true } } },
  } as const;
  const unmarked = service.type === "SHEPHERDS_MEETING" || service.cancelled ? [] : await prisma.member.findMany({
    where: { cellId: service.cellId, isActive: true, id: { notIn: service.attendance.map((a) => a.memberId) } },
    select: { id: true, firstName: true, lastName: true, gender: true, isActive: true, joinedDate: true, shepherd: shepherdSelect },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const missing = unmarked.map((m) => ({
    ...m,
    joinedDate: m.joinedDate ? m.joinedDate.toISOString().slice(0, 10) : null,
    // Joined after the service happened — they may not have been expected there, so say so
    joinedAfter: !!m.joinedDate && m.joinedDate > service.date,
  }));

  const stats = {
    total:   service.attendance.length,
    present: service.attendance.filter((a) => a.status === "PRESENT").length,
    absent:  service.attendance.filter((a) => a.status === "ABSENT").length,
    excused: service.attendance.filter((a) => a.status === "EXCUSED").length,
  };

  return NextResponse.json({ ...service, stats, missing });
}

// ── PATCH — update a single member's attendance record ───────────────────────
export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { memberId, status, notes } = await request.json();
  if (!memberId || !["PRESENT", "ABSENT", "EXCUSED"].includes(status)) {
    return NextResponse.json({ error: "memberId and a status of PRESENT, ABSENT or EXCUSED are required" }, { status: 400 });
  }

  // The same people who can record for this cell can correct it
  const service = await prisma.service.findUnique({ where: { id: params.id }, select: { cellId: true, cancelled: true, type: true } });
  if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const allowed = await resolveRecordingCell(session.user, service.cellId);
  if ("error" in allowed) return NextResponse.json({ error: "You can't change attendance for this cell" }, { status: 403 });
  if (service.cancelled) return NextResponse.json({ error: "This service was cancelled, so it has no attendance to change" }, { status: 409 });

  // Marking someone who has no row yet (added after the service) — they must belong to this cell
  const already = await prisma.attendance.findUnique({ where: { serviceId_memberId: { serviceId: params.id, memberId } }, select: { id: true } });
  if (!already && service.type !== "SHEPHERDS_MEETING") {
    const member = await prisma.member.findFirst({ where: { id: memberId, cellId: service.cellId }, select: { id: true } });
    if (!member) return NextResponse.json({ error: "That person isn't a member of this cell" }, { status: 400 });
  }

  const record = await prisma.attendance.upsert({
    where:  { serviceId_memberId: { serviceId: params.id, memberId } },
    update: { status, notes: notes ?? null, markedById: session.user.id, markedAt: new Date() },
    create: { serviceId: params.id, memberId, status, notes: notes ?? null, markedById: session.user.id },
  });

  return NextResponse.json(record);
}
