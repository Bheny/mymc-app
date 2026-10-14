// Who may reset whose password. Client-safe and pure — the server enforces it, the UI
// uses the cheap role check to decide whether to show the button.
//
// Rule: you can reset the password of someone strictly BELOW your role, and inside
// your own scope (an MC pastor can reset people in their own MC, not another MC's).
// This mirrors who is allowed to activate whom. You can't reset your own password
// this way (use Change password), and admins are the only ones who can reset someone
// who has no role at all (e.g. a leader who was stood down).

export const RESET_ROLE_ORDER = [
  "admin", "chief_shepherd", "mc_pastor", "buscentre_head", "cell_shepherd", "shepherd",
] as const;

const rank = (role: string | null | undefined) => {
  const i = RESET_ROLE_ORDER.indexOf(role as (typeof RESET_ROLE_ORDER)[number]);
  return i === -1 ? null : i;
};

export type ResetParty = {
  id?:          string;
  role?:        string | null;
  branchId?:    string | null;
  mcId?:        string | null;
  buscentreId?: string | null;
  cellId?:      string | null;
};

export type ResetVerdict = { ok: true } | { ok: false; reason: string };

/** Cheap check for the UI: is the target's role below the viewer's? (Scope is checked on the server.) */
export function isBelowRole(viewerRole: string | null | undefined, targetRole: string | null | undefined): boolean {
  const [v, t] = [rank(viewerRole), rank(targetRole)];
  return v !== null && t !== null && v < t;
}

export function canResetPassword(caller: ResetParty, target: ResetParty): ResetVerdict {
  if (caller.id && caller.id === target.id) {
    return { ok: false, reason: "Use Change password for your own account." };
  }
  const c = rank(caller.role);
  if (c === null) return { ok: false, reason: "You don't have permission to reset passwords." };
  if (caller.role === "admin") return { ok: true };

  const t = rank(target.role);
  if (t === null) return { ok: false, reason: "Only an admin can reset someone who has no role." };
  if (c >= t) return { ok: false, reason: "You can only reset passwords for people below your role." };

  const same = (a?: string | null, b?: string | null) => !!a && a === b;
  const inScope =
    caller.role === "chief_shepherd" ? same(caller.branchId, target.branchId) :
    caller.role === "mc_pastor"      ? same(caller.mcId, target.mcId) :
    caller.role === "buscentre_head" ? same(caller.buscentreId, target.buscentreId) :
    caller.role === "cell_shepherd"  ? same(caller.cellId, target.cellId) :
    false;
  return inScope ? { ok: true } : { ok: false, reason: "That person isn't in your branch, MC, buscentre or cell." };
}
