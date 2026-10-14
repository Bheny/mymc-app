import { Prisma, ContactStage, ContactActivityType, OutreachLevel } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ─── Phone numbers ────────────────────────────────────────────────────────────
// A phone number identifies one person across the whole branch, so it is
// normalized to E.164 before being compared or stored. Local numbers (leading 0)
// are assumed to be in DEFAULT_COUNTRY_CODE.

const DEFAULT_COUNTRY_CODE = "233";

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  if (trimmed.startsWith("+"))                  return digits.length >= 8 ? `+${digits}` : null;
  if (digits.startsWith("00"))                  digits = digits.slice(2);
  else if (digits.startsWith("0"))              digits = DEFAULT_COUNTRY_CODE + digits.slice(1);
  else if (digits.length <= 9)                  digits = DEFAULT_COUNTRY_CODE + digits; // 241234567

  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
}

// ─── Who is acting ────────────────────────────────────────────────────────────

export type EvangelismUser = {
  id:          string;
  role:        string;
  branchId:    string | null;
  mcId:        string | null;
  buscentreId: string | null;
  cellId:      string | null;
};

// Scope is always resolved fresh from the DB (like /api/first-timers) so a
// reassigned leader never acts on a stale JWT.
export async function getEvangelismUser(userId: string): Promise<EvangelismUser | null> {
  const r = await prisma.userRole.findUnique({
    where:  { userId },
    select: { role: true, branchId: true, mcId: true, buscentreId: true, cellId: true },
  });
  if (!r) return null;
  return { id: userId, role: r.role, branchId: r.branchId, mcId: r.mcId, buscentreId: r.buscentreId, cellId: r.cellId };
}

// ─── Nodes ────────────────────────────────────────────────────────────────────
// A node is a position in the hierarchy plus all of its ancestors — the same
// denormalized shape Outreach and Contact store.

export type Node = {
  branchId:    string;
  mcId:        string | null;
  buscentreId: string | null;
  cellId:      string | null;
};

export async function resolveNode(level: OutreachLevel, nodeId: string): Promise<Node | null> {
  switch (level) {
    case "CELL": {
      const c = await prisma.cell.findUnique({
        where: { id: nodeId },
        select: { id: true, buscentreId: true, buscentre: { select: { mcId: true, mc: { select: { branchId: true } } } } },
      });
      return c ? { branchId: c.buscentre.mc.branchId, mcId: c.buscentre.mcId, buscentreId: c.buscentreId, cellId: c.id } : null;
    }
    case "BUSCENTRE": {
      const b = await prisma.buscentre.findUnique({
        where: { id: nodeId },
        select: { id: true, mcId: true, mc: { select: { branchId: true } } },
      });
      return b ? { branchId: b.mc.branchId, mcId: b.mcId, buscentreId: b.id, cellId: null } : null;
    }
    case "MC": {
      const m = await prisma.megaChurch.findUnique({ where: { id: nodeId }, select: { id: true, branchId: true } });
      return m ? { branchId: m.branchId, mcId: m.id, buscentreId: null, cellId: null } : null;
    }
    case "BRANCH": {
      const br = await prisma.branch.findUnique({ where: { id: nodeId }, select: { id: true } });
      return br ? { branchId: br.id, mcId: null, buscentreId: null, cellId: null } : null;
    }
  }
}

// Which node is the caller's "home" — used for personal evangelism recorded
// outside a planned outreach.
export function homeNode(u: EvangelismUser): Node | null {
  if (!u.branchId) return null;
  return { branchId: u.branchId, mcId: u.mcId, buscentreId: u.buscentreId, cellId: u.cellId };
}

// ─── Permissions ──────────────────────────────────────────────────────────────

// Manage = plan outreaches, assign teams, reassign contacts at/below this node.
// The head at each level runs evangelism for that level; heads above can too.
export function canManageNode(u: EvangelismUser, n: Node): boolean {
  switch (u.role) {
    case "admin":          return true;
    case "chief_shepherd": return !!u.branchId && u.branchId === n.branchId;
    case "mc_pastor":      return !!u.mcId && u.mcId === n.mcId;
    case "buscentre_head": return !!u.buscentreId && u.buscentreId === n.buscentreId;
    case "cell_shepherd":  return !!u.cellId && u.cellId === n.cellId;
    default:               return false;
  }
}

// Shepherds can record and follow up inside their own cell but not plan.
export function canWorkNode(u: EvangelismUser, n: Node): boolean {
  return canManageNode(u, n) || (u.role === "shepherd" && !!u.cellId && u.cellId === n.cellId);
}

// Is this cell inside the part of the church the contact is currently held by?
// A contact held at buscentre level is "covered" by every cell under it.
export function nodeCovers(held: Node, cell: Node): boolean {
  if (held.branchId !== cell.branchId) return false;
  if (held.cellId)      return held.cellId === cell.cellId;
  if (held.buscentreId) return held.buscentreId === cell.buscentreId;
  if (held.mcId)        return held.mcId === cell.mcId;
  return true;
}

// Prisma filter: rows (Outreach or Contact — both carry the same placement
// columns) the caller may see. null = no access at all.
export function scopeWhere(u: EvangelismUser): { branchId?: string; mcId?: string; buscentreId?: string; cellId?: string } | null {
  switch (u.role) {
    case "admin":          return {};
    case "chief_shepherd": return u.branchId ? { branchId: u.branchId } : null;
    case "mc_pastor":      return u.mcId ? { mcId: u.mcId } : null;
    case "buscentre_head": return u.buscentreId ? { buscentreId: u.buscentreId } : null;
    case "cell_shepherd":
    case "shepherd":       return u.cellId ? { cellId: u.cellId } : null;
    default:               return null;
  }
}

// Outreaches are also visible to anyone on their team, whatever their level.
export function outreachWhere(u: EvangelismUser): Prisma.OutreachWhereInput {
  const scope = scopeWhere(u);
  const team: Prisma.OutreachWhereInput = { team: { some: { member: { userId: u.id } } } };
  return scope ? { OR: [scope, team] } : team;
}

export function contactWhere(u: EvangelismUser): Prisma.ContactWhereInput {
  const scope = scopeWhere(u);
  // No scope ⇒ match nothing
  return { archivedAt: null, mergedIntoId: null, ...(scope ?? { id: "__none__" }) };
}

export async function canSeeOutreach(u: EvangelismUser, outreachId: string) {
  return prisma.outreach.findFirst({ where: { id: outreachId, ...outreachWhere(u) } });
}

// Members brought onto a team must be active and belong to the same branch.
export async function membersInBranch(memberIds: string[], branchId: string): Promise<boolean> {
  if (memberIds.length === 0) return true;
  const members = await prisma.member.findMany({
    where:  { id: { in: memberIds }, isActive: true },
    select: {
      cell:      { select: { buscentre: { select: { mc: { select: { branchId: true } } } } } },
      buscentre: { select: { mc: { select: { branchId: true } } } },
      mc:        { select: { branchId: true } },
    },
  });
  if (members.length !== new Set(memberIds).size) return false;
  return members.every((m) =>
    (m.cell?.buscentre.mc.branchId ?? m.buscentre?.mc.branchId ?? m.mc?.branchId) === branchId
  );
}

// ─── Funnel ───────────────────────────────────────────────────────────────────

// Stages the system moves a contact through. Everything else is a deliberate
// manual decision (and reversible, except DO_NOT_CONTACT).
export const PROGRESS_ORDER: ContactStage[] = ["NEW", "CONTACTED", "INVITED", "ATTENDED", "CONVERTED"];
export const SIDE_STAGES: ContactStage[]     = ["NOT_INTERESTED", "UNREACHABLE", "OUT_OF_AREA", "DO_NOT_CONTACT"];
// Stages a person may be set to by hand
export const MANUAL_STAGES: ContactStage[]   = ["NEW", "CONTACTED", "INVITED", ...SIDE_STAGES];

// Logging an activity moves a contact forward, never back, and never out of a
// side stage (someone who said "not interested" stays that way until a human
// reopens them).
export function stageAfterActivity(current: ContactStage, type: ContactActivityType): ContactStage {
  if (SIDE_STAGES.includes(current)) return current;
  const rank = PROGRESS_ORDER.indexOf(current);
  const target: ContactStage | null =
    type === "CALL" || type === "WHATSAPP" || type === "VISIT" ? "CONTACTED" :
    type === "INVITED" ? "INVITED" : null;
  if (!target) return current;
  return PROGRESS_ORDER.indexOf(target) > rank ? target : current;
}

export const isMinor = (age: string | null | undefined) => age === "CHILD" || age === "TEEN";

// ─── Duplicate detection ──────────────────────────────────────────────────────

export async function findContactByPhone(branchId: string, phoneNormalized: string) {
  return prisma.contact.findUnique({
    where:  { branchId_phoneNormalized: { branchId, phoneNormalized } },
    select: {
      id: true, firstName: true, lastName: true, stage: true, mergedIntoId: true,
      mcId: true, buscentreId: true, cellId: true,
      cell: { select: { name: true } }, buscentre: { select: { name: true } }, mc: { select: { name: true } },
    },
  });
}

// Members store phones as typed, so match on the last 9 digits and then compare
// the normalized forms.
export async function findMemberByPhone(branchId: string, phoneNormalized: string) {
  const tail = phoneNormalized.replace(/\D/g, "").slice(-9);
  const candidates = await prisma.member.findMany({
    where: {
      phone: { contains: tail },
      OR: [
        { cell:      { buscentre: { mc: { branchId } } } },
        { buscentre: { mc: { branchId } } },
        { mc:        { branchId } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, phone: true },
    take: 10,
  });
  return candidates.find((m) => normalizePhone(m.phone) === phoneNormalized) ?? null;
}

export const nodeLabel = (c: { cell?: { name: string } | null; buscentre?: { name: string } | null; mc?: { name: string } | null }) =>
  c.cell?.name ?? c.buscentre?.name ?? c.mc?.name ?? "the branch";
