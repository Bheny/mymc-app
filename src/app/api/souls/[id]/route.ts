import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string } };

// PATCH /api/souls/[id]
export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const soul = await prisma.soul.findUnique({ where: { id: params.id } });
  if (!soul) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { firstName, lastName, phone, location, date, notes } = await request.json();

  const updated = await prisma.soul.update({
    where: { id: params.id },
    data: {
      ...(firstName !== undefined && { firstName: firstName.trim() }),
      ...(lastName  !== undefined && { lastName:  lastName.trim() }),
      ...(phone     !== undefined && { phone:     phone?.trim()    || null }),
      ...(location  !== undefined && { location:  location?.trim() || null }),
      ...(date      !== undefined && { date:      new Date(date) }),
      ...(notes     !== undefined && { notes:     notes?.trim()    || null }),
    },
    include: { recordedBy: { select: { name: true } } },
  });

  return NextResponse.json(updated);
}

// DELETE /api/souls/[id]
export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const soul = await prisma.soul.findUnique({ where: { id: params.id } });
  if (!soul) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.soul.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
