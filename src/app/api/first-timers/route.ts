import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/first-timers?serviceId=xxx  — list first timers for a service
// GET /api/first-timers?cellId=xxx     — list for a cell
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const serviceId = searchParams.get("serviceId");
  const cellId    = searchParams.get("cellId") ?? session.user.cellId;

  if (!serviceId && !cellId) {
    return NextResponse.json({ error: "serviceId or cellId required" }, { status: 400 });
  }

  const where = serviceId ? { serviceId } : { cellId: cellId! };

  const firstTimers = await prisma.firstTimer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      convertedMember: { select: { id: true, firstName: true, lastName: true } },
      service: { select: { id: true, type: true, date: true } },
    },
  });

  return NextResponse.json(firstTimers);
}

// POST /api/first-timers — add a first timer to an existing service
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { serviceId, firstName, lastName, phone, location, referredBy, intent } = await request.json();

  if (!serviceId || !firstName?.trim() || !lastName?.trim()) {
    return NextResponse.json({ error: "serviceId, firstName and lastName are required" }, { status: 400 });
  }

  // Verify the service exists and belongs to a cell the caller has access to
  const service = await prisma.service.findUnique({
    where:  { id: serviceId },
    select: { cellId: true },
  });
  if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 });

  const ft = await prisma.firstTimer.create({
    data: {
      firstName:    firstName.trim(),
      lastName:     lastName.trim(),
      phone:        phone?.trim()      || null,
      location:     location?.trim()   || null,
      referredBy:   referredBy?.trim() || null,
      intent:       intent ?? "UNDECIDED",
      serviceId,
      cellId:       service.cellId,
      recordedById: session.user.id,
    },
    include: {
      convertedMember: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return NextResponse.json(ft, { status: 201 });
}
