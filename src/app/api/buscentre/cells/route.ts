import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Returns all cells in the buscentre with full shepherd + contact info.
 * Used by the /buscentre management page.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const actingBuscentreId = searchParams.get("actingBuscentreId");

  let buscentreId = session.user.buscentreId;

  if (actingBuscentreId) {
    const actingAt = (session.user.actingAt ?? {}) as Record<string, string>;
    if (actingAt.buscentre_id === actingBuscentreId) {
      buscentreId = actingBuscentreId;
    } else {
      return NextResponse.json({ error: "No acting access to this buscentre" }, { status: 403 });
    }
  }

  if (!buscentreId) return NextResponse.json({ error: "No buscentre assigned" }, { status: 400 });

  const buscentre = await prisma.buscentre.findUnique({
    where:  { id: buscentreId },
    select: {
      id: true, name: true, location: true,
      mc: { select: { id: true, name: true } },
    },
  });

  if (!buscentre) return NextResponse.json({ error: "Buscentre not found" }, { status: 404 });

  const cells = await prisma.cell.findMany({
    where:   { buscentreId },
    orderBy: { name: "asc" },
    include: {
      _count:    { select: { members: true, shepherds: true } },
      // Cell shepherd — include their User + the User's linked Member record (for phone)
      userRoles: {
        where:   { role: "cell_shepherd" },
        include: {
          user: {
            select: {
              id:    true,
              name:  true,
              email: true,
              // Member record linked to this user (for phone)
              member: { select: { phone: true, email: true } },
            },
          },
        },
      },
      // Shepherd slots with their identity + member record (for phone)
      shepherds: {
        orderBy: { createdAt: "asc" },
        include: {
          _count: { select: { members: true } },
          user: {
            select: {
              id: true, name: true, email: true,
              member: { select: { phone: true } },
            },
          },
          // person = Member record via Shepherd.memberId (named but not activated)
          person: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
        },
      },
    },
  });

  // Shape each cell
  const shapedCells = cells.map((cell) => {
    const csRole = cell.userRoles[0];
    const csUser = csRole?.user;

    return {
      id:       cell.id,
      name:     cell.name,
      location: cell.location,
      stats: {
        totalMembers:  cell._count.members,
        totalShepherds: cell._count.shepherds,
        occupiedSlots: cell.shepherds.filter((s) => s.user || s.person).length,
      },
      cellShepherd: csUser
        ? {
            userId: csUser.id,
            name:   csUser.name,
            email:  csUser.email,
            phone:  csUser.member?.phone ?? null,
          }
        : null,
      shepherds: cell.shepherds.map((s) => {
        const name = s.user?.name
          ?? (s.person ? `${s.person.firstName} ${s.person.lastName}` : null);
        const phone = s.user?.member?.phone ?? s.person?.phone ?? null;
        const email = s.user?.email ?? s.person?.email ?? null;
        return {
          id:          s.id,
          name,
          phone,
          email,
          memberCount: s._count.members,
          isOccupied:  !!(s.user || s.person),
          hasLogin:    !!s.user,
        };
      }),
    };
  });

  return NextResponse.json({ buscentre, cells: shapedCells });
}
