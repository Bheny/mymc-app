import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const stats = {
    total:   service.attendance.length,
    present: service.attendance.filter((a) => a.status === "PRESENT").length,
    absent:  service.attendance.filter((a) => a.status === "ABSENT").length,
    excused: service.attendance.filter((a) => a.status === "EXCUSED").length,
  };

  return NextResponse.json({ ...service, stats });
}

// ── PATCH — update a single member's attendance record ───────────────────────
export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { memberId, status, notes } = await request.json();

  const record = await prisma.attendance.upsert({
    where:  { serviceId_memberId: { serviceId: params.id, memberId } },
    update: { status, notes: notes ?? null, markedById: session.user.id, markedAt: new Date() },
    create: { serviceId: params.id, memberId, status, notes: notes ?? null, markedById: session.user.id },
  });

  return NextResponse.json(record);
}
