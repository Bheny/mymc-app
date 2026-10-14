import { prisma } from "@/lib/prisma";
import { canManageNode } from "@/lib/evangelism";
import { actorViews } from "@/lib/member-moves";
import { json, parseDate, readBody, requireEvangelismUser } from "@/lib/evangelism-api";

// POST /api/evangelism/contacts/[id]/convert   { lastName?, joinedDate? }
// Add someone to their cell as a member. Allowed at any point after they've come to a service:
// most wait for the conversation with the buscentre head, but some decide at the very first
// meeting, and that is fine too. Nothing here requires 3 visits or a conversation.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireEvangelismUser();
  if ("error" in auth) return auth.error;

  const c = await prisma.contact.findUnique({
    where: { id: params.id },
    include: { firstTimer: { select: { id: true, convertedToMemberId: true } } },
  });
  if (!c || c.archivedAt || c.mergedIntoId) return json({ error: "Not found" }, 404);

  // The cell shepherd, or anyone above them, can add someone to their part of the church
  const views = (await actorViews(auth.user.id)).filter((v) => v.role !== "shepherd");
  if (!views.some((v) => canManageNode(v, c))) return json({ error: "Only the cell shepherd or a leader above can add a member" }, 403);

  if (c.convertedMemberId || c.stage === "CONVERTED") return json({ error: "They are already a member" }, 409);
  if (c.stage !== "ATTENDED" && !(c.stage === "NOT_INTERESTED" && c.firstTimer)) {
    return json({ error: "They need to have come to a service first" }, 409);
  }
  if (!c.cellId) return json({ error: "Assign them to a cell first — that is where they'll be added", code: "NEEDS_CELL" }, 400);

  const b = (await readBody(request)) ?? {};
  const lastName = (typeof b.lastName === "string" ? b.lastName.trim() : "") || c.lastName?.trim() || "";
  if (!lastName) return json({ error: "Add their surname to create the member record", code: "NEEDS_SURNAME" }, 400);
  const joined = parseDate(b.joinedDate) ?? new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");

  const spokeFirst = !!c.conversationAt;
  const now = new Date();
  const member = await prisma.$transaction(async (tx) => {
    const m = await tx.member.create({
      data: { firstName: c.firstName, lastName, phone: c.phone, gender: c.gender, cellId: c.cellId, joinedDate: joined, isActive: true, isUser: false },
    });
    await tx.contact.update({
      where: { id: c.id },
      data: { stage: "CONVERTED", convertedMemberId: m.id, convertedAt: now, lastActivityAt: now, ...(c.lastName ? {} : { lastName }) },
    });
    // Keep the first-timer record's "became a member" in step, so first-timer counts stay right
    if (c.firstTimer && !c.firstTimer.convertedToMemberId) {
      await tx.firstTimer.update({ where: { id: c.firstTimer.id }, data: { convertedToMemberId: m.id, convertedAt: now, convertedById: auth.user.id } });
    }
    await tx.contactActivity.create({
      data: { contactId: c.id, type: "STAGE_CHANGE", byUserId: auth.user.id,
        note: spokeFirst ? "Became a member, after the conversation with the buscentre head" : "Became a member straight away, without waiting for a conversation" },
    });
    return m;
  });

  return json({ ok: true, memberId: member.id, path: spokeFirst ? "AFTER_CONVERSATION" : "STRAIGHT_AWAY" }, 201);
}
