import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/first-timers/[id] — update intent or details
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const ft = await prisma.firstTimer.findUnique({ where: { id: params.id } });
  if (!ft) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { firstName, lastName, phone, location, referredBy, intent } = body;

  const updated = await prisma.firstTimer.update({
    where: { id: params.id },
    data: {
      ...(firstName  !== undefined && { firstName:  firstName.trim() }),
      ...(lastName   !== undefined && { lastName:   lastName.trim() }),
      ...(phone      !== undefined && { phone:      phone?.trim() || null }),
      ...(location   !== undefined && { location:   location?.trim() || null }),
      ...(referredBy !== undefined && { referredBy: referredBy?.trim() || null }),
      ...(intent     !== undefined && { intent }),
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/first-timers/[id]
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const ft = await prisma.firstTimer.findUnique({ where: { id: params.id } });
  if (!ft) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Cannot delete if already converted — soft guard
  if (ft.convertedToMemberId) {
    return NextResponse.json({ error: "Cannot delete a converted first timer" }, { status: 409 });
  }

  await prisma.firstTimer.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
