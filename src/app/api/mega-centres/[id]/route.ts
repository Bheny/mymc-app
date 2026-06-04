import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const mc = await prisma.megaChurch.findUnique({
    where:   { id: params.id },
    include: { _count: { select: { buscentres: true } } },
  });

  if (!mc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(mc);
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { name, location } = await request.json();

  const mc = await prisma.megaChurch.update({
    where: { id: params.id },
    data: {
      ...(name     !== undefined && { name }),
      ...(location !== undefined && { location }),
    },
  });

  return NextResponse.json(mc);
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  await prisma.megaChurch.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
