import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkCapacity, logCapacityWarning } from "@/lib/capacity";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const cellId = searchParams.get("cellId");

  const shepherds = await prisma.shepherd.findMany({
    where:   cellId ? { cellId } : {},
    include: {
      _count:  { select: { members: true } },
      user:    { select: { id: true, name: true, email: true } },
      person:  { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(shepherds);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { cellId } = await request.json();
  if (!cellId) return NextResponse.json({ error: "cellId is required" }, { status: 400 });

  const cell = await prisma.cell.findUnique({ where: { id: cellId } });
  if (!cell) return NextResponse.json({ error: "Cell not found" }, { status: 404 });

  const cap = await checkCapacity("shepherd", cellId);
  if (cap.atCapacity) {
    await logCapacityWarning({
      level: "shepherd", parentId: cellId, parentName: cell.name,
      count: cap.count, createdById: session.user.id,
    });
  }

  const shepherd = await prisma.shepherd.create({ data: { cellId } });
  return NextResponse.json(
    cap.atCapacity
      ? { ...shepherd, warning: `${cell.name} is at shepherd capacity (${cap.count}/${cap.max})` }
      : shepherd,
    { status: 201 }
  );
}
