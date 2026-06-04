import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/first-timers/[id]/convert
// Creates a Member record from the first timer's details and marks them as converted.
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const ft = await prisma.firstTimer.findUnique({
    where:   { id: params.id },
    include: { service: { select: { date: true } } },
  });

  if (!ft)                      return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ft.convertedToMemberId)   return NextResponse.json({ error: "Already converted" }, { status: 409 });

  const member = await prisma.$transaction(async (tx) => {
    const newMember = await tx.member.create({
      data: {
        firstName:  ft.firstName,
        lastName:   ft.lastName,
        phone:      ft.phone ?? null,
        cellId:     ft.cellId,
        joinedDate: ft.service.date,
        isActive:   true,
        isUser:     false,
      },
    });

    await tx.firstTimer.update({
      where: { id: ft.id },
      data: {
        convertedToMemberId: newMember.id,
        convertedAt:         new Date(),
        convertedById:       session.user.id,
      },
    });

    return newMember;
  });

  return NextResponse.json(member, { status: 201 });
}
