import { ContactActivityType, ServiceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canWorkNode, contactWhere, stageAfterActivity } from "@/lib/evangelism";
import { json, parseDate, readBody, requireEvangelismUser } from "@/lib/evangelism-api";

const LOGGABLE: ContactActivityType[] = ["CALL", "WHATSAPP", "VISIT", "INVITED", "NOTE"];
const SERVICES: ServiceType[]         = ["LC_LIVE", "MGS", "SPECIAL_MEETING"];

// POST /api/evangelism/contacts/[id]/activities
// Log a follow-up. CALL / WHATSAPP / VISIT move NEW → CONTACTED; INVITED (with
// the service date) moves them to INVITED. Never moves anyone backwards.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireEvangelismUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const c = await prisma.contact.findFirst({ where: { id: params.id, ...contactWhere(user) } });
  if (!c) return json({ error: "Not found" }, 404);
  if (!canWorkNode(user, c)) return json({ error: "Not allowed" }, 403);

  const b = await readBody(request);
  if (!b) return json({ error: "Invalid JSON" }, 400);

  const type = b.type as ContactActivityType;
  if (!LOGGABLE.includes(type)) return json({ error: "type must be CALL, WHATSAPP, VISIT, INVITED or NOTE" }, 400);
  if (c.doNotContact && type !== "NOTE") return json({ error: "This person asked not to be contacted", code: "DO_NOT_CONTACT" }, 409);

  const note    = typeof b.note === "string" ? b.note.trim() || null : null;
  const outcome = typeof b.outcome === "string" ? b.outcome.trim() || null : null;
  if (type === "NOTE" && !note) return json({ error: "A note needs some text" }, 400);

  let invitedServiceDate: Date | null = null;
  let invitedServiceType: ServiceType | null = null;
  if (type === "INVITED") {
    invitedServiceDate = parseDate(b.invitedServiceDate) ?? null;
    if (!invitedServiceDate) return json({ error: "Say which service date they were invited to" }, 400);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (invitedServiceDate < today) return json({ error: "The service date can't be in the past" }, 400);
    invitedServiceType = (b.invitedServiceType as ServiceType) ?? null;
    if (invitedServiceType && !SERVICES.includes(invitedServiceType)) return json({ error: "Invalid service type" }, 400);
  }

  const stage = stageAfterActivity(c.stage, type);
  const [activity] = await prisma.$transaction([
    prisma.contactActivity.create({
      data: { contactId: c.id, type, note, outcome, invitedServiceDate, invitedServiceType, byUserId: user.id },
    }),
    prisma.contact.update({ where: { id: c.id }, data: { stage, lastActivityAt: new Date() } }),
  ]);

  return json({ activity, stage }, 201);
}
