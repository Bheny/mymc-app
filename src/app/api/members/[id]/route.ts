import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string } };

const MEMBER_INCLUDE = {
  shepherd:  { select: { id: true, user: { select: { id: true, name: true } }, person: { select: { firstName: true, lastName: true } } } },
  cell:      { select: { id: true, name: true, buscentre: { select: { id: true, name: true } } } },
  buscentre: { select: { id: true, name: true } },
  mc:        { select: { id: true, name: true } },
  // Whether this member IS a shepherd (back-relation via Shepherd.memberId)
  shepherdRole: {
    select: {
      id:      true,
      _count:  { select: { members: true } },
      cell:    { select: { id: true, name: true } },
    },
  },
  // When this member is a system user, include their supervisor + their role
  user: {
    select: {
      id:   true,
      name: true,
      role: { select: { role: true } },
      supervisor: {
        select: {
          id:   true,
          name: true,
          role: { select: { role: true } },
        },
      },
    },
  },
  departments: { select: { department: { select: { id: true, name: true } } } },
} as const;

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const member = await prisma.member.findUnique({
    where:   { id: params.id },
    include: MEMBER_INCLUDE,
  });
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(member);
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await request.json();
  const {
    firstName, lastName, phone, email,
    gender, dateOfBirth, joinedDate, isActive,
    shepherdId, cellId,
    hometown, previousChurch,
    parentName, parentPhone,
    emergencyName, emergencyPhone, emergencyRelation,
    departmentIds,
  } = body;

  if (departmentIds !== undefined && (!Array.isArray(departmentIds) || departmentIds.length > 2)) {
    return NextResponse.json({ error: "A member can belong to at most 2 departments" }, { status: 400 });
  }

  if (departmentIds !== undefined) {
    await prisma.memberDepartment.deleteMany({ where: { memberId: params.id } });
    if (departmentIds.length) {
      await prisma.memberDepartment.createMany({
        data: departmentIds.map((departmentId: string) => ({ memberId: params.id, departmentId })),
      });
    }
  }

  const member = await prisma.member.update({
    where: { id: params.id },
    data: {
      ...(firstName  !== undefined && { firstName:   firstName?.trim() }),
      ...(lastName   !== undefined && { lastName:    lastName?.trim() }),
      ...(phone      !== undefined && { phone }),
      ...(email      !== undefined && { email }),
      ...(gender     !== undefined && { gender }),
      ...(isActive   !== undefined && { isActive }),
      ...(shepherdId !== undefined && { shepherdId }),
      ...(cellId     !== undefined && { cellId }),
      ...(dateOfBirth !== undefined && { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null }),
      ...(joinedDate  !== undefined && { joinedDate:  joinedDate  ? new Date(joinedDate)  : null }),
      // Extended profile fields
      ...(hometown          !== undefined && { hometown }),
      ...(previousChurch    !== undefined && { previousChurch }),
      ...(parentName        !== undefined && { parentName }),
      ...(parentPhone       !== undefined && { parentPhone }),
      ...(emergencyName     !== undefined && { emergencyName }),
      ...(emergencyPhone    !== undefined && { emergencyPhone }),
      ...(emergencyRelation !== undefined && { emergencyRelation }),
    },
    include: MEMBER_INCLUDE,
  });

  return NextResponse.json(member);
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  await prisma.member.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
