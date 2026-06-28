import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findRoleHolder, type RoleHolder } from "@/lib/leadership";

const ROLE_LABELS: Record<string, string> = {
  admin:          "Admin",
  chief_shepherd: "Chief Shepherd",
  mc_pastor:      "MC Pastor",
  buscentre_head: "Buscentre Head",
  cell_shepherd:  "Cell Shepherd",
  shepherd:       "Shepherd",
};

type UserRow = RoleHolder;

function buildEntry(
  roleKey: string,
  scope: string | null,
  user: UserRow | null,
  isActing = false
) {
  return {
    id:        user?.id   ?? null,
    name:      user?.name ?? null,
    email:     user?.email ?? null,
    rank:      user?.rank  ?? null,
    phone:     user?.member?.phone ?? null,
    roleLabel: ROLE_LABELS[roleKey] ?? roleKey,
    roleKey,
    scope,
    vacant:    !user,
    isActing,
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const myRole = await prisma.userRole.findUnique({
    where:  { userId: session.user.id },
    select: { role: true, cellId: true, buscentreId: true, mcId: true, branchId: true },
  });

  if (!myRole) return NextResponse.json({ chain: [] });

  const chain: ReturnType<typeof buildEntry>[] = [];

  const cellId    = myRole.cellId;
  let buscentreId = myRole.buscentreId;
  let mcId        = myRole.mcId;
  let branchId    = myRole.branchId;

  // ── Shepherd → Cell Shepherd of their cell ────────────────────────────────
  if (myRole.role === "shepherd" && cellId) {
    const cell = await prisma.cell.findUnique({
      where:  { id: cellId },
      select: { name: true, buscentreId: true },
    });
    buscentreId = cell?.buscentreId ?? buscentreId;

    const user = await findRoleHolder("cell_shepherd", "cellId", cellId);
    chain.push(buildEntry("cell_shepherd", cell?.name ?? null, user));
  }

  // ── Resolve buscentreId from cell ─────────────────────────────────────────
  if (cellId && !buscentreId) {
    const cell = await prisma.cell.findUnique({ where: { id: cellId }, select: { buscentreId: true } });
    buscentreId = cell?.buscentreId ?? null;
  }

  // ── → Buscentre Head ──────────────────────────────────────────────────────
  if (buscentreId && myRole.role !== "buscentre_head") {
    const bc = await prisma.buscentre.findUnique({
      where:  { id: buscentreId },
      select: { name: true, mcId: true },
    });
    mcId = bc?.mcId ?? mcId;

    const user = await findRoleHolder("buscentre_head", "buscentreId", buscentreId);
    chain.push(buildEntry("buscentre_head", bc?.name ?? null, user));
  }

  // ── Resolve mcId from buscentre ───────────────────────────────────────────
  if (buscentreId && !mcId) {
    const bc = await prisma.buscentre.findUnique({ where: { id: buscentreId }, select: { mcId: true } });
    mcId = bc?.mcId ?? null;
  }

  // ── → MC Pastor ───────────────────────────────────────────────────────────
  if (mcId && myRole.role !== "mc_pastor") {
    const mc = await prisma.megaChurch.findUnique({
      where:  { id: mcId },
      select: { name: true, branchId: true },
    });
    branchId = mc?.branchId ?? branchId;

    const user = await findRoleHolder("mc_pastor", "mcId", mcId);
    chain.push(buildEntry("mc_pastor", mc?.name ?? null, user));
  }

  // ── Resolve branchId from MC ──────────────────────────────────────────────
  if (mcId && !branchId) {
    const mc = await prisma.megaChurch.findUnique({ where: { id: mcId }, select: { branchId: true } });
    branchId = mc?.branchId ?? null;
  }

  // ── → Chief Shepherd ─────────────────────────────────────────────────────
  if (branchId && myRole.role !== "chief_shepherd") {
    const branch = await prisma.branch.findUnique({
      where:  { id: branchId },
      select: { name: true },
    });

    const user = await findRoleHolder("chief_shepherd", "branchId", branchId);
    chain.push(buildEntry("chief_shepherd", branch?.name ?? null, user));
  }

  return NextResponse.json({ chain });
}
