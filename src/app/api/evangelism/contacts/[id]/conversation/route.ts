import { ConversationOutcome } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canManageNode } from "@/lib/evangelism";
import { actorViews } from "@/lib/member-moves";
import { CONVERSATION_ROLES } from "@/lib/evangelism-radar";
import { CONVERSATION_LABEL } from "@/lib/radar";
import { json, readBody, requireEvangelismUser } from "@/lib/evangelism-api";

const OUTCOMES: ConversationOutcome[] = ["WANTS_TO_JOIN", "STILL_DECIDING", "NOT_STAYING"];

// POST /api/evangelism/contacts/[id]/conversation   { outcome, note? }
// The buscentre head records how their conversation with a regular guest went. It takes them off
// the radar until they qualify again. "Not staying" closes their outreach record; "wants to join"
// leaves them ready to be added to their cell.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireEvangelismUser();
  if ("error" in auth) return auth.error;

  const c = await prisma.contact.findUnique({ where: { id: params.id } });
  if (!c || c.archivedAt || c.mergedIntoId) return json({ error: "Not found" }, 404);

  // Buscentre head or above — including someone covering that role
  const views = (await actorViews(auth.user.id)).filter((v) => CONVERSATION_ROLES.includes(v.role));
  if (!views.some((v) => canManageNode(v, c))) return json({ error: "This conversation is for the buscentre head or above" }, 403);
  if (c.stage !== "ATTENDED") return json({ error: "They need to have come to a service, and not yet be a member" }, 409);

  const b = await readBody(request);
  if (!b) return json({ error: "Invalid JSON" }, 400);
  const outcome = b.outcome as ConversationOutcome;
  if (!OUTCOMES.includes(outcome)) return json({ error: "Choose how the conversation went" }, 400);
  const note = typeof b.note === "string" ? b.note.trim() || null : null;
  if (outcome === "NOT_STAYING" && !note) return json({ error: "Say why — a note is needed when someone isn't staying" }, 400);

  const now = new Date();
  await prisma.$transaction([
    prisma.contact.update({
      where: { id: c.id },
      data: {
        conversationAt: now, conversationById: auth.user.id, conversationOutcome: outcome, conversationNote: note,
        lastActivityAt: now, ...(outcome === "NOT_STAYING" ? { stage: "NOT_INTERESTED" as const } : {}),
      },
    }),
    prisma.contactActivity.create({
      data: { contactId: c.id, type: "NOTE", byUserId: auth.user.id, note: `Conversation with the buscentre head: ${CONVERSATION_LABEL[outcome]}${note ? ` — ${note}` : ""}` },
    }),
  ]);
  return json({ ok: true, outcome });
}
