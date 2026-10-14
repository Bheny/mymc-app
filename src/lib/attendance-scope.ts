import { Prisma } from "@prisma/client";

// Which cells a signed-in user's attendance views cover — the same rules as
// /api/attendance/overview, in one place for the history endpoint.

export type AttendanceLevel = "cell" | "buscentre" | "mc" | "branch" | "global";

export type AttendanceScope =
  | { error: string; status: 400 | 403 }
  | { level: AttendanceLevel; scopeId: string | null; cellWhere: Prisma.CellWhereInput };

type SessionUser = {
  role?: string | null; cellId?: string | null; buscentreId?: string | null; mcId?: string | null; branchId?: string | null;
  actingAt?: Record<string, string> | null;
};

// An acting-up param is honoured only if the user really is acting at that node
function pick(sp: URLSearchParams, param: string, actingKey: string, user: SessionUser, own: string | null | undefined) {
  const acting = sp.get(param);
  if (!acting) return { id: own ?? null, ok: true };
  return (user.actingAt ?? {})[actingKey] === acting ? { id: acting, ok: true } : { id: null, ok: false };
}

export function resolveAttendanceScope(user: SessionUser, sp: URLSearchParams): AttendanceScope {
  switch (user.role) {
    case "cell_shepherd":
    case "shepherd": {
      const r = pick(sp, "actingCellId", "cell_id", user, user.cellId);
      if (!r.ok)  return { error: "No acting access to this cell", status: 403 };
      if (!r.id)  return { error: "No cell assigned", status: 400 };
      return { level: "cell", scopeId: r.id, cellWhere: { id: r.id } };
    }
    case "buscentre_head": {
      const r = pick(sp, "actingBuscentreId", "buscentre_id", user, user.buscentreId);
      if (!r.ok)  return { error: "No acting access to this buscentre", status: 403 };
      if (!r.id)  return { error: "No buscentre assigned", status: 400 };
      return { level: "buscentre", scopeId: r.id, cellWhere: { buscentreId: r.id } };
    }
    case "mc_pastor": {
      const r = pick(sp, "actingMcId", "mc_id", user, user.mcId);
      if (!r.ok)  return { error: "No acting access to this mega church", status: 403 };
      if (!r.id)  return { error: "No mega church assigned", status: 400 };
      return { level: "mc", scopeId: r.id, cellWhere: { buscentre: { mcId: r.id } } };
    }
    case "chief_shepherd": {
      const r = pick(sp, "actingBranchId", "branch_id", user, user.branchId);
      if (!r.ok)  return { error: "No acting access to this branch", status: 403 };
      if (!r.id)  return { error: "No branch assigned", status: 400 };
      return { level: "branch", scopeId: r.id, cellWhere: { buscentre: { mc: { branchId: r.id } } } };
    }
    case "admin":
      return { level: "global", scopeId: null, cellWhere: {} };
    default:
      return { error: "Attendance is not available for this role", status: 403 };
  }
}

/** Which outreach contacts belong to this scope, using the placement every contact carries */
export function contactWhereForScope(scope: { level: AttendanceLevel; scopeId: string | null }): Prisma.ContactWhereInput {
  switch (scope.level) {
    case "cell":      return { cellId: scope.scopeId! };
    case "buscentre": return { buscentreId: scope.scopeId! };
    case "mc":        return { mcId: scope.scopeId! };
    case "branch":    return { branchId: scope.scopeId! };
    default:          return {};
  }
}
