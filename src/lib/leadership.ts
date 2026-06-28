import { prisma } from "@/lib/prisma";

// ─── Role-holder resolution ───────────────────────────────────────────────────
// Find whoever currently holds a pastoral role at a given scope — permanent
// UserRole first, then falling back to acting-up coverage (actingAs/actingAt).
// Moved here from src/app/api/me/leaders/route.ts so it has one home instead
// of being reimplemented per route.

export type ScopeKey = "cellId" | "buscentreId" | "mcId" | "branchId";

const USER_SELECT = {
  id:    true,
  name:  true,
  email: true,
  rank:  true,
  member: { select: { phone: true } },
} as const;

export type RoleHolder = {
  id: string; name: string | null; email: string;
  rank: string | null; member: { phone: string | null } | null;
};

const ACTING_AT_KEY: Record<ScopeKey, string> = {
  cellId:      "cell_id",
  buscentreId: "buscentre_id",
  mcId:        "mc_id",
  branchId:    "branch_id",
};

export async function findRoleHolder(
  role: string,
  scopeKey: ScopeKey,
  scopeId: string
): Promise<RoleHolder | null> {
  const permanent = await prisma.userRole.findFirst({
    where:  { role: role as never, [scopeKey]: scopeId },
    select: { user: { select: USER_SELECT } },
  });
  if (permanent?.user) return permanent.user as RoleHolder;

  const jsonKey = ACTING_AT_KEY[scopeKey];
  const actingCandidates = await prisma.userRole.findMany({
    where:  { actingAs: { has: role } },
    select: { actingAt: true, user: { select: USER_SELECT } },
  });

  for (const candidate of actingCandidates) {
    const at = (candidate.actingAt ?? {}) as Record<string, string>;
    if (at[jsonKey] === scopeId && candidate.user) return candidate.user as RoleHolder;
  }

  return null;
}

// ─── Member oversight fallback ────────────────────────────────────────────────
// A member's "effective shepherd": their direct shepherd if assigned, otherwise
// whoever currently leads the level the member sits at directly (Cell Shepherd /
// Buscentre Head / MC Pastor) — skipping a level if it would just resolve back
// to the member themselves, and walking up further in that case.

export type MemberForShepherdResolution = {
  userId:      string | null;
  shepherdId:  string | null;
  shepherd: {
    user:   { id: string; name: string | null } | null;
    person: { firstName: string; lastName: string } | null;
  } | null;
  cellId:      string | null;
  buscentreId: string | null;
  mcId:        string | null;
};

function shepherdSlotName(shepherd: NonNullable<MemberForShepherdResolution["shepherd"]>): string {
  if (shepherd.user?.name) return shepherd.user.name;
  if (shepherd.person)     return `${shepherd.person.firstName} ${shepherd.person.lastName}`;
  return "Unassigned";
}

export async function resolveMemberShepherdName(member: MemberForShepherdResolution): Promise<string> {
  if (member.shepherdId && member.shepherd) return shepherdSlotName(member.shepherd);

  const cellId    = member.cellId;
  let buscentreId = member.buscentreId;
  let mcId        = member.mcId;

  if (cellId) {
    const holder = await findRoleHolder("cell_shepherd", "cellId", cellId);
    if (holder && holder.id !== member.userId) return holder.name ?? "Unassigned";
    const cell = await prisma.cell.findUnique({ where: { id: cellId }, select: { buscentreId: true } });
    buscentreId = cell?.buscentreId ?? buscentreId;
  }

  if (buscentreId) {
    const holder = await findRoleHolder("buscentre_head", "buscentreId", buscentreId);
    if (holder && holder.id !== member.userId) return holder.name ?? "Unassigned";
    const bc = await prisma.buscentre.findUnique({ where: { id: buscentreId }, select: { mcId: true } });
    mcId = bc?.mcId ?? mcId;
  }

  if (mcId) {
    const holder = await findRoleHolder("mc_pastor", "mcId", mcId);
    if (holder && holder.id !== member.userId) return holder.name ?? "Unassigned";
  }

  return "Unassigned";
}

// ─── Batched version for list views ───────────────────────────────────────────
// Same resolution, but precomputes every role holder + parent id for a whole
// branch in a fixed handful of queries, so resolving N members costs O(1)
// lookups each instead of N role-holder round trips.

type SimpleHolder = { id: string; name: string | null };

export type LeadershipIndex = {
  cellShepherds:   Map<string, SimpleHolder>;
  buscentreHeads:  Map<string, SimpleHolder>;
  mcPastors:       Map<string, SimpleHolder>;
  cellToBuscentre: Map<string, string | null>;
  buscentreToMc:   Map<string, string | null>;
};

export async function buildLeadershipIndex(branchId: string): Promise<LeadershipIndex> {
  const ROLES = ["cell_shepherd", "buscentre_head", "mc_pastor"] as const;

  const [permanentRoles, actingRoles, cells, buscentres] = await Promise.all([
    prisma.userRole.findMany({
      where:  { branchId, role: { in: ROLES as unknown as never[] } },
      select: { role: true, cellId: true, buscentreId: true, mcId: true, user: { select: { id: true, name: true } } },
    }),
    prisma.userRole.findMany({
      where:  { actingAs: { hasSome: ROLES as unknown as string[] } },
      select: { actingAs: true, actingAt: true, user: { select: { id: true, name: true } } },
    }),
    prisma.cell.findMany({ where: { buscentre: { mc: { branchId } } }, select: { id: true, buscentreId: true } }),
    prisma.buscentre.findMany({ where: { mc: { branchId } }, select: { id: true, mcId: true } }),
  ]);

  const cellShepherds  = new Map<string, SimpleHolder>();
  const buscentreHeads = new Map<string, SimpleHolder>();
  const mcPastors      = new Map<string, SimpleHolder>();

  for (const r of permanentRoles) {
    if (!r.user) continue;
    if (r.role === "cell_shepherd"  && r.cellId)      cellShepherds.set(r.cellId, r.user);
    if (r.role === "buscentre_head" && r.buscentreId) buscentreHeads.set(r.buscentreId, r.user);
    if (r.role === "mc_pastor"      && r.mcId)        mcPastors.set(r.mcId, r.user);
  }

  // Acting coverage fills in only where there's no permanent holder.
  for (const r of actingRoles) {
    if (!r.user) continue;
    const at = (r.actingAt ?? {}) as Record<string, string>;
    if (r.actingAs.includes("cell_shepherd")  && at.cell_id      && !cellShepherds.has(at.cell_id))      cellShepherds.set(at.cell_id, r.user);
    if (r.actingAs.includes("buscentre_head") && at.buscentre_id && !buscentreHeads.has(at.buscentre_id)) buscentreHeads.set(at.buscentre_id, r.user);
    if (r.actingAs.includes("mc_pastor")      && at.mc_id        && !mcPastors.has(at.mc_id))            mcPastors.set(at.mc_id, r.user);
  }

  return {
    cellShepherds, buscentreHeads, mcPastors,
    cellToBuscentre: new Map(cells.map((c) => [c.id, c.buscentreId])),
    buscentreToMc:   new Map(buscentres.map((b) => [b.id, b.mcId])),
  };
}

export function resolveFromIndex(member: MemberForShepherdResolution, index: LeadershipIndex): string {
  if (member.shepherdId && member.shepherd) return shepherdSlotName(member.shepherd);

  const cellId    = member.cellId;
  let buscentreId = member.buscentreId;
  let mcId        = member.mcId;

  if (cellId) {
    const holder = index.cellShepherds.get(cellId);
    if (holder && holder.id !== member.userId) return holder.name ?? "Unassigned";
    buscentreId = index.cellToBuscentre.get(cellId) ?? buscentreId;
  }

  if (buscentreId) {
    const holder = index.buscentreHeads.get(buscentreId);
    if (holder && holder.id !== member.userId) return holder.name ?? "Unassigned";
    mcId = index.buscentreToMc.get(buscentreId) ?? mcId;
  }

  if (mcId) {
    const holder = index.mcPastors.get(mcId);
    if (holder && holder.id !== member.userId) return holder.name ?? "Unassigned";
  }

  return "Unassigned";
}
