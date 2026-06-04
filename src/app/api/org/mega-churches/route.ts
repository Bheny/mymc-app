import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");

  const mcs = await prisma.megaChurch.findMany({
    where:   branchId ? { branchId } : {},
    include: { _count: { select: { buscentres: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(mcs);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { branchId, name } = await request.json();
  if (!branchId || !name) {
    return NextResponse.json({ error: "branchId and name are required" }, { status: 400 });
  }

  const mc = await prisma.megaChurch.create({ data: { branchId, name } });
  return NextResponse.json(mc, { status: 201 });
}
