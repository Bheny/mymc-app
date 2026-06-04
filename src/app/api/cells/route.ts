import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const cells = await prisma.cell.findMany({
    include: { _count: { select: { members: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(cells);
}
