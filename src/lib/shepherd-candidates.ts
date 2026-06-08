import { Prisma } from "@prisma/client";
import { roleRank } from "@/lib/permissions";

export type ScopeUser = {
  role?:        string | null;
  branchId?:    string | null;
  mcId?:        string | null;
  buscentreId?: string | null;
  cellId?:      string | null;
};

export type CandidateCell = {
  id:          string;
  buscentreId: string;
  buscentre:   { mcId: string; mc: { branchId: string } };
};

export const CANDIDATE_CELL_SELECT = {
  id: true, buscentreId: true,
  buscentre: { select: { mcId: true, mc: { select: { branchId: true } } } },
} as const;

// Does this user's scope cover the given cell? (used both for visibility and for
// permission checks — if you can't see it, you can't act on it either)
export function scopeContainsCell(user: ScopeUser, cell: CandidateCell): boolean {
  switch (user.role) {
    case "admin":          return true;
    case "chief_shepherd": return !!user.branchId    && cell.buscentre.mc.branchId === user.branchId;
    case "mc_pastor":      return !!user.mcId        && cell.buscentre.mcId        === user.mcId;
    case "buscentre_head": return !!user.buscentreId && cell.buscentreId           === user.buscentreId;
    case "cell_shepherd":  return !!user.cellId      && cell.id                    === user.cellId;
    default:               return false;
  }
}

// "Anyone above in the chain of command" — outranks a cell shepherd AND oversees the cell.
export function canCertify(user: ScopeUser, cell: CandidateCell): boolean {
  if (!user.role || roleRank(user.role as never) >= roleRank("cell_shepherd")) return false;
  return scopeContainsCell(user, cell);
}

// Prisma where-clause restricting candidates to what this user is allowed to see.
export function candidateScopeWhere(user: ScopeUser): Prisma.ShepherdCandidateWhereInput {
  switch (user.role) {
    case "admin":
      return {};
    case "chief_shepherd":
      return user.branchId ? { cell: { buscentre: { mc: { branchId: user.branchId } } } } : { id: "__none__" };
    case "mc_pastor":
      return user.mcId ? { cell: { buscentre: { mcId: user.mcId } } } : { id: "__none__" };
    case "buscentre_head":
      return user.buscentreId ? { cell: { buscentreId: user.buscentreId } } : { id: "__none__" };
    case "cell_shepherd":
      return user.cellId ? { cellId: user.cellId } : { id: "__none__" };
    default:
      return { id: "__none__" };
  }
}
