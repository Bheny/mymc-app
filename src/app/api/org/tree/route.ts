import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { role, branchId, mcId } = session.user;

  // Scope filter: admins/chief_shepherds see all; others see their branch/MC
  const branchFilter = (role === "admin" || role === "chief_shepherd")
    ? {}
    : branchId
    ? { id: branchId }
    : { id: "__none__" };

  const branches = await prisma.branch.findMany({
    where: branchFilter,
    include: {
      megaChurches: {
        where: mcId && role !== "admin" && role !== "chief_shepherd"
          ? { id: mcId }
          : {},
        include: {
          _count: { select: { buscentres: true } },
          buscentres: {
            include: {
              _count: { select: { cells: true } },
              cells: {
                include: {
                  _count: { select: { shepherds: true, members: true } },
                  shepherds: {
                    include: {
                      _count:  { select: { members: true } },
                      user:    { select: { id: true, name: true } },
                      person:  { select: { id: true, firstName: true, lastName: true } },
                    },
                  },
                  userRoles: {
                    where: { role: "cell_shepherd" },
                    include: { user: { select: { id: true, name: true } } },
                  },
                },
                orderBy: { name: "asc" },
              },
              userRoles: {
                where: { role: "buscentre_head" },
                include: { user: { select: { id: true, name: true } } },
              },
            },
            orderBy: { name: "asc" },
          },
          userRoles: {
            where: { role: "mc_pastor" },
            include: { user: { select: { id: true, name: true } } },
          },
        },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  // Attach open flags and warnings for the caller's scope
  const [actingUpFlags, capacityWarnings] = await Promise.all([
    prisma.actingUpFlag.findMany({
      where:   { resolved: false },
      select:  { nodeId: true, severity: true, actingAs: true, recommendation: true },
    }),
    prisma.capacityWarning.findMany({
      where:   { resolved: false },
      select:  { parentId: true, level: true, currentCount: true, maxCount: true },
    }),
  ]);

  return NextResponse.json({ branches, actingUpFlags, capacityWarnings });
}
