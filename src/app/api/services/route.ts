import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AttendanceStatus } from "@prisma/client";
import { resolveRecordingCell } from "@/lib/recording-scope";
import { applyFirstTimers, applyGuestVisits, isUniqueViolation, LinkError, prepareFirstTimers, prepareGuestVisits, type FirstTimerDraft, type GuestPrepared } from "@/lib/evangelism-attendance";

// ── Absence notification helper ──────────────────────────────────────────────
// Runs after the transaction; never throws (caller catches).
async function fireAbsenceNotifications(
  serviceId: string,
  cellId: string,
  serviceType: string,
  serviceDate: string,
  absentMemberIds: string[]
) {
  if (absentMemberIds.length === 0) return;

  const SERVICE_LABEL: Record<string, string> = {
    LC_LIVE: "LC Live", MGS: "MGS",
    SHEPHERDS_MEETING: "Shepherds Meeting", SPECIAL_MEETING: "Special Meeting",
  };
  const label    = SERVICE_LABEL[serviceType] ?? serviceType;
  const dateStr  = new Date(serviceDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const linkHref = "/members";

  // Find absent members with their names
  const absentMembers = await prisma.member.findMany({
    where:  { id: { in: absentMemberIds } },
    select: { id: true, firstName: true, lastName: true },
  });

  // Find the cell shepherd user for this cell
  const cellShepherdRole = await prisma.userRole.findFirst({
    where:  { role: "cell_shepherd", cellId },
    select: { userId: true },
  });

  // Find the buscentre head user for this cell's buscentre
  const cell = await prisma.cell.findUnique({
    where:  { id: cellId },
    select: { buscentreId: true },
  });

  const buscentreHeadRole = cell?.buscentreId
    ? await prisma.userRole.findFirst({
        where:  { role: "buscentre_head", buscentreId: cell.buscentreId },
        select: { userId: true },
      })
    : null;

  const recipientIds = Array.from(new Set(
    [cellShepherdRole?.userId, buscentreHeadRole?.userId].filter(Boolean) as string[]
  ));

  if (recipientIds.length === 0) return;

  // One notification per recipient that lists all absent members
  const memberList = absentMembers
    .map((m) => `${m.firstName} ${m.lastName}`)
    .join(", ");

  await prisma.notification.createMany({
    data: recipientIds.map((userId) => ({
      userId,
      type:     "absent_member",
      title:    `${absentMembers.length} absent — ${label} ${dateStr}`,
      body:     memberList,
      linkHref,
    })),
    skipDuplicates: true,
  });
}

// ── GET — list services for the caller's cell ─────────────────────────────────
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const cellResult = await resolveRecordingCell(session.user, searchParams.get("actingCellId"));
  if ("error" in cellResult) return NextResponse.json({ error: cellResult.error }, { status: cellResult.status });
  const cellId = cellResult.cellId;

  const take = parseInt(searchParams.get("take") ?? "20");

  const services = await prisma.service.findMany({
    where:   { cellId },
    orderBy: { date: "desc" },
    take,
    include: {
      _count:     { select: { attendance: true } },
      attendance: { select: { status: true } },
    },
  });

  return NextResponse.json(services.map((s) => ({
    id:        s.id,
    type:      s.type,
    date:      s.date,
    mode:      s.mode,
    notes:     s.notes,
    createdAt: s.createdAt,
    stats: {
      total:   s.attendance.length,
      present: s.attendance.filter((a) => a.status === "PRESENT").length,
      absent:  s.attendance.filter((a) => a.status === "ABSENT").length,
      excused: s.attendance.filter((a) => a.status === "EXCUSED").length,
    },
  })));
}

// ── POST — create service + submit all attendance in one transaction ───────────
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await request.json();
  const { type, date, mode, notes, speaker, cancelled = false, attendance, actingCellId, firstTimers = [], guestVisits = [] } = body;

  const cellResult = await resolveRecordingCell(session.user, actingCellId ?? null);
  if ("error" in cellResult) return NextResponse.json({ error: cellResult.error }, { status: cellResult.status });
  const cellId = cellResult.cellId;

  if (!type || !date) {
    return NextResponse.json({ error: "type and date are required" }, { status: 400 });
  }

  // Cancelled services have no attendance — skip those validations
  if (!cancelled) {
    if (!Array.isArray(attendance) || attendance.length === 0) {
      return NextResponse.json({ error: "attendance records are required" }, { status: 400 });
    }
    const validStatuses: AttendanceStatus[] = ["PRESENT", "ABSENT", "EXCUSED"];
    const invalid = attendance.find((a: { status: string }) => !validStatuses.includes(a.status as AttendanceStatus));
    if (invalid) {
      return NextResponse.json({ error: "Invalid status — must be PRESENT, ABSENT or EXCUSED" }, { status: 400 });
    }
  }

  // Resolve first timers against evangelism contacts before opening the transaction
  let prepared: Awaited<ReturnType<typeof prepareFirstTimers>> | null = null;
  if (!cancelled && firstTimers.length > 0) {
    try {
      prepared = await prepareFirstTimers(cellId, firstTimers as FirstTimerDraft[]);
    } catch (e) {
      if (e instanceof LinkError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  }

  // Guests who aren't members yet coming back — recorded so we can see who has come 3+ times in a month
  let guests: GuestPrepared | null = null;
  if (!cancelled && Array.isArray(guestVisits) && guestVisits.length > 0) {
    try {
      const firstTimeToday = new Set<string>((prepared?.plans ?? []).map((p) => p.contactId).filter((x): x is string => !!x));
      guests = await prepareGuestVisits(cellId, guestVisits as string[], firstTimeToday);
    } catch (e) {
      if (e instanceof LinkError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  }

  try {
    const service = await prisma.$transaction(async (tx) => {
      const svc = await tx.service.create({
        data: {
          type,
          date:        new Date(date),
          mode:        mode ?? "IN_PERSON",
          notes:       notes ?? null,
          speaker:     speaker ?? null,
          cancelled:   Boolean(cancelled),
          cellId,
          createdById: session.user.id,
        },
      });

      if (!cancelled && attendance?.length) {
        await tx.attendance.createMany({
          data: attendance.map((a: { memberId: string; status: string; notes?: string }) => ({
            serviceId:  svc.id,
            memberId:   a.memberId,
            status:     a.status as AttendanceStatus,
            notes:      a.notes ?? null,
            markedById: session.user.id,
          })),
        });
      }

      if (prepared) {
        await applyFirstTimers(tx, prepared, {
          serviceId: svc.id, serviceType: type, serviceDate: svc.date, userId: session.user.id, cellId,
        });
      }

      if (guests) await applyGuestVisits(tx, guests, { serviceId: svc.id, userId: session.user.id, cellId });

      return svc;
    });

    // Fire absence notifications only for real services (not cancellations)
    if (!cancelled) fireAbsenceNotifications(
      service.id, cellId, type, date,
      attendance.filter((a: { status: string }) => a.status === "ABSENT").map((a: { memberId: string }) => a.memberId)
    ).catch(console.error);

    return NextResponse.json({ ...service, notices: [...(prepared?.notices ?? []), ...(guests?.notices ?? [])] }, { status: 201 });
  } catch (e: unknown) {
    // A first timer's contact / phone colliding with a concurrent save
    if (isUniqueViolation(e) && /contact|phone/.test(String((e as { meta?: { target?: unknown } }).meta?.target ?? ""))) {
      return NextResponse.json(
        { error: "One of the first timers was just recorded by someone else — refresh and try again." },
        { status: 409 }
      );
    }
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "Attendance for this service on this date has already been recorded." },
        { status: 409 }
      );
    }
    throw e;
  }
}
