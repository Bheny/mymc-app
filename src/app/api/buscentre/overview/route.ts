import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { upcomingBirthdays } from "@/lib/birthdays";
import { authorizeBuscentreView } from "@/lib/view-scope";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const actingBuscentreId = searchParams.get("actingBuscentreId");
  const viewBuscentreId   = searchParams.get("viewBuscentreId");

  // Resolve buscentre ID — primary role, acting override, or a read-only drill-down view
  let buscentreId = session.user.buscentreId;

  if (actingBuscentreId) {
    const actingAt = (session.user.actingAt ?? {}) as Record<string, string>;
    if (actingAt.buscentre_id === actingBuscentreId) {
      buscentreId = actingBuscentreId;
    } else {
      return NextResponse.json({ error: "No acting access to this buscentre" }, { status: 403 });
    }
  } else if (viewBuscentreId) {
    const { id, status } = await authorizeBuscentreView(session.user.role, session.user, viewBuscentreId);
    if (status !== 200) return NextResponse.json({ error: "You don't have access to this buscentre" }, { status });
    buscentreId = id;
  }

  if (!buscentreId) {
    return NextResponse.json({ error: "No buscentre assigned to your account" }, { status: 400 });
  }

  // ── Buscentre info ────────────────────────────────────────────────────────
  const buscentre = await prisma.buscentre.findUnique({
    where: { id: buscentreId },
    select: {
      id: true, name: true, location: true,
      mc: { select: { id: true, name: true } },
      userRoles: {
        where:   { role: "buscentre_head" },
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  if (!buscentre) return NextResponse.json({ error: "Buscentre not found" }, { status: 404 });

  // ── All cells in the buscentre with shepherds and member counts ───────────
  const cells = await prisma.cell.findMany({
    where:   { buscentreId },
    include: {
      _count:    { select: { members: true, shepherds: true } },
      shepherds: {
        include: {
          _count:  { select: { members: true } },
          user:    { select: { id: true, name: true } },
          person:  { select: { firstName: true, lastName: true } },
        },
      },
      userRoles: {
        where:   { role: "cell_shepherd" },
        include: { user: { select: { id: true, name: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  // ── All members in the buscentre for stats + birthdays ───────────────────
  const allMembers = await prisma.member.findMany({
    where:  { cell: { buscentreId } },
    select: {
      id: true, firstName: true, lastName: true,
      gender: true, isActive: true, isUser: true,
      dateOfBirth: true, createdAt: true,
      phone: true, cell: { select: { name: true } },
    },
  });

  // ── Recent members (last 6 added across the whole buscentre) ─────────────
  const recentMembers = await prisma.member.findMany({
    where:   { cell: { buscentreId } },
    orderBy: { createdAt: "desc" },
    take:    6,
    select: {
      id: true, firstName: true, lastName: true,
      isActive: true, isUser: true, createdAt: true,
      cell: { select: { id: true, name: true } },
    },
  });

  // ── Aggregate stats ───────────────────────────────────────────────────────
  const totalCells             = cells.length;
  const totalMembers           = allMembers.length;
  const activeMembers          = allMembers.filter((m) => m.isActive).length;
  const inactiveMembers        = allMembers.filter((m) => !m.isActive).length;
  const systemUsers            = allMembers.filter((m) => m.isUser).length;
  const totalShepherds         = cells.reduce((s, c) => s + c.shepherds.length, 0);
  const unoccupiedSlots        = cells.reduce((s, c) =>
    s + c.shepherds.filter((sh) => !sh.user && !sh.person).length, 0);
  const cellShepherdsAssigned  = cells.filter((c) => c.userRoles.length > 0).length;
  const cellShepherdsUnassigned = totalCells - cellShepherdsAssigned;

  const now          = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear  = new Date(now.getFullYear(), 0, 1);

  const newThisMonth = allMembers.filter((m) => new Date(m.createdAt) >= startOfMonth).length;
  const newThisYear  = allMembers.filter((m) => new Date(m.createdAt) >= startOfYear).length;

  const birthdays = upcomingBirthdays(allMembers, 30);

  return NextResponse.json({
    buscentre: {
      id:       buscentre.id,
      name:     buscentre.name,
      location: buscentre.location,
      mc:       buscentre.mc,
      head:     buscentre.userRoles[0]?.user?.name ?? null,
    },
    stats: {
      totalCells,
      totalMembers,
      activeMembers,
      inactiveMembers,
      systemUsers,
      totalShepherds,
      unoccupiedSlots,
      cellShepherdsAssigned,
      cellShepherdsUnassigned,
      newThisMonth,
      newThisYear,
    },
    cells,
    recentMembers,
    birthdays,
  });
}
