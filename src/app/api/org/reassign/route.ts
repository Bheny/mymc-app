import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Scope fields each role uses; all others are cleared on reassignment.
const ROLE_SCOPE: Record<string, Partial<Record<"branchId" | "mcId" | "buscentreId" | "cellId" | "shepherdId", string | null>>> = {
  chief_shepherd: { mcId: null, buscentreId: null, cellId: null, shepherdId: null },
  mc_pastor:      { buscentreId: null, cellId: null, shepherdId: null },
  buscentre_head: { cellId: null, shepherdId: null },
  cell_shepherd:  { shepherdId: null },
  admin:          { mcId: null, buscentreId: null, cellId: null, shepherdId: null },
};

/**
 * POST — permanently reassign an existing user to a new role + scope.
 * Body: { userId, role, branchId?, mcId?, buscentreId?, cellId? }
 *
 * Clears scope fields that are not relevant to the new role so the record
 * stays clean (e.g. an mc_pastor promoted to chief_shepherd loses their mcId).
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const callerRole = session.user.role;
  if (callerRole !== "admin" && callerRole !== "chief_shepherd") {
    return NextResponse.json({ error: "Only admins and chief shepherds can reassign roles" }, { status: 403 });
  }

  const { userId, role, branchId, mcId, buscentreId, cellId } = await request.json();

  if (!userId || !role) {
    return NextResponse.json({ error: "userId and role are required" }, { status: 400 });
  }

  const existing = await prisma.userRole.findUnique({ where: { userId } });
  if (!existing) {
    return NextResponse.json({ error: "User has no role record — use Activate Member instead" }, { status: 404 });
  }

  const clearFields = ROLE_SCOPE[role] ?? {};

  await prisma.userRole.update({
    where: { userId },
    data: {
      role:        role as never,
      branchId:    branchId    ?? null,
      mcId:        mcId        ?? null,
      buscentreId: buscentreId ?? null,
      cellId:      cellId      ?? null,
      ...clearFields,
      // Clear acting state — a permanent reassignment supersedes any acting role
      actingAs: [],
      actingAt: {},
    },
  });

  // Resolve any open acting-up flags for this user (they now have a permanent role)
  await prisma.actingUpFlag.updateMany({
    where: { userId, resolved: false },
    data:  { resolved: true, resolvedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
