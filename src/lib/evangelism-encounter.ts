import { Prisma, AgeRange, EncounterResponse, Gender } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  canWorkNode, canSeeOutreach, contactWhere, findContactByPhone, findMemberByPhone,
  getEvangelismUser, homeNode, membersInBranch, nodeLabel, normalizePhone, resolveNode, type Node,
} from "@/lib/evangelism";

export type EncounterInput = {
  outreachId?:    string | null;
  contactId?:     string | null;   // link to a person we already know
  contact?: {                      // …or describe a new one
    firstName:  string;
    lastName?:  string | null;
    phone?:     string | null;
    gender?:    Gender | null;
    ageRange?:  AgeRange | null;
    homeArea?:  string | null;
    notes?:     string | null;
  };
  metAt?:         string | null;
  metLocation?:   string | null;
  lat?:           number | null;
  lng?:           number | null;
  response?:      EncounterResponse;
  prayedWith?:    boolean;
  notes?:         string | null;
  metByMemberId?: string | null;
  clientRef?:     string | null;
  cellId?:        string | null;   // personal evangelism only — file the contact under one of your cells
};

export type EncounterResult = { status: number; body: Record<string, unknown> };

const fail = (status: number, error: string, extra: Record<string, unknown> = {}): EncounterResult =>
  ({ status, body: { error, ...extra } });

const RESPONSES: EncounterResponse[] = ["RECEIVED_CHRIST", "INTERESTED", "NEUTRAL", "DECLINED"];
const AGES: AgeRange[]               = ["CHILD", "TEEN", "YOUTH", "ADULT", "ELDER"];
const clean = (v: string | null | undefined) => v?.trim() || null;

export async function recordEncounter(userId: string, input: EncounterInput): Promise<EncounterResult> {
  const user = await getEvangelismUser(userId);
  if (!user) return fail(403, "No evangelism access for this account");

  if (input.response && !RESPONSES.includes(input.response)) return fail(400, "Invalid response");
  if (input.contact?.ageRange && !AGES.includes(input.contact.ageRange)) return fail(400, "Invalid age range");
  if (!input.contactId && !input.contact?.firstName?.trim()) return fail(400, "A first name (or an existing contact) is required");

  const metAt = input.metAt ? new Date(input.metAt) : new Date();
  if (isNaN(metAt.getTime()))          return fail(400, "Invalid metAt");
  if (metAt.getTime() > Date.now() + 5 * 60_000) return fail(400, "metAt cannot be in the future");

  // A retried field submission must not create a second record
  if (input.clientRef) {
    const prior = await prisma.encounter.findUnique({ where: { clientRef: input.clientRef } });
    if (prior) return { status: 200, body: { encounter: prior, contact: { id: prior.contactId }, replayed: true } };
  }

  // ── Where is this encounter filed? ──
  let node: Node | null;
  let outreachId: string | null = null;
  if (input.outreachId) {
    const outreach = await canSeeOutreach(user, input.outreachId);
    if (!outreach)                      return fail(404, "Outreach not found");
    if (outreach.status === "CANCELLED") return fail(409, "This outreach was cancelled");
    outreachId = outreach.id;
    node = { branchId: outreach.branchId, mcId: outreach.mcId, buscentreId: outreach.buscentreId, cellId: outreach.cellId };
  } else if (input.cellId) {
    node = await resolveNode("CELL", input.cellId);
    if (!node || !canWorkNode(user, node)) return fail(403, "No access to that cell");
  } else {
    node = homeNode(user);
  }
  if (!node) return fail(400, "No placement — this account isn't assigned to a branch");

  if (input.metByMemberId && !(await membersInBranch([input.metByMemberId], node.branchId))) {
    return fail(400, "metByMemberId must be an active member of this branch");
  }

  // ── Who is it? ──
  let contactId = input.contactId ?? null;
  let phoneNormalized: string | null = null;

  if (contactId) {
    const existing = await prisma.contact.findFirst({ where: { id: contactId, ...contactWhere(user) }, select: { id: true, doNotContact: true } });
    if (!existing)             return fail(404, "Contact not found");
    if (existing.doNotContact) return fail(409, "This person asked not to be contacted", { code: "DO_NOT_CONTACT" });
  } else {
    const c = input.contact!;
    phoneNormalized = normalizePhone(c.phone);
    if (clean(c.phone) && !phoneNormalized) return fail(400, "That phone number doesn't look valid");

    if (phoneNormalized) {
      const member = await findMemberByPhone(node.branchId, phoneNormalized);
      if (member) {
        return fail(409, `${member.firstName} ${member.lastName} is already a member`, { code: "ALREADY_MEMBER", memberId: member.id });
      }
      const dup = await findContactByPhone(node.branchId, phoneNormalized);
      if (dup) {
        const visible = await prisma.contact.findFirst({ where: { id: dup.id, ...contactWhere(user) }, select: { id: true } });
        const name = [dup.firstName, dup.lastName].filter(Boolean).join(" ");
        return visible
          ? fail(409, `${name} is already on record — link this encounter to them instead`, {
              code: "DUPLICATE_CONTACT", contact: { id: dup.id, name, stage: dup.stage },
            })
          // Don't leak details of someone outside the caller's scope
          : fail(409, `This number is already being followed up by ${nodeLabel(dup)}`, { code: "DUPLICATE_HIDDEN" });
      }
    }
  }

  // ── Write ──
  try {
    const result = await prisma.$transaction(async (tx) => {
      if (!contactId) {
        const c = input.contact!;
        const created = await tx.contact.create({
          data: {
            firstName: c.firstName.trim(),
            lastName:  clean(c.lastName),
            phone:     clean(c.phone),
            phoneNormalized,
            gender:    c.gender ?? null,
            ageRange:  c.ageRange ?? null,
            homeArea:  clean(c.homeArea),
            notes:     clean(c.notes),
            source:    outreachId ? "OUTREACH" : "PERSONAL_INVITE",
            branchId: node.branchId, mcId: node.mcId, buscentreId: node.buscentreId, cellId: node.cellId,
            firstMetAt: metAt,
          },
        });
        contactId = created.id;
      } else {
        await tx.contact.update({ where: { id: contactId }, data: { lastActivityAt: new Date() } });
      }

      const encounter = await tx.encounter.create({
        data: {
          contactId:     contactId!,
          outreachId,
          metAt,
          metLocation:   clean(input.metLocation),
          lat:           input.lat ?? null,
          lng:           input.lng ?? null,
          response:      input.response ?? "NEUTRAL",
          prayedWith:    Boolean(input.prayedWith) || input.response === "RECEIVED_CHRIST",
          notes:         clean(input.notes),
          metByMemberId: input.metByMemberId ?? null,
          recordedById:  userId,
          clientRef:     clean(input.clientRef),
        },
      });

      // First encounter flips a planned outreach to ongoing
      if (outreachId) {
        await tx.outreach.updateMany({ where: { id: outreachId, status: "PLANNED" }, data: { status: "ONGOING" } });
      }
      return { encounter, contactId: contactId! };
    });

    return { status: 201, body: { encounter: result.encounter, contact: { id: result.contactId } } };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = String(e.meta?.target ?? "");
      if (target.includes("client_ref")) {
        const prior = await prisma.encounter.findUnique({ where: { clientRef: input.clientRef! } });
        if (prior) return { status: 200, body: { encounter: prior, contact: { id: prior.contactId }, replayed: true } };
      }
      if (target.includes("outreach_id")) return fail(409, "This person is already recorded for this outreach", { code: "ALREADY_RECORDED" });
      return fail(409, "This number was just recorded by someone else — search for the contact and link to them", { code: "DUPLICATE_CONTACT" });
    }
    throw e;
  }
}
