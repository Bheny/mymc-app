import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkCapacity, logCapacityWarning } from "@/lib/capacity";
import { canMoveBuscentre } from "@/lib/org-scope";

type Params = { params: { id: string } };

const MC_SELECT = { id: true, name: true, branchId: true } as const;

/**
 * POST — move a buscentre (with all its cells and everything under them)
 * to a different MegaChurch in the same branch.
 * Body: { mcId }
 *
 * Cells hang off buscentreId, so they follow automatically. UserRole rows for
 * the buscentre head and every cell shepherd / shepherd beneath carry a
 * denormalised mcId, which is rewritten here.
 */
export async function POST(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { mcId } = await request.json();
  if (!mcId) return NextResponse.json({ error: "mcId is required" }, { status: 400 });

  const bc = await prisma.buscentre.findUnique({
    where:  { id: params.id },
    select: { id: true, name: true, mc: { select: MC_SELECT } },
  });
  if (!bc) return NextResponse.json({ error: "Buscentre not found" }, { status: 404 });

  const from = bc.mc;
  if (from.id === mcId) {
    return NextResponse.json({ error: `${bc.name} is already in ${from.name}` }, { status: 400 });
  }

  const to = await prisma.megaChurch.findUnique({ where: { id: mcId }, select: MC_SELECT });
  if (!to) return NextResponse.json({ error: "Destination MC not found" }, { status: 404 });

  if (from.branchId !== to.branchId) {
    return NextResponse.json({ error: "Buscentres can only be moved within the same branch" }, { status: 400 });
  }

  if (!canMoveBuscentre(session.user, from, to)) {
    return NextResponse.json({ error: "You're not permitted to move this buscentre" }, { status: 403 });
  }

  const cap = await checkCapacity("buscentre", to.id);
  if (cap.blocked) {
    return NextResponse.json(
      { error: `${to.name} already has the maximum of ${cap.max} buscentres` },
      { status: 409 }
    );
  }

  const [, rolesUpdated] = await prisma.$transaction([
    prisma.buscentre.update({ where: { id: bc.id }, data: { mcId: to.id } }),
    prisma.userRole.updateMany({
      where: { buscentreId: bc.id },
      data:  { mcId: to.id },
    }),
  ]);

  if (cap.atCapacity) {
    await logCapacityWarning({
      level: "buscentre", parentId: to.id, parentName: to.name,
      count: cap.count + 1, createdById: session.user.id,
    });
  }

  // The source MC may now be back within its limit
  const source = await checkCapacity("buscentre", from.id);
  if (!source.overCapacity) {
    await prisma.capacityWarning.updateMany({
      where: { level: "buscentre", parentId: from.id, resolved: false },
      data:  { resolved: true, resolvedAt: new Date() },
    });
  }

  return NextResponse.json({
    success:      true,
    from:         { id: from.id, name: from.name },
    to:           { id: to.id,   name: to.name },
    leadersMoved: rolesUpdated.count,
    ...(cap.atCapacity && {
      warning: `${to.name} is now over its buscentre limit (${cap.count + 1}/${cap.max})`,
    }),
  });
}
