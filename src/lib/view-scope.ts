import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type SessionUser = {
  cellId?:      string | null;
  buscentreId?: string | null;
  mcId?:        string | null;
  branchId?:    string | null;
};

type AuthorizeResult = { id: string | null; status: 200 | 400 | 403 };

// Mirrors the roleScope() logic already used in /api/attendance/review and
// /api/attendance/drilldown — what a role is allowed to see, generalized to
// the buscentre and cell levels for read-only dashboard drill-down.
function buscentreScope(role: string | null | undefined, user: SessionUser): Prisma.BuscentreWhereInput | null {
  switch (role) {
    case "buscentre_head": return user.buscentreId ? { id: user.buscentreId } : null;
    case "mc_pastor":      return user.mcId ? { mcId: user.mcId } : null;
    case "chief_shepherd": return user.branchId ? { mc: { branchId: user.branchId } } : null;
    case "admin":          return {};
    default:               return null;
  }
}

// Exported (unlike buscentreScope/cellScope) — also used directly by
// /api/org/mega-churches to scope its list, not just to authorize a single id.
export function mcScope(role: string | null | undefined, user: SessionUser): Prisma.MegaChurchWhereInput | null {
  switch (role) {
    case "mc_pastor":      return user.mcId ? { id: user.mcId } : null;
    case "chief_shepherd": return user.branchId ? { branchId: user.branchId } : null;
    case "admin":          return {};
    default:               return null;
  }
}

function cellScope(role: string | null | undefined, user: SessionUser): Prisma.CellWhereInput | null {
  switch (role) {
    case "cell_shepherd":
    case "shepherd":       return user.cellId ? { id: user.cellId } : null;
    case "buscentre_head": return user.buscentreId ? { buscentreId: user.buscentreId } : null;
    case "mc_pastor":      return user.mcId ? { buscentre: { mcId: user.mcId } } : null;
    case "chief_shepherd": return user.branchId ? { buscentre: { mc: { branchId: user.branchId } } } : null;
    case "admin":          return {};
    default:               return null;
  }
}

export async function authorizeBuscentreView(
  role: string | null | undefined,
  user: SessionUser,
  requestedId: string | null,
): Promise<AuthorizeResult> {
  if (!requestedId) return { id: user.buscentreId ?? null, status: user.buscentreId ? 200 : 400 };

  const scope = buscentreScope(role, user);
  if (!scope) return { id: null, status: 403 };

  const match = await prisma.buscentre.findFirst({ where: { AND: [scope, { id: requestedId }] }, select: { id: true } });
  return match ? { id: requestedId, status: 200 } : { id: null, status: 403 };
}

export async function authorizeMcView(
  role: string | null | undefined,
  user: SessionUser,
  requestedId: string | null,
): Promise<AuthorizeResult> {
  if (!requestedId) return { id: user.mcId ?? null, status: user.mcId ? 200 : 400 };

  const scope = mcScope(role, user);
  if (!scope) return { id: null, status: 403 };

  const match = await prisma.megaChurch.findFirst({ where: { AND: [scope, { id: requestedId }] }, select: { id: true } });
  return match ? { id: requestedId, status: 200 } : { id: null, status: 403 };
}

export async function authorizeCellView(
  role: string | null | undefined,
  user: SessionUser,
  requestedId: string | null,
): Promise<AuthorizeResult> {
  if (!requestedId) return { id: user.cellId ?? null, status: user.cellId ? 200 : 400 };

  const scope = cellScope(role, user);
  if (!scope) return { id: null, status: 403 };

  const match = await prisma.cell.findFirst({ where: { AND: [scope, { id: requestedId }] }, select: { id: true } });
  return match ? { id: requestedId, status: 200 } : { id: null, status: 403 };
}
