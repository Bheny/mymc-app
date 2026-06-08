import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { combine, snapshotsForFilter, groupRows, type CellSnap, type LevelRow } from "@/lib/attendance-overview";

type Level = { key: string; label: string; rows: LevelRow[] };

function resolveActing(
  searchParams: URLSearchParams,
  actingAt: Record<string, string>,
  paramName: string,
  actingKey: string,
  fallback: string | null | undefined,
): { id: string | null; ok: boolean } {
  const acting = searchParams.get(paramName);
  if (!acting) return { id: fallback ?? null, ok: true };
  if (actingAt[actingKey] === acting) return { id: acting, ok: true };
  return { id: null, ok: false };
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const role = session.user.role;
  const { searchParams } = new URL(request.url);
  const actingAt = (session.user.actingAt ?? {}) as Record<string, string>;

  let scopeName: string;
  let cellWhere: Prisma.CellWhereInput;
  let byBranch = false;

  if (role === "chief_shepherd") {
    const r = resolveActing(searchParams, actingAt, "actingBranchId", "branch_id", session.user.branchId);
    if (!r.ok)  return NextResponse.json({ error: "No acting access to this branch" }, { status: 403 });
    if (!r.id)  return NextResponse.json({ error: "No branch assigned" }, { status: 400 });
    cellWhere = { buscentre: { mc: { branchId: r.id } } };
    scopeName = (await prisma.branch.findUnique({ where: { id: r.id }, select: { name: true } }))?.name ?? "Branch";
  } else if (role === "admin") {
    cellWhere = {};
    scopeName = "All branches";
    byBranch  = true;
  } else {
    return NextResponse.json({ error: "Attendance drill-down is not available for this role" }, { status: 403 });
  }

  const cellSnaps = await snapshotsForFilter(cellWhere);

  const levels: Level[] = [];
  if (byBranch) {
    levels.push({
      key: "branch", label: "By branch",
      rows: groupRows(cellSnaps, (s: CellSnap) => ({ id: s.branchId, name: s.branchName })),
    });
  }
  levels.push({
    key: "mc", label: "By mega church",
    rows: groupRows(cellSnaps, (s: CellSnap) => ({ id: s.mcId, name: s.mcName })),
  });
  levels.push({
    key: "buscentre", label: "By buscentre",
    rows: groupRows(cellSnaps, (s: CellSnap) => ({ id: s.buscentreId, name: s.buscentreName })),
  });
  levels.push({
    key: "cell", label: "By cell",
    rows: cellSnaps.map((s) => ({ id: s.id, name: s.name, lcLive: s.lcLive, mgs: s.mgs })),
  });

  return NextResponse.json({
    scopeName,
    total: {
      lcLive: combine(cellSnaps.map((s) => s.lcLive)),
      mgs:    combine(cellSnaps.map((s) => s.mgs)),
    },
    levels,
  });
}
