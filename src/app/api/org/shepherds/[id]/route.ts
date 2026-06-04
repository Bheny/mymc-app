import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const shepherd = await prisma.shepherd.findUnique({
    where: { id: params.id },
    include: {
      user:   { select: { id: true, name: true, email: true } },
      person: { select: { id: true, firstName: true, lastName: true } },
      cell:   { select: { id: true, name: true } },
      _count: { select: { members: true } },
    },
  });
  if (!shepherd) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(shepherd);
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await request.json();

  // memberId: string  → assign this member as the named shepherd (no login yet)
  // memberId: null    → unassign (clear the named person)
  const { memberId } = body;

  // Validate the member exists if assigning
  if (memberId) {
    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    // Make sure this member isn't already assigned to a different shepherd slot
    const existing = await prisma.shepherd.findFirst({
      where: { memberId, NOT: { id: params.id } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "This member is already assigned as a shepherd in another slot." },
        { status: 409 }
      );
    }
  }

  const shepherd = await prisma.shepherd.update({
    where: { id: params.id },
    data:  { memberId: memberId ?? null },
    include: {
      user:   { select: { id: true, name: true } },
      person: { select: { id: true, firstName: true, lastName: true } },
      cell:   {
        select: {
          id: true, name: true,
          userRoles: {
            where:   { role: "cell_shepherd" },
            select:  { userId: true },
          },
        },
      },
      _count: { select: { members: true } },
    },
  });

  // If the member being assigned has a User account, auto-wire their supervisor
  // to the cell's cell shepherd — the hierarchy is automatic, not manual.
  if (memberId) {
    const member = await prisma.member.findUnique({
      where:  { id: memberId },
      select: { userId: true },
    });

    if (member?.userId) {
      const cellShepherdUserId = shepherd.cell.userRoles[0]?.userId ?? null;
      if (cellShepherdUserId) {
        await prisma.user.update({
          where: { id: member.userId },
          data:  { supervisorId: cellShepherdUserId },
        });
      }
    }
  }

  return NextResponse.json(shepherd);
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  await prisma.shepherd.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
