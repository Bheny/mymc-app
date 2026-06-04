import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkCapacity, logCapacityWarning } from "@/lib/capacity";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const buscentreId = searchParams.get("buscentreId");

  const cells = await prisma.cell.findMany({
    where:   buscentreId ? { buscentreId } : {},
    include: { _count: { select: { shepherds: true, members: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(cells);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { buscentreId, name, location } = await request.json();
  if (!buscentreId || !name) {
    return NextResponse.json({ error: "buscentreId and name are required" }, { status: 400 });
  }

  const buscentre = await prisma.buscentre.findUnique({ where: { id: buscentreId } });
  if (!buscentre) return NextResponse.json({ error: "Buscentre not found" }, { status: 404 });

  const cap = await checkCapacity("cell", buscentreId);
  if (cap.atCapacity) {
    await logCapacityWarning({
      level: "cell", parentId: buscentreId, parentName: buscentre.name,
      count: cap.count, createdById: session.user.id,
    });
  }

  const cell = await prisma.cell.create({ data: { buscentreId, name, location: location ?? null } });
  return NextResponse.json(
    cap.atCapacity
      ? { ...cell, warning: `${buscentre.name} is at cell capacity (${cap.count}/${cap.max})` }
      : cell,
    { status: 201 }
  );
}
