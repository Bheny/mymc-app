import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const bc = await prisma.buscentre.findUnique({
    where: { id: params.id },
    include: {
      mc:        { select: { id: true, name: true } },
      _count:    { select: { cells: true } },
      userRoles: { where: { role: "buscentre_head" }, include: { user: { select: { id: true, name: true } } } },
    },
  });
  if (!bc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(bc);
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await request.json();
  const { name, location } = body;

  const bc = await prisma.buscentre.update({
    where: { id: params.id },
    data: {
      ...(name     !== undefined && { name }),
      ...(location !== undefined && { location }),
    },
  });
  return NextResponse.json(bc);
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  await prisma.buscentre.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
