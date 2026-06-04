import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const cell = await prisma.cell.findUnique({
    where: { id: params.id },
    include: {
      buscentre: { select: { id: true, name: true } },
      _count:    { select: { shepherds: true, members: true } },
      userRoles: { where: { role: "cell_shepherd" }, include: { user: { select: { id: true, name: true } } } },
    },
  });
  if (!cell) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(cell);
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { name, location } = await request.json();

  const cell = await prisma.cell.update({
    where: { id: params.id },
    data: {
      ...(name     !== undefined && { name }),
      ...(location !== undefined && { location: location ?? null }),
    },
  });
  return NextResponse.json(cell);
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  await prisma.cell.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
