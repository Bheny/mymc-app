import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const cells = await prisma.cell.findMany({
    where:   { userId: session.user.id },
    include: { _count: { select: { members: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(cells);
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await request.json();
  const { name, areaCovered, headedBy, startedBy, assistedBy } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const cell = await prisma.cell.create({
    data: {
      name,
      areaCovered,
      headedBy,
      startedBy,
      assistedBy: assistedBy ?? [],
      userId:     session.user.id,
    },
  });

  return NextResponse.json(cell, { status: 201 });
}
