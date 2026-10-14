import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveRecordingCell } from "@/lib/recording-scope";
import { applyFirstTimers, isUniqueViolation, LinkError, prepareFirstTimers } from "@/lib/evangelism-attendance";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const sp           = new URL(request.url).searchParams;
  const status       = sp.get("status");       // "GREEN" | "YELLOW" | "RED" | "unreached" | null (all)
  const take         = parseInt(sp.get("take") ?? "50");
  const actingCellId      = sp.get("actingCellId")      ?? null;
  const actingBuscentreId = sp.get("actingBuscentreId") ?? null;

  // Resolve scope fresh from DB
  const freshRole = await prisma.userRole.findUnique({
    where:  { userId: session.user.id },
    select: { role: true, cellId: true, buscentreId: true, actingAt: true },
  });

  const actingAt  = (freshRole?.actingAt ?? {}) as Record<string, string>;
  let cellId      = freshRole?.cellId      ?? session.user.cellId      ?? null;
  let buscentreId = freshRole?.buscentreId ?? session.user.buscentreId ?? null;
  const userRole  = freshRole?.role        ?? session.user.role        ?? null;

  if (actingCellId && actingAt.cell_id === actingCellId)           cellId      = actingCellId;
  if (actingBuscentreId && actingAt.buscentre_id === actingBuscentreId) buscentreId = actingBuscentreId;

  // Build cell scope
  let cellFilter: object = {};
  if (userRole === "cell_shepherd" || userRole === "shepherd" || actingCellId) {
    if (!cellId) return NextResponse.json({ error: "No cell assigned" }, { status: 400 });
    cellFilter = { cellId };
  } else if (userRole === "buscentre_head" || actingBuscentreId) {
    if (!buscentreId) return NextResponse.json({ error: "No buscentre assigned" }, { status: 400 });
    cellFilter = { cell: { buscentreId } };
  }

  // Build status filter
  let statusFilter: object = {};
  if (status === "unreached") statusFilter = { reachOutStatus: null };
  else if (status)            statusFilter = { reachOutStatus: status };

  const firstTimers = await prisma.firstTimer.findMany({
    where:   { ...cellFilter, ...statusFilter },
    select: {
      id: true, firstName: true, lastName: true, phone: true,
      location: true, referredBy: true, broughtByMemberId: true, intent: true,
      reachOutStatus: true, reachOutNote: true, reachedOutAt: true,
      convertedToMemberId: true, convertedAt: true,
      createdAt: true,
      cell:    { select: { id: true, name: true } },
      service: { select: { date: true, type: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });

  // Summary counts
  const [total, green, yellow, red, unreached] = await Promise.all([
    prisma.firstTimer.count({ where: { ...cellFilter } }),
    prisma.firstTimer.count({ where: { ...cellFilter, reachOutStatus: "GREEN"  } }),
    prisma.firstTimer.count({ where: { ...cellFilter, reachOutStatus: "YELLOW" } }),
    prisma.firstTimer.count({ where: { ...cellFilter, reachOutStatus: "RED"    } }),
    prisma.firstTimer.count({ where: { ...cellFilter, reachOutStatus: null     } }),
  ]);

  return NextResponse.json({ firstTimers, summary: { total, green, yellow, red, unreached } });
}

// POST /api/first-timers — add a first timer to a service that has already been recorded
// (the "Add first timer" form on a service's page). Body: { serviceId, firstName, lastName,
// phone?, location?, referredBy?, intent?, contactId? }. The same people who can record for the
// cell can add to it, and the person is linked to (or given) an outreach contact like any other.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const b = await request.json().catch(() => null);
  if (!b?.serviceId || !String(b.firstName ?? "").trim() || !String(b.lastName ?? "").trim()) {
    return NextResponse.json({ error: "serviceId, firstName and lastName are required" }, { status: 400 });
  }

  const service = await prisma.service.findUnique({ where: { id: b.serviceId }, select: { id: true, cellId: true, type: true, date: true, cancelled: true } });
  if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 });
  if (service.cancelled) return NextResponse.json({ error: "This service was cancelled" }, { status: 409 });
  if (service.type === "SHEPHERDS_MEETING") return NextResponse.json({ error: "First timers aren't recorded for shepherds meetings" }, { status: 400 });

  const allowed = await resolveRecordingCell(session.user, service.cellId);
  if ("error" in allowed) return NextResponse.json({ error: "You can't add to this cell's attendance" }, { status: 403 });

  try {
    const prepared = await prepareFirstTimers(service.cellId, [{
      firstName: String(b.firstName), lastName: String(b.lastName), phone: b.phone ?? null, location: b.location ?? null,
      referredBy: b.referredBy ?? null, broughtByMemberId: b.broughtByMemberId ?? null,
      intent: b.intent ?? "UNDECIDED", contactId: b.contactId ?? null,
    }]);
    // Skipped (e.g. they have attended before): say why instead of pretending it worked
    if (prepared.plans.length === 0) {
      return NextResponse.json({ error: prepared.notices[0] ?? "They couldn't be added as a first timer" }, { status: 409 });
    }
    await prisma.$transaction((tx) => applyFirstTimers(tx, prepared, {
      serviceId: service.id, serviceType: service.type, serviceDate: service.date, userId: session.user.id, cellId: service.cellId,
    }));
    return NextResponse.json({ ok: true, notices: prepared.notices }, { status: 201 });
  } catch (e) {
    if (e instanceof LinkError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (isUniqueViolation(e)) return NextResponse.json({ error: "That person was just recorded by someone else — refresh and check." }, { status: 409 });
    throw e;
  }
}
