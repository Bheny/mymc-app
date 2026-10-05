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

// For head roles: the scope field identifying the node they lead, and the
// matching actingAt key used by acting-up assignments.
const HEAD_SCOPE: Record<string, { field: "branchId" | "mcId" | "buscentreId" | "cellId"; actingKey: string }> = {
  chief_shepherd: { field: "branchId",    actingKey: "branch_id" },
  mc_pastor:      { field: "mcId",        actingKey: "mc_id" },
  buscentre_head: { field: "buscentreId", actingKey: "buscentre_id" },
  cell_shepherd:  { field: "cellId",      actingKey: "cell_id" },
};

/**
 * POST — permanently reassign an existing user to a new role + scope.
 * Body: { userId, role, branchId?, mcId?, buscentreId?, cellId? }
 *
 * Clears scope fields that are not relevant to the new role so the record
 * stays clean (e.g. an mc_pastor promoted to chief_shepherd loses their mcId).
 *
 * For head roles, whoever previously led that node is stood down: their
 * UserRole is removed (they keep their login and member record and can be
 * reassigned), and anyone acting as head there stops acting.
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

  // Users without a role record (e.g. a head who was stood down) can still be
  // assigned — they just need an active login
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isActive: true, password: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!user.isActive || !user.password) {
    return NextResponse.json({ error: "User has no active login — use Activate Member instead" }, { status: 400 });
  }

  const clearFields = ROLE_SCOPE[role] ?? {};

  // ── Stand down the outgoing head of this node ──
  const head = HEAD_SCOPE[role];
  const nodeId = head ? ({ branchId, mcId, buscentreId, cellId } as Record<string, string | undefined>)[head.field] : undefined;
  const replaced: string[] = [];

  if (head && nodeId) {
    const outgoing = await prisma.userRole.findMany({
      where:  { role: role as never, [head.field]: nodeId, userId: { not: userId } },
      select: { userId: true, user: { select: { name: true, email: true } } },
    });
    if (outgoing.length) {
      await prisma.userRole.deleteMany({ where: { userId: { in: outgoing.map((o) => o.userId) } } });
      await prisma.actingUpFlag.updateMany({
        where: { userId: { in: outgoing.map((o) => o.userId) }, resolved: false },
        data:  { resolved: true, resolvedAt: new Date() },
      });
      replaced.push(...outgoing.map((o) => o.user.name ?? o.user.email));
    }

    // End any acting cover for this exact position
    const acting = await prisma.userRole.findMany({
      where:  { actingAs: { has: role }, userId: { not: userId } },
      select: { userId: true, actingAs: true, actingAt: true },
    });
    for (const a of acting) {
      const at = { ...((a.actingAt ?? {}) as Record<string, string>) };
      if (at[head.actingKey] !== nodeId) continue;
      delete at[head.actingKey];
      await prisma.userRole.update({
        where: { userId: a.userId },
        data:  { actingAs: a.actingAs.filter((r) => r !== role), actingAt: at },
      });
      await prisma.actingUpFlag.updateMany({
        where: { userId: a.userId, actingAs: role, nodeId, resolved: false },
        data:  { resolved: true, resolvedAt: new Date() },
      });
    }
  }

  const roleData = {
    role:        role as never,
    branchId:    branchId    ?? null,
    mcId:        mcId        ?? null,
    buscentreId: buscentreId ?? null,
    cellId:      cellId      ?? null,
    ...clearFields,
  };
  await prisma.userRole.upsert({
    where:  { userId },
    create: { userId, ...roleData },
    // Clear acting state — a permanent reassignment supersedes any acting role
    update: { ...roleData, actingAs: [], actingAt: {} },
  });

  // Resolve any open acting-up flags for this user (they now have a permanent role)
  await prisma.actingUpFlag.updateMany({
    where: { userId, resolved: false },
    data:  { resolved: true, resolvedAt: new Date() },
  });

  return NextResponse.json({ success: true, replaced });
}
