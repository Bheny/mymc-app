import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const mc = await prisma.megaCentre.findUnique({
    where: { id: params.id },
    include: {
      assignedPastor: { select: { id: true, name: true, email: true, role: true } },
      users: {
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!mc) {
    return NextResponse.json({ error: "MegaCentre not found" }, { status: 404 });
  }

  return NextResponse.json(mc);
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await request.json();
  const { name, location, description, logoUrl, assignedPastorId } = body;

  // Verify the pastor exists if being set
  if (assignedPastorId) {
    const pastor = await prisma.user.findUnique({ where: { id: assignedPastorId } });
    if (!pastor) {
      return NextResponse.json({ error: "Assigned pastor user not found" }, { status: 404 });
    }
  }

  const mc = await prisma.megaCentre.update({
    where: { id: params.id },
    data: {
      ...(name             !== undefined && { name }),
      ...(location         !== undefined && { location }),
      ...(description      !== undefined && { description }),
      ...(logoUrl          !== undefined && { logoUrl }),
      // Pass null explicitly to unlink a pastor
      ...(assignedPastorId !== undefined && { assignedPastorId: assignedPastorId ?? null }),
    },
    include: {
      assignedPastor: { select: { id: true, name: true, email: true, role: true } },
      users: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  return NextResponse.json(mc);
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  await prisma.megaCentre.delete({ where: { id: params.id } });

  return NextResponse.json({ message: "MegaCentre deleted" });
}
