import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: {
      id:          true,
      name:        true,
      email:       true,
      rank:        true,
      activatedAt: true,
      role: {
        select: {
          role:        true,
          cellId:      true,
          buscentreId: true,
          mcId:        true,
          cell:        { select: { name: true } },
          buscentre:   { select: { name: true } },
          mc:          { select: { name: true } },
        },
      },
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { name, rank } = await request.json();
  if (name !== undefined && !name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const VALID_RANKS = ["Reverend", "Pastor", "Senior Shepherd", "Shepherd", "Member", null];
  if (rank !== undefined && !VALID_RANKS.includes(rank)) {
    return NextResponse.json({ error: "Invalid rank" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data:  {
      ...(name !== undefined && { name: name.trim() }),
      ...(rank !== undefined && { rank: rank ?? null }),
    },
    select: { id: true, name: true, email: true, rank: true },
  });

  return NextResponse.json(user);
}
