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

  // If they came through evangelism (or were recorded as a walk-in) there's a
  // Contact whose journey ends here
  const contact = ft.contactId
    ? await prisma.contact.findUnique({ where: { id: ft.contactId }, select: { id: true, gender: true } })
    : null;

  const member = await prisma.$transaction(async (tx) => {
    const newMember = await tx.member.create({
      data: {
        firstName:  ft.firstName,
        lastName:   ft.lastName,
        phone:      ft.phone ?? null,
        gender:     contact?.gender ?? null,
        cellId:     ft.cellId,
        joinedDate: ft.service.date,
        isActive:   true,
        isUser:     false,
      },
    });

    if (contact) {
      await tx.contact.update({
        where: { id: contact.id },
        data: {
          stage:             "CONVERTED",
          convertedMemberId: newMember.id,
          convertedAt:       new Date(),
          lastActivityAt:    new Date(),
        },
      });
      await tx.contactActivity.create({
        data: { contactId: contact.id, type: "STAGE_CHANGE", note: "Became a member", byUserId: session.user.id },
      });
    }

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
