import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkCapacity, logCapacityWarning } from "@/lib/capacity";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const mcId = searchParams.get("mcId");

  const buscentres = await prisma.buscentre.findMany({
    where:   mcId ? { mcId } : {},
    include: { _count: { select: { cells: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(buscentres);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { mcId, name, location } = await request.json();
  if (!mcId || !name) {
    return NextResponse.json({ error: "mcId and name are required" }, { status: 400 });
  }

  const mc = await prisma.megaChurch.findUnique({ where: { id: mcId } });
  if (!mc) return NextResponse.json({ error: "MegaChurch not found" }, { status: 404 });

  const cap = await checkCapacity("buscentre", mcId);
  if (cap.atCapacity) {
    await logCapacityWarning({
      level: "buscentre", parentId: mcId, parentName: mc.name,
      count: cap.count, createdById: session.user.id,
    });
  }

  const buscentre = await prisma.buscentre.create({ data: { mcId, name, location } });
  return NextResponse.json(
    cap.atCapacity
      ? { ...buscentre, warning: `${mc.name} is at buscentre capacity (${cap.count}/${cap.max})` }
      : buscentre,
    { status: 201 }
  );
}
