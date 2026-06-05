import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLE_LABELS: Record<string, string> = {
  mc_pastor:      "MC Pastor",
  buscentre_head: "Buscentre Head",
  cell_shepherd:  "Cell Shepherd",
  shepherd:       "Shepherd",
  admin:          "Admin",
  chief_shepherd: "Chief Shepherd",
};

const TARGET_ROLE: Record<string, string> = {
  branch:    "chief_shepherd",
  mc:        "mc_pastor",
  buscentre: "buscentre_head",
  cell:      "cell_shepherd",
};

const SCOPE_FIELD: Record<string, string> = {
  branch:    "branchId",
  mc:        "mcId",
  buscentre: "buscentreId",
  cell:      "cellId",
};

const ACTING_AT_KEY: Record<string, string> = {
  branch:    "branch_id",
  mc:        "mc_id",
  buscentre: "buscentre_id",
  cell:      "cell_id",
};

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const sp       = new URL(request.url).searchParams;
  const nodeType = sp.get("nodeType");   // "mc" | "buscentre" | "cell"
  const nodeId   = sp.get("nodeId");

  if (!nodeType || !nodeId) {
    return NextResponse.json({ error: "nodeType and nodeId required" }, { status: 400 });
  }

  const targetRole  = TARGET_ROLE[nodeType];
  const scopeField  = SCOPE_FIELD[nodeType];
  const actingAtKey = ACTING_AT_KEY[nodeType];

  if (!targetRole) return NextResponse.json({ head: null });

  const USER_SELECT = {
    id: true, name: true, email: true,
    role: { select: { role: true } },
  };

  // 1. Permanent head
  const permanent = await prisma.userRole.findFirst({
    where:  { role: targetRole as never, [scopeField]: nodeId },
    select: { user: { select: USER_SELECT } },
  });

  if (permanent?.user) {
    return NextResponse.json({
      head: {
        userId:      permanent.user.id,
        name:        permanent.user.name,
        email:       permanent.user.email,
        primaryRole: ROLE_LABELS[permanent.user.role?.role ?? ""] ?? permanent.user.role?.role ?? "—",
        isActing:    false,
      },
    });
  }

  // 2. Acting head
  const actingCandidates = await prisma.userRole.findMany({
    where:  { actingAs: { has: targetRole } },
    select: { actingAt: true, user: { select: USER_SELECT } },
  });

  for (const c of actingCandidates) {
    const at = (c.actingAt ?? {}) as Record<string, string>;
    if (at[actingAtKey] === nodeId && c.user) {
      return NextResponse.json({
        head: {
          userId:      c.user.id,
          name:        c.user.name,
          email:       c.user.email,
          primaryRole: ROLE_LABELS[c.user.role?.role ?? ""] ?? c.user.role?.role ?? "—",
          isActing:    true,
        },
      });
    }
  }

  return NextResponse.json({ head: null });
}
