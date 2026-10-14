import { Prisma, FirstTimerIntent, ServiceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findContactByPhone, findMemberByPhone, normalizePhone, nodeCovers, resolveNode, type Node } from "@/lib/evangelism";

// Turns the first timers entered on the attendance page into FirstTimer rows
// linked to a Contact, so everyone we've met lives in one place:
//   · picked from "Expected guests"  → linked to that contact
//   · phone matches someone we know   → linked (a phone identifies one person)
//   · brand new                       → a Contact is created (source WALK_IN)
// Linking is what moves a contact to ATTENDED. Never throws for "soft"
// problems — those come back as notices so the attendance itself still saves.

export type FirstTimerDraft = {
  firstName:   string;
  lastName:    string;
  phone?:      string | null;
  location?:   string | null;
  referredBy?: string | null;
  // The member who brought them, when it was a member — what Recognition counts
  broughtByMemberId?: string | null;
  intent?:     FirstTimerIntent;
  contactId?:  string | null;
};

export class LinkError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

type Plan = {
  draft:         FirstTimerDraft;
  phoneNorm:     string | null;
  contactId:     string | null;                 // existing contact to link
  createContact: boolean;
  priorStage:    string | null;
};

export type Prepared = {
  cell: Node; plans: Plan[]; notices: string[];
  broughtBy: Record<string, string>; // member id → full name, for everyone named as having brought a first timer
};

const fullName = (d: { firstName: string; lastName?: string | null }) => [d.firstName, d.lastName].filter(Boolean).join(" ");

// Runs before the transaction: resolves each draft to a plan and validates it.
export async function prepareFirstTimers(cellId: string, drafts: FirstTimerDraft[]): Promise<Prepared> {
  const cell = await resolveNode("CELL", cellId);
  if (!cell) throw new LinkError("Cell not found", 404);

  const plans: Plan[] = [];
  const notices: string[] = [];
  const seenContacts = new Set<string>();

  // Anyone credited with bringing a first timer must be a real member
  const broughtIds = Array.from(new Set(drafts.map((d) => d.broughtByMemberId).filter((x): x is string => !!x)));
  const broughtBy: Record<string, string> = {};
  if (broughtIds.length) {
    const found = await prisma.member.findMany({ where: { id: { in: broughtIds } }, select: { id: true, firstName: true, lastName: true } });
    for (const m of found) broughtBy[m.id] = fullName(m);
    if (found.length !== broughtIds.length) throw new LinkError("One of the members chosen as having brought a first timer wasn't found");
  }

  for (const draft of drafts) {
    const name = fullName(draft);
    const phoneNorm = normalizePhone(draft.phone);
    let contactId: string | null = null;
    let priorStage: string | null = null;
    let isMember = false;

    const load = (id: string) => prisma.contact.findUnique({
      where:  { id },
      select: { id: true, firstName: true, lastName: true, stage: true, branchId: true, mcId: true, buscentreId: true, cellId: true,
                convertedMemberId: true, mergedIntoId: true, archivedAt: true, firstTimer: { select: { id: true } } },
    });

    if (draft.contactId) {
      const c = await load(draft.contactId);
      if (!c || c.archivedAt || c.mergedIntoId) throw new LinkError("One of the selected evangelism contacts no longer exists", 404);
      if (c.branchId !== cell.branchId || !nodeCovers(c, cell)) {
        throw new LinkError(`${fullName(c)} isn't held by this cell's part of the church — ask their evangelism leader to assign them first`, 403);
      }
      if (c.firstTimer || c.convertedMemberId || c.stage === "ATTENDED" || c.stage === "CONVERTED") {
        notices.push(`${fullName(c)} has already attended before, so wasn't added as a first timer.`);
        continue;
      }
      contactId = c.id; priorStage = c.stage;
    } else if (phoneNorm) {
      // A phone number is the same person wherever they were met
      const member = await findMemberByPhone(cell.branchId, phoneNorm);
      if (member) {
        isMember = true;
        notices.push(`${name}'s number belongs to member ${fullName(member)} — recorded as a first timer, but please check.`);
      } else {
        const known = await findContactByPhone(cell.branchId, phoneNorm);
        if (known) {
          const c = await load(known.id);
          if (c?.firstTimer || c?.convertedMemberId || c?.stage === "ATTENDED" || c?.stage === "CONVERTED") {
            notices.push(`${name} has already attended before (same phone number), so wasn't added as a first timer.`);
            continue;
          }
          contactId = known.id; priorStage = known.stage;
        }
      }
    }

    if (contactId) {
      if (seenContacts.has(contactId)) continue; // same person entered twice in one service
      seenContacts.add(contactId);
    }

    plans.push({
      draft, phoneNorm, contactId, priorStage,
      // Existing members get no Contact; everyone else new does
      createContact: !contactId && !isMember,
    });
  }
  return { cell, plans, notices, broughtBy };
}

// Runs inside the services transaction.
export async function applyFirstTimers(
  tx: Prisma.TransactionClient,
  p: Prepared,
  ctx: { serviceId: string; serviceType: ServiceType; serviceDate: Date; userId: string; cellId: string },
) {
  const { cell } = p;
  const placement = {
    mc:        cell.mcId        ? { connect: { id: cell.mcId } }        : undefined,
    buscentre: cell.buscentreId ? { connect: { id: cell.buscentreId } } : undefined,
    cell:      { connect: { id: ctx.cellId } },
  };
  const label = ctx.serviceType.replace(/_/g, " ").toLowerCase();

  for (const plan of p.plans) {
    const d = plan.draft;
    let contactId = plan.contactId;

    if (contactId) {
      const existing = await tx.contact.findUnique({
        where: { id: contactId },
        select: { phone: true, followUpOwner: { select: { cellId: true } }, cellId: true },
      });
      await tx.contact.update({
        where: { id: contactId },
        data: {
          stage: "ATTENDED",
          lastActivityAt: new Date(),
          ...placement,
          // Their old follow-up person only stays if they're in this cell
          ...(existing?.followUpOwner && existing.followUpOwner.cellId !== ctx.cellId ? { followUpOwner: { disconnect: true } } : {}),
          // Fill a missing number from what was just written down
          ...(existing && !existing.phone && d.phone?.trim() && plan.phoneNorm ? { phone: d.phone.trim(), phoneNormalized: plan.phoneNorm } : {}),
        },
      });
    } else if (plan.createContact) {
      const created = await tx.contact.create({
        data: {
          firstName: d.firstName.trim(), lastName: d.lastName.trim() || null,
          phone: d.phone?.trim() || null, phoneNormalized: plan.phoneNorm,
          homeArea: d.location?.trim() || null,
          stage: "ATTENDED", source: "WALK_IN",
          branchId: cell.branchId, mcId: cell.mcId, buscentreId: cell.buscentreId, cellId: ctx.cellId,
          firstMetAt: ctx.serviceDate,
        },
      });
      contactId = created.id;
    }

    await tx.firstTimer.create({
      data: {
        firstName:  d.firstName.trim(),
        lastName:   d.lastName.trim(),
        phone:      d.phone?.trim() || null,
        location:   d.location?.trim() || null,
        // A member picked as the one who brought them also fills the free-text name, so every
        // screen that shows "Brought by …" keeps working
        referredBy: d.referredBy?.trim() || (d.broughtByMemberId ? p.broughtBy[d.broughtByMemberId] : null) || null,
        broughtByMemberId: d.broughtByMemberId || null,
        intent:     d.intent ?? "UNDECIDED",
        serviceId:  ctx.serviceId,
        cellId:     ctx.cellId,
        recordedById: ctx.userId,
        contactId,
      },
    });

    if (contactId && plan.contactId) {
      await tx.contactActivity.create({
        data: {
          contactId, type: "STAGE_CHANGE", byUserId: ctx.userId,
          note: `Came to ${label} on ${ctx.serviceDate.toISOString().slice(0, 10)} (${plan.priorStage} → ATTENDED)`,
        },
      });
    }
  }
}

// Map the two ways a contact can collide at write time to a friendly message
export function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

// ── Returning guests ──────────────────────────────────────────────────────────
// Someone who isn't a member yet coming back after their first visit. Recorded as a GuestVisit so
// we can see who has come 3+ times in a month — the point at which the buscentre head speaks to them.

export type GuestPrepared = { cell: Node; ids: string[]; notices: string[] };

export async function prepareGuestVisits(cellId: string, contactIds: string[], alreadyThisService: Set<string>): Promise<GuestPrepared> {
  const cell = await resolveNode("CELL", cellId);
  if (!cell) throw new LinkError("Cell not found", 404);
  const ids: string[] = [], notices: string[] = [];

  for (const id of Array.from(new Set(contactIds))) {
    if (alreadyThisService.has(id)) continue;              // recorded as a first timer in this same service
    const c = await prisma.contact.findUnique({
      where: { id },
      select: { firstName: true, lastName: true, stage: true, branchId: true, mcId: true, buscentreId: true, cellId: true,
                convertedMemberId: true, archivedAt: true, mergedIntoId: true },
    });
    if (!c || c.archivedAt || c.mergedIntoId) throw new LinkError("One of the returning guests no longer exists", 404);
    const name = [c.firstName, c.lastName].filter(Boolean).join(" ");
    if (c.branchId !== cell.branchId || !nodeCovers(c, cell)) {
      throw new LinkError(`${name} isn't held by this cell's part of the church — ask their evangelism leader to assign them first`, 403);
    }
    if (c.convertedMemberId || c.stage === "CONVERTED") { notices.push(`${name} is a member now — mark them in the member list instead.`); continue; }
    if (c.stage !== "ATTENDED") { notices.push(`${name} hasn't had a first visit recorded yet, so wasn't counted as a returning guest.`); continue; }
    ids.push(id);
  }
  return { cell, ids, notices };
}

export async function applyGuestVisits(
  tx: Prisma.TransactionClient, g: GuestPrepared, ctx: { serviceId: string; userId: string; cellId: string },
) {
  if (g.ids.length === 0) return;
  await tx.guestVisit.createMany({
    data: g.ids.map((contactId) => ({ contactId, serviceId: ctx.serviceId, recordedById: ctx.userId })),
    skipDuplicates: true,
  });
  // They came to this cell, so this is where they're held now
  await tx.contact.updateMany({
    where: { id: { in: g.ids } },
    data: { lastActivityAt: new Date(), cellId: ctx.cellId, buscentreId: g.cell.buscentreId, mcId: g.cell.mcId },
  });
}
