import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveMemberShepherdName } from "@/lib/leadership";
import { roleRank } from "@/lib/permissions";
import { checkCapacity } from "@/lib/capacity";
import { isInactiveReason, STATUS_DETAILS_MIN } from "@/lib/member-status";
import { Role } from "@prisma/client";

// Salary is sensitive — only cell_shepherd and above may see it
const canViewSalary = (role: string | null | undefined) =>
  !!role && roleRank(role as Role) <= roleRank("cell_shepherd");

type Params = { params: { id: string } };

// Latest status change — explains why a member is (in)active. Queried
// separately so member reads still work if the history table is missing.
async function latestStatusChange(memberId: string) {
  try {
    return await prisma.memberStatusChange.findFirst({
      where:   { memberId },
      orderBy: { createdAt: "desc" },
      select:  {
        isActive: true, reason: true, details: true, createdAt: true,
        changedBy: { select: { name: true } },
      },
    });
  } catch {
    return null;
  }
}

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

  const [effectiveShepherdName, lastStatusChange] = await Promise.all([
    resolveMemberShepherdName(member),
    latestStatusChange(member.id),
  ]);
  const salaryRange = canViewSalary(session.user.role) ? member.salaryRange : null;
  return NextResponse.json({ ...member, salaryRange, effectiveShepherdName, lastStatusChange });
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
    isEmployed, employer, occupation, salaryRange,
    ownsBusiness, businessName, businessType,
    isStudent, schoolLevel, schoolName, programOfStudy,
    departmentIds,
    statusReason, statusDetails,
  } = body;

  if (departmentIds !== undefined && (!Array.isArray(departmentIds) || departmentIds.length > 2)) {
    return NextResponse.json({ error: "A member can belong to at most 2 departments" }, { status: 400 });
  }

  if (salaryRange !== undefined && !canViewSalary(session.user.role)) {
    return NextResponse.json({ error: "Not permitted to set salary range" }, { status: 403 });
  }

  const current = await prisma.member.findUnique({
    where:  { id: params.id },
    select: { shepherdId: true, isActive: true },
  });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ── Status change: deactivation must say why ──
  const statusChanging = typeof isActive === "boolean" && isActive !== current.isActive;
  const details = typeof statusDetails === "string" ? statusDetails.trim() : "";
  if (statusChanging && !isActive) {
    if (!isInactiveReason(statusReason)) {
      return NextResponse.json({ error: "Choose a reason for marking this member inactive" }, { status: 400 });
    }
    if (details.length < STATUS_DETAILS_MIN) {
      return NextResponse.json({ error: "Add some details about the status change" }, { status: 400 });
    }
  }

  if (shepherdId) {
    if (current.shepherdId !== shepherdId) {
      const cap = await checkCapacity("member", shepherdId);
      if (cap.blocked) {
        return NextResponse.json(
          { error: `This shepherd already has the maximum of ${cap.max} members` },
          { status: 409 }
        );
      }
    }
  }

  if (departmentIds !== undefined) {
    await prisma.memberDepartment.deleteMany({ where: { memberId: params.id } });
    if (departmentIds.length) {
      await prisma.memberDepartment.createMany({
        data: departmentIds.map((departmentId: string) => ({ memberId: params.id, departmentId })),
      });
    }
  }

  const memberUpdate = prisma.member.update({
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
      // Employment / profession
      ...(isEmployed  !== undefined && { isEmployed }),
      ...(employer    !== undefined && { employer }),
      ...(occupation  !== undefined && { occupation }),
      ...(salaryRange !== undefined && { salaryRange }),
      ...(ownsBusiness !== undefined && { ownsBusiness }),
      ...(businessName !== undefined && { businessName }),
      ...(businessType !== undefined && { businessType }),
      ...(isStudent      !== undefined && { isStudent }),
      ...(schoolLevel    !== undefined && { schoolLevel }),
      ...(schoolName     !== undefined && { schoolName }),
      ...(programOfStudy !== undefined && { programOfStudy }),
    },
    include: MEMBER_INCLUDE,
  });

  // Status change and its history row are written together
  const member = statusChanging
    ? (await prisma.$transaction([
        memberUpdate,
        prisma.memberStatusChange.create({
          data: {
            memberId:    params.id,
            isActive,
            reason:      isActive ? null : statusReason,
            details:     details || null,
            changedById: session.user.id,
          },
        }),
      ]))[0]
    : await memberUpdate;

  const [effectiveShepherdName, lastStatusChange] = await Promise.all([
    resolveMemberShepherdName(member),
    latestStatusChange(member.id),
  ]);
  const responseSalaryRange = canViewSalary(session.user.role) ? member.salaryRange : null;
  return NextResponse.json({ ...member, salaryRange: responseSalaryRange, effectiveShepherdName, lastStatusChange });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  await prisma.member.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
