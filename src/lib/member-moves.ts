import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { checkCapacity, logCapacityWarning } from "@/lib/capacity";
import { canManageNode, resolveNode, type EvangelismUser, type Node } from "@/lib/evangelism";

// Moving members between shepherds / cells / buscentres / MCs.
//
// One move always writes the whole placement (shepherd + cell + buscentre + MC)
// so a member can never be left pointing at the old cell's shepherd, needs
// authority over both where they are and where they're going, and is recorded
// in member_moves.

export type MoveLevel = "shepherd" | "cell" | "buscentre" | "mc";
export type Dest = { level: MoveLevel; shepherdId?: string | null; cellId?: string | null; buscentreId?: string | null; mcId?: string | null };
export type Placement = { shepherdId: string | null; cellId: string | null; buscentreId: string | null; mcId: string | null };
export type Skipped = { id: string; name: string; reason: string };
export type MoveResult = { status: number; body: Record<string, unknown> };

export const MAX_BATCH = 200;

// ─── Who is acting ────────────────────────────────────────────────────────────

export type Actor = EvangelismUser & { shepherdId: string | null };

// The caller's permanent role plus any role they are currently acting up in
export async function actorViews(userId: string): Promise<Actor[]> {
  const r = await prisma.userRole.findUnique({
    where: { userId },
    select: { role: true, branchId: true, mcId: true, buscentreId: true, cellId: true, shepherdId: true, actingAs: true, actingAt: true },
  });
  if (!r) return [];
  const views: Actor[] = [{ id: userId, role: r.role, branchId: r.branchId, mcId: r.mcId, buscentreId: r.buscentreId, cellId: r.cellId, shepherdId: r.shepherdId }];
  const at = (r.actingAt ?? {}) as Record<string, string>;
  for (const role of r.actingAs) {
    views.push({
      id: userId, role,
      branchId: at.branch_id ?? r.branchId, mcId: at.mc_id ?? null, buscentreId: at.buscentre_id ?? null,
      cellId: at.cell_id ?? null, shepherdId: null,
    });
  }
  return views;
}

export const canManage = (views: Actor[], node: Node) => views.some((v) => canManageNode(v, node));

// Edit / delete a member: lead the part of the church they sit in, or be their own shepherd
export async function canEditMember(views: Actor[], member: Placement & { id: string }): Promise<boolean> {
  const node = await memberNode(member);
  if (node && canManage(views, node)) return true;
  return views.some((v) => v.role === "shepherd" && !!v.shepherdId && v.shepherdId === member.shepherdId);
}

export async function memberNode(p: Placement): Promise<Node | null> {
  if (p.cellId)      return resolveNode("CELL", p.cellId);
  if (p.buscentreId) return resolveNode("BUSCENTRE", p.buscentreId);
  if (p.mcId)        return resolveNode("MC", p.mcId);
  return null;
}

// ─── Labels ───────────────────────────────────────────────────────────────────

export async function labelPlacement(p: Placement): Promise<string> {
  if (p.shepherdId) {
    const s = await prisma.shepherd.findUnique({
      where: { id: p.shepherdId },
      select: { cell: { select: { name: true } }, user: { select: { name: true } }, person: { select: { firstName: true, lastName: true } } },
    });
    if (s) return `${s.user?.name ?? (s.person ? `${s.person.firstName} ${s.person.lastName}` : "Unfilled shepherd slot")} · ${s.cell.name}`;
  }
  if (p.cellId)      { const c = await prisma.cell.findUnique({ where: { id: p.cellId }, select: { name: true } });           if (c) return `${c.name} (no shepherd)`; }
  if (p.buscentreId) { const b = await prisma.buscentre.findUnique({ where: { id: p.buscentreId }, select: { name: true } }); if (b) return `${b.name} buscentre (direct)`; }
  if (p.mcId)        { const m = await prisma.megaChurch.findUnique({ where: { id: p.mcId }, select: { name: true } });       if (m) return `${m.name} (direct)`; }
  return "Unplaced";
}

type ResolvedDest = { placement: Placement; node: Node; label: string; notifyUserIds: string[]; shepherdId: string | null };

async function resolveDest(d: Dest): Promise<ResolvedDest | { error: string; status: number }> {
  const none = { shepherdId: null, cellId: null, buscentreId: null, mcId: null };
  const notFound = (what: string) => ({ error: `${what} not found`, status: 404 });

  if (d.level === "shepherd") {
    if (!d.shepherdId) return { error: "Choose a shepherd", status: 400 };
    const s = await prisma.shepherd.findUnique({ where: { id: d.shepherdId }, select: { id: true, cellId: true, userId: true, person: { select: { userId: true } } } });
    if (!s) return notFound("Shepherd");
    const node = await resolveNode("CELL", s.cellId);
    if (!node) return notFound("Cell");
    const placement = { ...none, shepherdId: s.id, cellId: s.cellId };
    const cellShepherd = await prisma.userRole.findFirst({ where: { role: "cell_shepherd", cellId: s.cellId }, select: { userId: true } });
    return {
      placement, node, shepherdId: s.id, label: await labelPlacement(placement),
      notifyUserIds: [s.userId, s.person?.userId, cellShepherd?.userId].filter(Boolean) as string[],
    };
  }
  if (d.level === "cell") {
    if (!d.cellId) return { error: "Choose a cell", status: 400 };
    const node = await resolveNode("CELL", d.cellId);
    if (!node) return notFound("Cell");
    const placement = { ...none, cellId: d.cellId };
    const head = await prisma.userRole.findFirst({ where: { role: "cell_shepherd", cellId: d.cellId }, select: { userId: true } });
    return { placement, node, shepherdId: null, label: await labelPlacement(placement), notifyUserIds: head ? [head.userId] : [] };
  }
  if (d.level === "buscentre") {
    if (!d.buscentreId) return { error: "Choose a buscentre", status: 400 };
    const node = await resolveNode("BUSCENTRE", d.buscentreId);
    if (!node) return notFound("Buscentre");
    const placement = { ...none, buscentreId: d.buscentreId };
    const head = await prisma.userRole.findFirst({ where: { role: "buscentre_head", buscentreId: d.buscentreId }, select: { userId: true } });
    return { placement, node, shepherdId: null, label: await labelPlacement(placement), notifyUserIds: head ? [head.userId] : [] };
  }
  if (d.level === "mc") {
    if (!d.mcId) return { error: "Choose an MC", status: 400 };
    const node = await resolveNode("MC", d.mcId);
    if (!node) return notFound("MC");
    const placement = { ...none, mcId: d.mcId };
    const head = await prisma.userRole.findFirst({ where: { role: "mc_pastor", mcId: d.mcId }, select: { userId: true } });
    return { placement, node, shepherdId: null, label: await labelPlacement(placement), notifyUserIds: head ? [head.userId] : [] };
  }
  return { error: "Invalid level", status: 400 };
}

const samePlacement = (a: Placement, b: Placement) =>
  a.shepherdId === b.shepherdId && a.cellId === b.cellId && a.buscentreId === b.buscentreId && a.mcId === b.mcId;

// ─── The move ─────────────────────────────────────────────────────────────────

export async function moveMembers(
  actorId: string,
  input: { memberIds: string[]; dest: Dest; reason?: string | null },
): Promise<MoveResult> {
  const fail = (status: number, error: string): MoveResult => ({ status, body: { error } });

  const memberIds = Array.from(new Set(input.memberIds));
  if (memberIds.length === 0)        return fail(400, "No members selected");
  if (memberIds.length > MAX_BATCH)  return fail(400, `Move at most ${MAX_BATCH} members at a time`);

  const views = await actorViews(actorId);
  if (views.length === 0) return fail(403, "Your account has no role that can move members");

  const dest = await resolveDest(input.dest);
  if ("error" in dest) return fail(dest.status, dest.error);
  if (!canManage(views, dest.node)) return fail(403, "You don't have authority over that destination");

  const members = await prisma.member.findMany({
    where: { id: { in: memberIds } },
    select: {
      id: true, firstName: true, lastName: true, shepherdId: true, cellId: true, buscentreId: true, mcId: true,
      shepherdRole: { select: { id: true } },
      user:         { select: { role: { select: { id: true } } } },
      shepherdCandidacy: { select: { id: true } },
    },
  });

  // ── Who can actually move ──
  const skipped: Skipped[] = [];
  const movable: typeof members = [];
  const found = new Set(members.map((m) => m.id));
  for (const id of memberIds) if (!found.has(id)) skipped.push({ id, name: "Unknown member", reason: "Not found" });

  for (const m of members) {
    const name = `${m.firstName} ${m.lastName}`;
    const skip = (reason: string) => skipped.push({ id: m.id, name, reason });
    const current: Placement = { shepherdId: m.shepherdId, cellId: m.cellId, buscentreId: m.buscentreId, mcId: m.mcId };

    if (samePlacement(current, dest.placement)) { skip("Already there"); continue; }
    if (m.shepherdRole || m.user?.role) { skip("Holds a leadership role — change that from the Org page first"); continue; }
    if (m.shepherdCandidacy && !dest.placement.cellId) { skip("Is a shepherd candidate, so must stay in a cell"); continue; }

    const src = await memberNode(current);
    if (src && !canManage(views, src)) { skip("Outside the part of the church you lead"); continue; }
    movable.push(m);
  }

  if (movable.length === 0) {
    return { status: 200, body: { moved: 0, skipped, to: dest.label, batchId: null } };
  }

  // ── Capacity (members per shepherd) ──
  let overBy = 0, capMax = 0;
  if (dest.shepherdId) {
    const cap = await checkCapacity("member", dest.shepherdId);
    const after = cap.count + movable.length;
    capMax = cap.max;
    if (cap.enforce && after > cap.max) {
      return fail(409, `That shepherd would have ${after} members — the limit is ${cap.max}. Move fewer, or raise the limit in Settings.`);
    }
    if (after > cap.max) overBy = after;
  }

  // ── Write ──
  const batchId = randomUUID();
  const reason  = input.reason?.trim() || null;
  const labels  = new Map<string, string>();
  const fromLabel = async (p: Placement) => {
    const k = `${p.shepherdId}|${p.cellId}|${p.buscentreId}|${p.mcId}`;
    if (!labels.has(k)) labels.set(k, await labelPlacement(p));
    return labels.get(k)!;
  };

  const moved: typeof movable = [];
  await prisma.$transaction(async (tx) => {
    for (const m of movable) {
      const current: Placement = { shepherdId: m.shepherdId, cellId: m.cellId, buscentreId: m.buscentreId, mcId: m.mcId };
      // Only if nobody changed them since we looked
      const res = await tx.member.updateMany({
        where: { id: m.id, ...current },
        data:  { ...dest.placement },
      });
      if (res.count === 0) { skipped.push({ id: m.id, name: `${m.firstName} ${m.lastName}`, reason: "Changed by someone else just now — try again" }); continue; }

      await tx.memberMove.create({
        data: {
          memberId: m.id, batchId, reason, movedById: actorId,
          fromShepherdId: current.shepherdId, fromCellId: current.cellId, fromBuscentreId: current.buscentreId, fromMcId: current.mcId,
          fromLabel: await fromLabel(current),
          toShepherdId: dest.placement.shepherdId, toCellId: dest.placement.cellId, toBuscentreId: dest.placement.buscentreId, toMcId: dest.placement.mcId,
          toLabel: dest.label,
        },
      });
      // A candidacy belongs to a cell — it moves with them
      if (m.shepherdCandidacy && dest.placement.cellId) {
        await tx.shepherdCandidate.update({ where: { id: m.shepherdCandidacy.id }, data: { cellId: dest.placement.cellId } });
      }
      moved.push(m);
    }
  }, { timeout: 30_000, maxWait: 10_000 });

  // ── Side effects — never fail the move ──
  try {
    if (moved.length > 0) {
      if (overBy) {
        await logCapacityWarning({ level: "member", parentId: dest.shepherdId!, parentName: dest.label, count: overBy, createdById: actorId });
      }
      const names = moved.slice(0, 10).map((m) => `${m.firstName} ${m.lastName}`).join(", ") + (moved.length > 10 ? ` and ${moved.length - 10} more` : "");
      const recipients = Array.from(new Set(dest.notifyUserIds)).filter((u) => u !== actorId);
      if (recipients.length) {
        await prisma.notification.createMany({
          data: recipients.map((userId) => ({
            userId, type: "info", linkHref: "/members",
            title: `${moved.length} member${moved.length === 1 ? "" : "s"} moved to ${dest.label}`,
            body: names,
          })),
        });
      }
    }
  } catch (e) { console.error("[member-moves] side effects failed", e); }

  return { status: 200, body: { moved: moved.length, skipped, to: dest.label, batchId, ...(overBy ? { overCapacity: { count: overBy, max: capMax } } : {}) } };
}
