import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const mc = await prisma.megaChurch.findUnique({
    where: { id: params.id },
    include: {
      branch:    { select: { id: true, name: true } },
      userRoles: {
        where:   { role: "mc_pastor" },
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      _count: { select: { buscentres: true } },
    },
  });

  if (!mc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(mc);
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await request.json();
  const { name, branchId, assignedPastorUserId } = body;

  // Fetch the MC first so we have branchId for the role scope
  const mc = await prisma.megaChurch.findUnique({
    where: { id: params.id },
    select: { branchId: true },
  });
  if (!mc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ── Pastor assignment ──────────────────────────────────────────────────────
  if (assignedPastorUserId !== undefined) {
    if (assignedPastorUserId === null) {
      // Remove the current mc_pastor for this MC without deleting their User record
      await prisma.userRole.deleteMany({
        where: { mcId: params.id, role: "mc_pastor" },
      });
    } else {
      // Verify user exists
      const pastor = await prisma.user.findUnique({ where: { id: assignedPastorUserId } });
      if (!pastor) return NextResponse.json({ error: "User not found" }, { status: 404 });

      // Remove whoever was previously mc_pastor for this MC
      await prisma.userRole.deleteMany({
        where: { mcId: params.id, role: "mc_pastor" },
      });

      // Upsert the new pastor's UserRole
      await prisma.userRole.upsert({
        where:  { userId: assignedPastorUserId },
        update: { role: "mc_pastor", branchId: mc.branchId, mcId: params.id,
                  buscentreId: null, cellId: null, shepherdId: null },
        create: { userId: assignedPastorUserId, role: "mc_pastor",
                  branchId: mc.branchId, mcId: params.id },
      });
    }
  }

  // ── Name / branch update ───────────────────────────────────────────────────
  const updated = await prisma.megaChurch.update({
    where: { id: params.id },
    data: {
      ...(name     ? { name }     : {}),
      ...(branchId ? { branchId } : {}),
    },
    include: {
      branch:    { select: { id: true, name: true } },
      userRoles: {
        where:   { role: "mc_pastor" },
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  await prisma.megaChurch.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
