import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assignActingUp, ACTING_UP_ALLOWED } from "@/lib/acting-up";
import { Role } from "@prisma/client";

/**
 * POST — assign a user an acting-up role for a specific node.
 * Body: { userId, actingAs, nodeType, nodeId, nodeName }
 *
 * DELETE — remove an acting role from a user.
 * Body: { userId, actingAs, nodeId }
 */

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { userId, actingAs, nodeType, nodeId, nodeName } = await request.json();

  if (!userId || !actingAs || !nodeType || !nodeId || !nodeName) {
    return NextResponse.json({ error: "userId, actingAs, nodeType, nodeId and nodeName are required" }, { status: 400 });
  }

  // Fetch the user being assigned and verify they have a higher role
  const userRole = await prisma.userRole.findUnique({
    where:  { userId },
    select: { role: true, userId: true },
  });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

  if (!userRole || !user) {
    return NextResponse.json({ error: "User or role not found" }, { status: 404 });
  }

  // Validate this role is allowed to act in the target role
  const allowed = ACTING_UP_ALLOWED[userRole.role as Role] ?? [];
  if (!allowed.includes(actingAs as Role)) {
    return NextResponse.json(
      { error: `A ${userRole.role} is not permitted to act as ${actingAs}` },
      { status: 403 }
    );
  }

  const result = await assignActingUp({
    userId,
    userName:  user.name ?? userId,
    realRole:  userRole.role,
    actingAs:  actingAs as Role,
    nodeId,
    nodeType,
    nodeName,
  });

  return NextResponse.json({ success: true, ...result });
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { userId, actingAs, nodeId } = await request.json();

  const current = await prisma.userRole.findUnique({
    where:  { userId },
    select: { actingAs: true, actingAt: true },
  });
  if (!current) return NextResponse.json({ error: "User role not found" }, { status: 404 });

  // Remove the role from actingAs
  const newActingAs = (current.actingAs ?? []).filter((r) => r !== actingAs);

  // Remove the corresponding key from actingAt
  const actingAt = { ...((current.actingAt as Record<string, string>) ?? {}) };
  const scopeKeyMap: Record<string, string> = {
    cell_shepherd:  "cell_id",
    buscentre_head: "buscentre_id",
    mc_pastor:      "mc_id",
  };
  const scopeKey = scopeKeyMap[actingAs];
  if (scopeKey && actingAt[scopeKey] === nodeId) delete actingAt[scopeKey];

  await prisma.userRole.update({
    where: { userId },
    data:  { actingAs: newActingAs, actingAt },
  });

  // Resolve the related ActingUpFlag
  await prisma.actingUpFlag.updateMany({
    where:    { userId, actingAs, nodeId, resolved: false },
    data:     { resolved: true, resolvedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
