import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const sp = new URL(request.url).searchParams;
  const actingBuscentreId = sp.get("actingBuscentreId");
  const actingCellId      = sp.get("actingCellId");

  const { role } = session.user;
  let cellId      = session.user.cellId      ?? null;
  let buscentreId = session.user.buscentreId ?? null;
  const mcId      = session.user.mcId        ?? null;
  const branchId  = session.user.branchId    ?? null;

  // Apply acting overrides — validate fresh from DB so stale JWTs don't block acting users
  if (actingBuscentreId || actingCellId) {
    const freshRole = await prisma.userRole.findUnique({
      where:  { userId: session.user.id },
      select: { actingAt: true },
    });
    const actingAt = (freshRole?.actingAt ?? {}) as Record<string, string>;
    if (actingBuscentreId && actingAt.buscentre_id === actingBuscentreId) {
      buscentreId = actingBuscentreId;
      cellId      = null;
    } else if (actingCellId && actingAt.cell_id === actingCellId) {
      cellId = actingCellId;
    }
  }

  // Traverse from narrowest scope upward
  if (cellId) {
    const cell = await prisma.cell.findUnique({
      where: { id: cellId },
      select: {
        id: true, name: true,
        buscentre: {
          select: {
            id: true, name: true,
            mc: {
              select: {
                id: true, name: true,
                branch: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      role,
      cell:      cell ? { id: cell.id, name: cell.name } : null,
      buscentre: cell?.buscentre ? { id: cell.buscentre.id, name: cell.buscentre.name } : null,
      mc:        cell?.buscentre?.mc ? { id: cell.buscentre.mc.id, name: cell.buscentre.mc.name } : null,
      branch:    cell?.buscentre?.mc?.branch ?? null,
    });
  }

  if (buscentreId) {
    const bc = await prisma.buscentre.findUnique({
      where: { id: buscentreId },
      select: {
        id: true, name: true,
        mc: {
          select: {
            id: true, name: true,
            branch: { select: { id: true, name: true } },
          },
        },
      },
    });
    return NextResponse.json({
      role,
      cell:      null,
      buscentre: bc ? { id: bc.id, name: bc.name } : null,
      mc:        bc?.mc ?? null,
      branch:    bc?.mc?.branch ?? null,
    });
  }

  if (mcId) {
    const mc = await prisma.megaChurch.findUnique({
      where: { id: mcId },
      select: {
        id: true, name: true,
        branch: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({
      role, cell: null, buscentre: null,
      mc:     mc ? { id: mc.id, name: mc.name } : null,
      branch: mc?.branch ?? null,
    });
  }

  if (branchId) {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId }, select: { id: true, name: true },
    });
    return NextResponse.json({
      role, cell: null, buscentre: null, mc: null,
      branch: branch ?? null,
    });
  }

  return NextResponse.json({ role, cell: null, buscentre: null, mc: null, branch: null });
}
