import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { type ServiceType } from "@/lib/attendance-overview";

const LEADERBOARD_TYPES: ServiceType[] = ["MGS", "LC_LIVE", "SPECIAL_MEETING"];

type Params = { params: { cellId: string } };

function thresholdFor(type: ServiceType): number {
  return type === "SPECIAL_MEETING" ? 26 : 13;
}

export async function GET(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { cellId } = params;
  const { searchParams } = new URL(request.url);
  const serviceTypeParam = searchParams.get("serviceType") ?? "MGS";
  if (!LEADERBOARD_TYPES.includes(serviceTypeParam as ServiceType)) {
    return NextResponse.json({ error: "Invalid service type" }, { status: 400 });
  }
  const serviceType = serviceTypeParam as ServiceType;
  const threshold    = thresholdFor(serviceType);

  const cell = await prisma.cell.findUnique({
    where:  { id: cellId },
    select: {
      id: true, name: true,
      buscentre: { select: { id: true, name: true, mc: { select: { id: true, name: true } } } },
    },
  });
  if (!cell) return NextResponse.json({ error: "Cell not found" }, { status: 404 });

  const [service, members] = await Promise.all([
    prisma.service.findFirst({
      where:   { cellId, type: serviceType, cancelled: false },
      orderBy: { date: "desc" },
      select: {
        id: true, date: true, speaker: true, mode: true,
        attendance: { select: { memberId: true, status: true } },
      },
    }),
    prisma.member.findMany({
      where:   { cellId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select:  { id: true, firstName: true, lastName: true, phone: true, isActive: true },
    }),
  ]);

  const statusByMember = new Map(service?.attendance.map((a) => [a.memberId, a.status]) ?? []);
  const memberRows = members.map((m) => ({
    id:        m.id,
    name:      `${m.firstName} ${m.lastName}`,
    phone:     m.phone,
    isActive:  m.isActive,
    status:    statusByMember.get(m.id) ?? "NOT_MARKED",
  }));

  const present = memberRows.filter((m) => m.status === "PRESENT").length;

  return NextResponse.json({
    cell: {
      id:        cell.id,
      name:      cell.name,
      buscentre: cell.buscentre ? { id: cell.buscentre.id, name: cell.buscentre.name } : null,
      mc:        cell.buscentre?.mc ?? null,
    },
    serviceType,
    threshold,
    service: service ? { id: service.id, date: service.date, speaker: service.speaker, mode: service.mode } : null,
    present,
    total: memberRows.length,
    members: memberRows,
  });
}
