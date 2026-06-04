import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { upcomingBirthdays } from "@/lib/birthdays";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { branchId, mcId, buscentreId, cellId } = session.user;

  // Build a scope filter from the caller's role so each role only sees their slice
  const cellWhere = cellId
    ? { id: cellId }
    : buscentreId
    ? { buscentreId }
    : mcId
    ? { buscentre: { mcId } }
    : branchId
    ? { buscentre: { mc: { branchId } } }
    : {};

  const memberWhere = Object.keys(cellWhere).length
    ? { OR: [{ cell: cellWhere }, { cellId: undefined }] }
    : {};

  const [
    totalMembers,
    activeMembers,
    inactiveMembers,
    systemUsers,
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
    prisma.member.count(),
    prisma.member.count({ where: { isActive: true } }),
    prisma.member.count({ where: { isActive: false } }),
    prisma.member.count({ where: { isUser: true } }),

    // Org structure counts
    prisma.megaChurch.count(),
    prisma.buscentre.count(),
    prisma.cell.count(),
    prisma.shepherd.count(),

    // Health
    prisma.actingUpFlag.count({ where: { resolved: false } }),
    prisma.capacityWarning.count({ where: { resolved: false } }),
    // Truly unoccupied = no system user AND no named person
    prisma.shepherd.count({ where: { userId: null, memberId: null } }),

    // Recently added members (last 6)
    prisma.member.findMany({
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
      where:  { dateOfBirth: { not: null } },
      select: { id: true, firstName: true, lastName: true, dateOfBirth: true },
    }),
  ]);

  const birthdays = upcomingBirthdays(birthdayMembers, 30);

  return NextResponse.json({
    // Members
    totalMembers,
    activeMembers,
    inactiveMembers,
    systemUsers,

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
