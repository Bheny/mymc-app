import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string } };

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { reachOutStatus, reachOutNote } = await request.json();

  const validStatuses = ["GREEN", "YELLOW", "RED", null];
  if (!validStatuses.includes(reachOutStatus)) {
    return NextResponse.json({ error: "Invalid status — must be GREEN, YELLOW, RED or null" }, { status: 400 });
  }

  const ft = await prisma.firstTimer.update({
    where: { id: params.id },
    data:  {
      reachOutStatus: reachOutStatus ?? null,
      reachOutNote:   reachOutNote   ?? null,
      reachedOutAt:   reachOutStatus ? new Date() : null,
    },
    select: { id: true, reachOutStatus: true, reachOutNote: true, reachedOutAt: true },
  });

  return NextResponse.json(ft);
}
