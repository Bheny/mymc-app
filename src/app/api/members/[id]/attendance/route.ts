import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string } };

export async function GET(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const take = parseInt(new URL(request.url).searchParams.get("take") ?? "20");

  const records = await prisma.attendance.findMany({
    where:   { memberId: params.id },
    orderBy: { service: { date: "desc" } },
    take,
    select: {
      id:     true,
      status: true,
      notes:  true,
      service: {
        select: {
          id:      true,
          type:    true,
          date:    true,
          mode:    true,
          speaker: true,
        },
      },
    },
  });

  return NextResponse.json(records);
}
