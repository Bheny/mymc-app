import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const branches = await prisma.branch.findMany({
    include: { _count: { select: { megaChurches: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(branches);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { name } = await request.json();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const branch = await prisma.branch.create({ data: { name } });
  return NextResponse.json(branch, { status: 201 });
}
