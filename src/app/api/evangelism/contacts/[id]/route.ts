import { AgeRange, ContactStage, Gender, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  canManageNode, canWorkNode, contactWhere, findContactByPhone, findMemberByPhone,
  MANUAL_STAGES, nodeLabel, normalizePhone, resolveNode, SIDE_STAGES,
} from "@/lib/evangelism";
import { json, readBody, requireEvangelismUser } from "@/lib/evangelism-api";

type Ctx = { params: { id: string } };

const GENDERS: Gender[]   = ["Male", "Female", "Other"];
const AGES: AgeRange[]    = ["CHILD", "TEEN", "YOUTH", "ADULT", "ELDER"];
// Reopening someone or marking a side-stage by hand. INVITED comes from logging
// an invite; ATTENDED / CONVERTED come from attendance and conversion.
const SETTABLE: ContactStage[] = MANUAL_STAGES.filter((s) => s !== "INVITED");
// Only leaders at MC level and above may lift a do-not-contact flag
const CAN_LIFT_DNC = ["admin", "chief_shepherd", "mc_pastor"];

const clean = (v: unknown) => (typeof v === "string" ? v.trim() || null : null);

// GET — the person with their full journey: every encounter and follow-up
export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireEvangelismUser();
  if ("error" in auth) return auth.error;

  const contact = await prisma.contact.findFirst({
    where: { id: params.id, ...contactWhere(auth.user) },
    include: {
      cell:            { select: { id: true, name: true } },
      buscentre:       { select: { id: true, name: true } },
      followUpOwner:   { select: { id: true, firstName: true, lastName: true } },
      convertedMember: { select: { id: true, firstName: true, lastName: true } },
      encounters: {
        orderBy: { metAt: "desc" },
        include: {
          outreach: { select: { id: true, title: true } },
          metBy:    { select: { id: true, firstName: true, lastName: true } },
        },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        include: { by: { select: { name: true } } },
      },
      // Every service they've come to as a guest: the first visit, and each time they came back
      firstTimer:  { select: { service: { select: { id: true, date: true, type: true } } } },
      guestVisits: { select: { service: { select: { id: true, date: true, type: true } } } },
    },
  });
  if (!contact) return json({ error: "Not found" }, 404);

  // What this person may do about their membership (the actions re-check on the server)
  const manages = canManageNode(auth.user, contact);
  const access = {
    canConverse: manages && ["buscentre_head", "mc_pastor", "chief_shepherd", "admin"].includes(auth.user.role),
    canAdd:      manages && auth.user.role !== "shepherd",
  };

  return json({ ...(contact.doNotContact ? { ...contact, phone: null, phoneNormalized: null } : contact), access });
}

// PATCH — edit details, move the stage by hand, assign a cell / follow-up owner
export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireEvangelismUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const c = await prisma.contact.findFirst({ where: { id: params.id, ...contactWhere(user) } });
  if (!c) return json({ error: "Not found" }, 404);
  if (!canWorkNode(user, c)) return json({ error: "Not allowed" }, 403);

  const b = await readBody(request);
  if (!b) return json({ error: "Invalid JSON" }, 400);

  const data: Prisma.ContactUpdateInput = {};
  const log: { type: "REASSIGNED" | "STAGE_CHANGE"; note: string }[] = [];
  const notify: { userId: string; title: string; body: string }[] = [];

  // ── Details ──
  if (typeof b.firstName === "string") { if (!b.firstName.trim()) return json({ error: "firstName can't be empty" }, 400); data.firstName = b.firstName.trim(); }
  if ("lastName" in b)  data.lastName = clean(b.lastName);
  if ("homeArea" in b)  data.homeArea = clean(b.homeArea);
  if ("notes" in b)     data.notes    = clean(b.notes);
  if ("gender" in b)    { if (b.gender && !GENDERS.includes(b.gender as Gender)) return json({ error: "Invalid gender" }, 400); data.gender = (b.gender as Gender) || null; }
  if ("ageRange" in b)  { if (b.ageRange && !AGES.includes(b.ageRange as AgeRange)) return json({ error: "Invalid age range" }, 400); data.ageRange = (b.ageRange as AgeRange) || null; }

  if ("phone" in b) {
    const phone = clean(b.phone);
    const norm  = normalizePhone(phone);
    if (phone && !norm) return json({ error: "That phone number doesn't look valid" }, 400);
    if (norm && norm !== c.phoneNormalized) {
      const member = await findMemberByPhone(c.branchId, norm);
      if (member) return json({ error: `${member.firstName} ${member.lastName} is already a member with that number`, code: "ALREADY_MEMBER" }, 409);
      const dup = await findContactByPhone(c.branchId, norm);
      if (dup && dup.id !== c.id) return json({ error: `That number belongs to a contact followed up by ${nodeLabel(dup)}`, code: "DUPLICATE_CONTACT" }, 409);
    }
    data.phone = phone; data.phoneNormalized = norm;
  }

  // ── Assignment to a cell ──
  if ("cellId" in b && b.cellId !== c.cellId) {
    if (!b.cellId) return json({ error: "A contact can be moved to another cell, but not un-assigned from all of them" }, 400);
    const dest = await resolveNode("CELL", b.cellId as string);
    if (!dest || dest.branchId !== c.branchId) return json({ error: "Cell not found" }, 404);
    if (!canManageNode(user, c) || !canManageNode(user, dest)) {
      return json({ error: "You need to run evangelism at both the contact's current level and the destination cell" }, 403);
    }
    data.mc        = dest.mcId ? { connect: { id: dest.mcId } } : { disconnect: true };
    data.buscentre = dest.buscentreId ? { connect: { id: dest.buscentreId } } : { disconnect: true };
    data.cell      = { connect: { id: dest.cellId! } };
    data.followUpOwner = { disconnect: true }; // the old owner belonged to the old cell
    log.push({ type: "REASSIGNED", note: `Assigned to a new cell` });

    const shepherd = await prisma.userRole.findFirst({ where: { role: "cell_shepherd", cellId: dest.cellId }, select: { userId: true } });
    if (shepherd && shepherd.userId !== user.id) {
      notify.push({
        userId: shepherd.userId, title: "New evangelism contact for your cell",
        body: [c.firstName, c.lastName].filter(Boolean).join(" "),
      });
    }
  }

  // ── Follow-up owner ──
  if ("followUpOwnerId" in b && !("cell" in data)) {
    if (b.followUpOwnerId == null) {
      data.followUpOwner = { disconnect: true };
    } else {
      if (!c.cellId) return json({ error: "Assign the contact to a cell before choosing who follows up" }, 400);
      const owner = await prisma.member.findFirst({
        where:  { id: b.followUpOwnerId as string, isActive: true, cellId: c.cellId },
        select: { id: true, userId: true },
      });
      if (!owner) return json({ error: "The follow-up person must be an active member of this contact's cell" }, 400);
      if (!canManageNode(user, c)) return json({ error: "Only the cell's leaders can assign follow-up" }, 403);
      data.followUpOwner = { connect: { id: owner.id } };
      log.push({ type: "REASSIGNED", note: "Follow-up owner changed" });
      if (owner.userId && owner.userId !== user.id) {
        notify.push({ userId: owner.userId, title: "You've been asked to follow up a new contact", body: [c.firstName, c.lastName].filter(Boolean).join(" ") });
      }
    }
  }

  // ── Stage ──
  if (b.stage && b.stage !== c.stage) {
    const to = b.stage as ContactStage;
    if (!SETTABLE.includes(to)) return json({ error: "That stage is set automatically (invites, attendance, conversion)" }, 400);
    if (c.stage === "ATTENDED" || c.stage === "CONVERTED") return json({ error: "This person has already attended — their stage can't be changed by hand" }, 409);
    if (c.stage === "DO_NOT_CONTACT" && !CAN_LIFT_DNC.includes(user.role)) return json({ error: "Only MC-level leaders can lift a do-not-contact flag" }, 403);
    if (SIDE_STAGES.includes(to) && !clean(b.stageNote)) return json({ error: "Say why — a note is required" }, 400);

    data.stage        = to;
    data.doNotContact = to === "DO_NOT_CONTACT";
    log.push({ type: "STAGE_CHANGE", note: `${c.stage} → ${to}${clean(b.stageNote) ? `: ${clean(b.stageNote)}` : ""}` });
  }

  if (Object.keys(data).length === 0) return json({ error: "Nothing to update" }, 400);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.contact.update({ where: { id: c.id }, data: { ...data, lastActivityAt: new Date() } });
      if (log.length) await tx.contactActivity.createMany({ data: log.map((l) => ({ contactId: c.id, type: l.type, note: l.note, byUserId: user.id })) });
      if (notify.length) await tx.notification.createMany({ data: notify.map((n) => ({ ...n, type: "info", linkHref: "/evangelism" })) });
      return row;
    });
    return json(updated);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return json({ error: "That phone number is already on another contact", code: "DUPLICATE_CONTACT" }, 409);
    }
    throw e;
  }
}
