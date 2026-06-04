import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AttendanceStatus } from "@prisma/client";

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

type FirstTimerInput = {
  firstName:  string;
  lastName:   string;
  phone?:     string | null;
  location?:  string | null;
  referredBy?: string | null;
  intent?:    "JUST_VISITING" | "UNDECIDED" | "WANTS_TO_JOIN";
};

// ── Shared helper — resolve cell ID, respecting acting-up override ────────────
function resolveCell(
  session: { user: { cellId?: string | null; actingAt?: Record<string, string> } },
  override: string | null
): string | { error: string } | null {
  if (!override) return session.user.cellId ?? null;
  const actingAt = (session.user.actingAt ?? {}) as Record<string, string>;
  if (actingAt.cell_id === override) return override;
  return { error: "No acting access to this cell" };
}

// ── GET — list services for the caller's cell ─────────────────────────────────
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const cellResult = resolveCell(session, searchParams.get("actingCellId"));
  if (cellResult && typeof cellResult === "object" && "error" in cellResult) {
    return NextResponse.json(cellResult, { status: 403 });
  }
  const cellId = cellResult as string | null;
  if (!cellId) return NextResponse.json({ error: "No cell assigned" }, { status: 400 });

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
  const { type, date, mode, notes, speaker, attendance, actingCellId, firstTimers = [] } = body;

  const cellResult = resolveCell(session, actingCellId ?? null);
  if (cellResult && typeof cellResult === "object" && "error" in cellResult) {
    return NextResponse.json(cellResult, { status: 403 });
  }
  const cellId = cellResult as string | null;
  if (!cellId) return NextResponse.json({ error: "No cell assigned" }, { status: 400 });

  if (!type || !date) {
    return NextResponse.json({ error: "type and date are required" }, { status: 400 });
  }
  if (!Array.isArray(attendance) || attendance.length === 0) {
    return NextResponse.json({ error: "attendance records are required" }, { status: 400 });
  }

  const validStatuses: AttendanceStatus[] = ["PRESENT", "ABSENT", "EXCUSED"];
  const invalid = attendance.find((a: { status: string }) => !validStatuses.includes(a.status as AttendanceStatus));
  if (invalid) {
    return NextResponse.json({ error: "Invalid status — must be PRESENT, ABSENT or EXCUSED" }, { status: 400 });
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
          cellId,
          createdById: session.user.id,
        },
      });

      await tx.attendance.createMany({
        data: attendance.map((a: { memberId: string; status: string; notes?: string }) => ({
          serviceId:  svc.id,
          memberId:   a.memberId,
          status:     a.status as AttendanceStatus,
          notes:      a.notes ?? null,
          markedById: session.user.id,
        })),
      });

      if (firstTimers.length > 0) {
        await tx.firstTimer.createMany({
          data: (firstTimers as FirstTimerInput[]).map((ft) => ({
            firstName:   ft.firstName.trim(),
            lastName:    ft.lastName.trim(),
            phone:       ft.phone?.trim() || null,
            location:    ft.location?.trim() || null,
            referredBy:  ft.referredBy?.trim() || null,
            intent:      ft.intent ?? "UNDECIDED",
            serviceId:   svc.id,
            cellId,
            recordedById: session.user.id,
          })),
        });
      }

      return svc;
    });

    // Fire absence notifications asynchronously — don't block the response
    fireAbsenceNotifications(
      service.id, cellId, type, date,
      attendance.filter((a: { status: string }) => a.status === "ABSENT").map((a: { memberId: string }) => a.memberId)
    ).catch(console.error);

    return NextResponse.json(service, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "Attendance for this service on this date has already been recorded." },
        { status: 409 }
      );
    }
    throw e;
  }
}
