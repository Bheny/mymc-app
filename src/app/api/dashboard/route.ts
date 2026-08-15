import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { upcomingBirthdays } from "@/lib/birthdays";
import { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const actingMcId     = searchParams.get("actingMcId");
  const actingBranchId = searchParams.get("actingBranchId");

  const freshRole = await prisma.userRole.findUnique({
    where:  { userId: session.user.id },
    select: { role: true, mcId: true, branchId: true, actingAt: true },
  });

  const actingAt = (freshRole?.actingAt ?? session.user.actingAt ?? {}) as Record<string, string>;
  let mcId       = freshRole?.mcId     ?? session.user.mcId     ?? null;
  let branchId   = freshRole?.branchId ?? session.user.branchId ?? null;
  const role     = freshRole?.role     ?? session.user.role     ?? null;

  if (actingMcId) {
    if (actingAt.mc_id === actingMcId) mcId = actingMcId;
    else return NextResponse.json({ error: "No acting access to this MC" }, { status: 403 });
  }
  if (actingBranchId) {
    if (actingAt.branch_id === actingBranchId) branchId = actingBranchId;
    else return NextResponse.json({ error: "No acting access to this branch" }, { status: 403 });
  }

  const isMcScope     = role === "mc_pastor"      || !!actingMcId;
  const isBranchScope = !isMcScope && (role === "chief_shepherd" || !!actingBranchId);

  // Everyone else reaching this route (admin, or any unscoped fallback) sees org-wide
  // data — the fragments below simply stay empty ({}), same as before this change.
  let cellWhere:      Prisma.CellWhereInput      = {};
  let mcWhere:        Prisma.MegaChurchWhereInput = {};
  let buscentreWhere: Prisma.BuscentreWhereInput  = {};
  let memberOr:       Prisma.MemberWhereInput["OR"];

  if (isMcScope && mcId) {
    cellWhere      = { buscentre: { mcId } };
    mcWhere        = { id: mcId };
    buscentreWhere = { mcId };
    memberOr       = [{ mcId }, { buscentre: { mcId } }, { cell: { buscentre: { mcId } } }];
  } else if (isBranchScope && branchId) {
    cellWhere      = { buscentre: { mc: { branchId } } };
    mcWhere        = { branchId };
    buscentreWhere = { mc: { branchId } };
    memberOr       = [{ mc: { branchId } }, { buscentre: { mc: { branchId } } }, { cell: { buscentre: { mc: { branchId } } } }];
  }

  const memberWhere: Prisma.MemberWhereInput = memberOr ? { OR: memberOr } : {};

  const [
    totalMembers,
    activeMembers,
    inactiveMembers,
    systemUsers,
    membersInDepartment,
    totalMCs,
    totalBuscentres,
    totalCells,
    totalShepherds,
    openActingUpFlags,
    openCapacityWarnings,
    unoccupiedShepherdSlots,
    recentMembers,
    topCells,
    topShepherds,
    birthdayMembers,
  ] = await Promise.all([
    // Member counts
    prisma.member.count({ where: memberWhere }),
    prisma.member.count({ where: { ...memberWhere, isActive: true } }),
    prisma.member.count({ where: { ...memberWhere, isActive: false } }),
    prisma.member.count({ where: { ...memberWhere, isUser: true } }),
    prisma.member.count({ where: { ...memberWhere, departments: { some: {} } } }),

    // Org structure counts
    prisma.megaChurch.count({ where: mcWhere }),
    prisma.buscentre.count({ where: buscentreWhere }),
    prisma.cell.count({ where: cellWhere }),
    prisma.shepherd.count({ where: { cell: cellWhere } }),

    // Health — ActingUpFlag/CapacityWarning are keyed by a free-form nodeId/nodeType,
    // not a direct org-hierarchy relation, so these two stay org-wide for every role
    // until that's worth solving separately.
    prisma.actingUpFlag.count({ where: { resolved: false } }),
    prisma.capacityWarning.count({ where: { resolved: false } }),
    // Truly unoccupied = no system user AND no named person
    prisma.shepherd.count({ where: { cell: cellWhere, userId: null, memberId: null } }),

    // Recently added members (last 6)
    prisma.member.findMany({
      where:   memberWhere,
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id:        true,
        firstName: true,
        lastName:  true,
        createdAt: true,
        isUser:    true,
        isActive:  true,
        cell: {
          select: {
            name:      true,
            buscentre: { select: { name: true } },
          },
        },
        buscentre: { select: { name: true } },
        mc:        { select: { name: true } },
      },
    }),

    // Top 5 cells by member count
    prisma.cell.findMany({
      where: cellWhere,
      take: 5,
      include: {
        _count:    { select: { members: true, shepherds: true } },
        buscentre: { select: { name: true } },
        userRoles: {
          where:   { role: "cell_shepherd" },
          include: { user: { select: { name: true } } },
        },
      },
      orderBy: { members: { _count: "desc" } },
    }),

    // Top 5 shepherds by member count
    prisma.shepherd.findMany({
      where: { cell: cellWhere },
      take: 5,
      include: {
        _count:  { select: { members: true } },
        user:    { select: { id: true, name: true } },
        person:  { select: { firstName: true, lastName: true } },
        cell:    { select: { name: true } },
      },
      orderBy: { members: { _count: "desc" } },
    }),

    // Members with birthdays in the next 30 days
    prisma.member.findMany({
      where:  { ...memberWhere, dateOfBirth: { not: null } },
      select: {
        id: true, firstName: true, lastName: true, dateOfBirth: true,
        phone: true, cell: { select: { name: true } },
      },
    }),
  ]);

  const birthdays = upcomingBirthdays(birthdayMembers, 30);

  return NextResponse.json({
    // Members
    totalMembers,
    activeMembers,
    inactiveMembers,
    systemUsers,
    membersInDepartment,

    // Org structure
    totalMCs,
    totalBuscentres,
    totalCells,
    totalShepherds,

    // Health
    openActingUpFlags,
    openCapacityWarnings,
    totalOpenWarnings: openActingUpFlags + openCapacityWarnings,
    unoccupiedShepherdSlots,

    // Lists
    recentMembers,
    topCells,
    topShepherds,
    birthdays,
  });
}
