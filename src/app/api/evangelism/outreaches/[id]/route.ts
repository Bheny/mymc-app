import { OutreachStatus, OutreachType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canManageNode, canSeeOutreach, membersInBranch } from "@/lib/evangelism";
import { json, parseDate, readBody, requireEvangelismUser } from "@/lib/evangelism-api";

type Ctx = { params: { id: string } };

// Allowed status moves. COMPLETED / CANCELLED are final.
const NEXT: Record<OutreachStatus, OutreachStatus[]> = {
  PLANNED:   ["ONGOING", "COMPLETED", "CANCELLED"],
  ONGOING:   ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};
const TYPES: OutreachType[] = ["STREET", "DOOR_TO_DOOR", "CAMPUS", "MARKET", "EVENT", "ONLINE", "OTHER"];

// GET — outreach with team, encounters and funnel numbers
export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireEvangelismUser();
  if ("error" in auth) return auth.error;

  const visible = await canSeeOutreach(auth.user, params.id);
  if (!visible) return json({ error: "Not found" }, 404);

  const outreach = await prisma.outreach.findUnique({
    where: { id: params.id },
    include: {
      lead:      { select: { id: true, firstName: true, lastName: true } },
      cell:      { select: { name: true } },
      buscentre: { select: { name: true } },
      mc:        { select: { name: true } },
      team:      { include: { member: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" } },
      encounters: {
        orderBy: { metAt: "desc" },
        include: {
          contact: { select: { id: true, firstName: true, lastName: true, phone: true, stage: true, doNotContact: true } },
          metBy:   { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!outreach) return json({ error: "Not found" }, 404);

  const funnel = { met: 0, withPhone: 0, decisions: 0, invited: 0, attended: 0, converted: 0 };
  const seen = new Set<string>();
  for (const e of outreach.encounters) {
    if (seen.has(e.contactId)) continue;
    seen.add(e.contactId);
    funnel.met++;
    if (e.contact.phone) funnel.withPhone++;
    if (e.response === "RECEIVED_CHRIST") funnel.decisions++;
    if (["INVITED", "ATTENDED", "CONVERTED"].includes(e.contact.stage)) funnel.invited++;
    if (["ATTENDED", "CONVERTED"].includes(e.contact.stage)) funnel.attended++;
    if (e.contact.stage === "CONVERTED") funnel.converted++;
  }

  return json({ ...outreach, funnel });
}

// PATCH — edit details, replace the team, move the status, record tallies
export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireEvangelismUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const o = await canSeeOutreach(user, params.id);
  if (!o) return json({ error: "Not found" }, 404);

  const leadUser = o.leadMemberId
    ? await prisma.member.findUnique({ where: { id: o.leadMemberId }, select: { userId: true } })
    : null;
  const isManager = canManageNode(user, o);
  const isLead    = leadUser?.userId === user.id;
  if (!isManager && !isLead) return json({ error: "Only the outreach lead or the people who run evangelism here can change it" }, 403);

  const b = await readBody(request);
  if (!b) return json({ error: "Invalid JSON" }, 400);

  const closed = o.status === "COMPLETED" || o.status === "CANCELLED";
  const data: Prisma.OutreachUpdateInput = {};

  // Plan fields — managers only, and frozen once the outreach is over
  const planKeys = ["title", "type", "locationName", "area", "notes", "startsAt", "endsAt", "targetCount", "leadMemberId", "teamMemberIds", "lat", "lng"];
  if (planKeys.some((k) => k in b)) {
    if (!isManager) return json({ error: "Only the people who run evangelism here can change the plan" }, 403);
    if (closed)     return json({ error: `A ${o.status.toLowerCase()} outreach can't be edited` }, 409);
  }
  if (typeof b.title === "string") { if (!b.title.trim()) return json({ error: "title can't be empty" }, 400); data.title = b.title.trim(); }
  if (typeof b.locationName === "string") { if (!b.locationName.trim()) return json({ error: "locationName can't be empty" }, 400); data.locationName = b.locationName.trim(); }
  if ("type" in b)  { if (!TYPES.includes(b.type as OutreachType)) return json({ error: "Invalid type" }, 400); data.type = b.type as OutreachType; }
  if ("area" in b)  data.area  = (b.area  as string | null)?.trim() || null;
  if ("notes" in b) data.notes = (b.notes as string | null)?.trim() || null;
  if ("lat" in b)   data.lat = typeof b.lat === "number" ? b.lat : null;
  if ("lng" in b)   data.lng = typeof b.lng === "number" ? b.lng : null;
  if ("targetCount" in b) {
    const t = b.targetCount == null ? null : Number(b.targetCount);
    if (t != null && (!Number.isInteger(t) || t < 0)) return json({ error: "Invalid targetCount" }, 400);
    data.targetCount = t;
  }

  const startsAt = "startsAt" in b ? parseDate(b.startsAt) : o.startsAt;
  const endsAt   = "endsAt"   in b ? parseDate(b.endsAt)   : o.endsAt;
  if (!startsAt) return json({ error: "Invalid startsAt" }, 400);
  if (endsAt && endsAt <= startsAt) return json({ error: "endsAt must be after startsAt" }, 400);
  if ("startsAt" in b) data.startsAt = startsAt;
  if ("endsAt"   in b) data.endsAt   = endsAt;

  // Tallies / summary — lead or manager, any time (late entry is normal)
  for (const key of ["peopleSpokenTo", "decisionsForChrist"] as const) {
    if (key in b) {
      const n = b[key] == null ? null : Number(b[key]);
      if (n != null && (!Number.isInteger(n) || n < 0)) return json({ error: `Invalid ${key}` }, 400);
      data[key] = n;
    }
  }
  if ("summary" in b) data.summary = (b.summary as string | null)?.trim() || null;

  // Status
  let nextStatus: OutreachStatus | undefined;
  if (b.status && b.status !== o.status) {
    nextStatus = b.status as OutreachStatus;
    if (!NEXT[o.status].includes(nextStatus)) return json({ error: `Can't move from ${o.status} to ${nextStatus}` }, 409);

    if (nextStatus === "CANCELLED") {
      const reason = String(b.cancelledReason ?? "").trim();
      if (!reason) return json({ error: "Give a reason for cancelling" }, 400);
      data.cancelledReason = reason;
    }
    if (nextStatus === "COMPLETED") {
      // Closing it out needs *some* record of what happened
      const hasTally   = (data.peopleSpokenTo ?? o.peopleSpokenTo) != null;
      const hasSummary = !!((data.summary as string | null | undefined) ?? o.summary);
      const hasPeople  = (await prisma.encounter.count({ where: { outreachId: o.id } })) > 0;
      if (!hasTally && !hasSummary && !hasPeople) {
        return json({ error: "Add a summary, a headcount or at least one person met before completing" }, 400);
      }
    }
    data.status = nextStatus;
  }

  // Team replacement
  let teamIds: string[] | null = null;
  if ("teamMemberIds" in b || "leadMemberId" in b) {
    const leadId = "leadMemberId" in b ? ((b.leadMemberId as string | null) || null) : o.leadMemberId;
    const current = await prisma.outreachTeamMember.findMany({ where: { outreachId: o.id }, select: { memberId: true } });
    const requested = "teamMemberIds" in b && Array.isArray(b.teamMemberIds) ? (b.teamMemberIds as string[]) : current.map((t) => t.memberId);
    teamIds = Array.from(new Set([...requested, ...(leadId ? [leadId] : [])]));
    if (!(await membersInBranch(teamIds, o.branchId))) return json({ error: "Team members must be active members of this branch" }, 400);
    data.lead = leadId ? { connect: { id: leadId } } : { disconnect: true };
  }

  if (Object.keys(data).length === 0 && !teamIds) return json({ error: "Nothing to update" }, 400);

  const updated = await prisma.$transaction(async (tx) => {
    if (teamIds) {
      const leadId = ("leadMemberId" in b ? (b.leadMemberId as string | null) : o.leadMemberId) || null;
      await tx.outreachTeamMember.deleteMany({ where: { outreachId: o.id, memberId: { notIn: teamIds } } });
      for (const memberId of teamIds) {
        await tx.outreachTeamMember.upsert({
          where:  { outreachId_memberId: { outreachId: o.id, memberId } },
          create: { outreachId: o.id, memberId, isLead: memberId === leadId },
          update: { isLead: memberId === leadId },
        });
      }
    }
    return tx.outreach.update({ where: { id: o.id }, data });
  });

  return json(updated);
}

// DELETE — only an outreach nobody has acted on. Anything with history is cancelled instead.
export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireEvangelismUser();
  if ("error" in auth) return auth.error;

  const o = await canSeeOutreach(auth.user, params.id);
  if (!o) return json({ error: "Not found" }, 404);
  if (!canManageNode(auth.user, o)) return json({ error: "Not allowed" }, 403);

  const encounters = await prisma.encounter.count({ where: { outreachId: o.id } });
  if (o.status !== "PLANNED" || encounters > 0) {
    return json({ error: "This outreach has history — cancel it instead of deleting" }, 409);
  }
  await prisma.outreach.delete({ where: { id: o.id } });
  return json({ ok: true });
}
