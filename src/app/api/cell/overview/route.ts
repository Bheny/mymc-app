import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { upcomingBirthdays } from "@/lib/birthdays";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const actingCellId = searchParams.get("actingCellId");

  let cellId = session.user.cellId;

  // Acting-up override: allow a buscentre head / higher role to view a specific cell
  // they are temporarily filling as cell shepherd.
  if (actingCellId) {
    const actingAt = (session.user.actingAt ?? {}) as Record<string, string>;
    if (actingAt.cell_id === actingCellId) {
      cellId = actingCellId;
    } else {
      return NextResponse.json({ error: "No acting access to this cell" }, { status: 403 });
    }
  }

  if (!cellId) {
    return NextResponse.json({ error: "No cell assigned to your account" }, { status: 400 });
  }

  // ── Cell info ────────────────────────────────────────────────────────────────
  const cell = await prisma.cell.findUnique({
    where: { id: cellId },
    select: {
      id: true, name: true,
      buscentre: {
        select: {
          id: true, name: true,
          mc: { select: { id: true, name: true } },
        },
      },
      userRoles: {
        where:   { role: "cell_shepherd" },
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  if (!cell) return NextResponse.json({ error: "Cell not found" }, { status: 404 });

  // ── Shepherd slots with member lists ─────────────────────────────────────────
  const shepherds = await prisma.shepherd.findMany({
    where:   { cellId },
    include: {
      user:   { select: { id: true, name: true } },
      person: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { members: true } },
      members: {
        orderBy: { lastName: "asc" },
        select: {
          id: true, firstName: true, lastName: true,
          phone: true, gender: true, isActive: true, isUser: true, joinedDate: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // ── Unassigned regular members (no shepherd, not filling a slot, not leadership) ─
  const unassignedMembers = await prisma.member.findMany({
    where:   { cellId, shepherdId: null, shepherdRole: null, isUser: false },
    orderBy: { lastName: "asc" },
    select: {
      id: true, firstName: true, lastName: true,
      phone: true, gender: true, isActive: true, isUser: true, joinedDate: true,
      user: { select: { id: true, role: { select: { role: true } } } },
    },
  });

  // ── All members in the cell (for demographic + growth stats) ─────────────────
  const now           = new Date();
  const startOfMonth  = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear   = new Date(now.getFullYear(), 0, 1);
  const sixMonthsAgo  = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());

  const allMembers = await prisma.member.findMany({
    where:  { cellId },
    select: {
      id:          true,
      firstName:   true,
      lastName:    true,
      gender:      true,
      phone:       true,
      dateOfBirth: true,
      isUser:      true,
      isActive:    true,
      createdAt:   true,
    },
  });

  // ── Derived stats ─────────────────────────────────────────────────────────────

  // Use allMembers as the single source of truth for all counts —
  // this includes everyone in the cell: regular members, shepherds, and leadership.
  const totalMembers    = allMembers.length;
  const activeMembers   = allMembers.filter((m) => m.isActive).length;
  const inactiveMembers = allMembers.filter((m) => !m.isActive).length;
  const systemUsers     = allMembers.filter((m) => m.isUser).length;
  const occupiedSlots   = shepherds.filter((s) => s.user || s.person).length;
  const unoccupiedSlots = shepherds.filter((s) => !s.user && !s.person).length;

  // Demographics — same dataset, consistent with totalMembers
  const maleCount       = allMembers.filter((m) => m.gender === "Male").length;
  const femaleCount     = allMembers.filter((m) => m.gender === "Female").length;
  const havePhone       = allMembers.filter((m) => m.phone).length;
  const haveDOB         = allMembers.filter((m) => m.dateOfBirth).length;

  // Growth & Activity
  const newThisMonth    = allMembers.filter((m) => new Date(m.createdAt) >= startOfMonth).length;
  const newThisYear     = allMembers.filter((m) => new Date(m.createdAt) >= startOfYear).length;
  const longStanding    = allMembers.filter(
    (m) => !m.isUser && new Date(m.createdAt) <= sixMonthsAgo
  ).length;

  // Shepherd load
  const avgPerShepherd      = occupiedSlots > 0
    ? Math.round((totalMembers / occupiedSlots) * 10) / 10
    : 0;
  const shepherdsAtCapacity = shepherds.filter((s) => s._count.members >= 5).length;
  const withoutShepherd     = unassignedMembers.length;

  const cellShepherds = cell.userRoles.map((r) => ({
    userId: r.user.id,
    name:   r.user.name,
  }));

  const birthdays = upcomingBirthdays(allMembers, 30);

  return NextResponse.json({
    cell: {
      id:        cell.id,
      name:      cell.name,
      buscentre: cell.buscentre ? { id: cell.buscentre.id, name: cell.buscentre.name } : null,
      mc:        cell.buscentre?.mc ?? null,
      shepherd:  cell.userRoles[0]?.user?.name ?? null,
    },
    stats: {
      // Primary
      totalMembers, activeMembers, inactiveMembers, systemUsers,
      totalShepherds: shepherds.length, occupiedSlots, unoccupiedSlots,
      // Demographics
      maleCount, femaleCount, havePhone, haveDOB,
      // Growth
      newThisMonth, newThisYear, longStanding,
      // Shepherd load
      avgPerShepherd, shepherdsAtCapacity, withoutShepherd,
    },
    shepherds,
    unassignedMembers,
    cellShepherds,
    birthdays,
  });
}
