import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkCapacity, logCapacityWarning } from "@/lib/capacity";
import { canMoveCell } from "@/lib/org-scope";

type Params = { params: { id: string } };

const BUSCENTRE_SELECT = {
  id: true, name: true, mcId: true,
  mc: { select: { branchId: true } },
} as const;

/**
 * POST — move a cell (with its shepherds, members, services, attendance,
 * first-timers and souls) under a different buscentre.
 * Body: { buscentreId }
 *
 * Everything below the cell hangs off cellId, so it follows automatically.
 * The only denormalised copies of the parent chain are on UserRole
 * (cell_shepherd / shepherd scope), which are rewritten here.
 */
export async function POST(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { buscentreId } = await request.json();
  if (!buscentreId) return NextResponse.json({ error: "buscentreId is required" }, { status: 400 });

  const cell = await prisma.cell.findUnique({
    where:  { id: params.id },
    select: { id: true, name: true, buscentre: { select: BUSCENTRE_SELECT } },
  });
  if (!cell) return NextResponse.json({ error: "Cell not found" }, { status: 404 });

  const from = cell.buscentre;
  if (from.id === buscentreId) {
    return NextResponse.json({ error: `${cell.name} is already in ${from.name}` }, { status: 400 });
  }

  const to = await prisma.buscentre.findUnique({ where: { id: buscentreId }, select: BUSCENTRE_SELECT });
  if (!to) return NextResponse.json({ error: "Destination buscentre not found" }, { status: 404 });

  // Departments are branch-scoped, so a cross-branch move would leave members
  // in another branch's departments
  if (from.mc.branchId !== to.mc.branchId) {
    return NextResponse.json({ error: "Cells can only be moved within the same branch" }, { status: 400 });
  }

  if (!canMoveCell(session.user, from, to)) {
    return NextResponse.json({ error: "You're not permitted to move this cell there" }, { status: 403 });
  }

  const cap = await checkCapacity("cell", to.id);
  if (cap.blocked) {
    return NextResponse.json(
      { error: `${to.name} already has the maximum of ${cap.max} cells` },
      { status: 409 }
    );
  }

  const [, rolesUpdated] = await prisma.$transaction([
    prisma.cell.update({ where: { id: cell.id }, data: { buscentreId: to.id } }),
    prisma.userRole.updateMany({
      where: { cellId: cell.id },
      data:  { buscentreId: to.id, mcId: to.mcId, branchId: to.mc.branchId },
    }),
  ]);

  if (cap.atCapacity) {
    await logCapacityWarning({
      level: "cell", parentId: to.id, parentName: to.name,
      count: cap.count + 1, createdById: session.user.id,
    });
  }

  // The source buscentre may now be back within its limit
  const source = await checkCapacity("cell", from.id);
  if (!source.overCapacity) {
    await prisma.capacityWarning.updateMany({
      where: { level: "cell", parentId: from.id, resolved: false },
      data:  { resolved: true, resolvedAt: new Date() },
    });
  }

  return NextResponse.json({
    success:      true,
    from:         { id: from.id, name: from.name },
    to:           { id: to.id,   name: to.name },
    leadersMoved: rolesUpdated.count,
    ...(cap.atCapacity && {
      warning: `${to.name} is now over its cell limit (${cap.count + 1}/${cap.max})`,
    }),
  });
}
