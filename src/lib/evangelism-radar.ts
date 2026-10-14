import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { radarStatus, type RadarStatus } from "@/lib/radar";

// Who has come often enough that the buscentre head should speak to them, and who has said
// they want to join but hasn't been added to a cell yet.

// Buscentre heads hold these conversations, and so do the leaders above them
export const CONVERSATION_ROLES = ["buscentre_head", "mc_pastor", "chief_shepherd", "admin"];

export type RadarPerson = {
  id: string; name: string; phone: string | null; cellId: string | null; cellName: string | null;
  group: "radar" | "nearly" | "wants";
  visits: number;                 // services attended this month
  visitDates: string[];           // every guest service in this and last month, oldest first
  firstVisit: string | null;
  reachedOn: string | null;       // the day they reached 3 services
  conversation: { at: string; outcome: string | null; note: string | null } | null;
};

const day = (d: Date) => d.toISOString().slice(0, 10);

export async function radarFor(where: Prisma.ContactWhereInput, today: string): Promise<RadarPerson[]> {
  const contacts = await prisma.contact.findMany({
    where: { ...where, archivedAt: null, mergedIntoId: null, stage: "ATTENDED", convertedMemberId: null },
    select: {
      id: true, firstName: true, lastName: true, phone: true, doNotContact: true, cellId: true, cell: { select: { name: true } },
      conversationAt: true, conversationOutcome: true, conversationNote: true,
      firstTimer: { select: { service: { select: { id: true, date: true } } } },
      guestVisits: { select: { service: { select: { id: true, date: true } } } },
    },
  });

  const out: RadarPerson[] = [];
  for (const c of contacts) {
    // One entry per distinct service, whether it was their first visit or a return
    const byService = new Map<string, string>();
    if (c.firstTimer) byService.set(c.firstTimer.service.id, day(c.firstTimer.service.date));
    c.guestVisits.forEach((g) => byService.set(g.service.id, day(g.service.date)));
    const dates = Array.from(byService.values()).sort();
    const conv = c.conversationAt ? day(c.conversationAt) : null;
    const status: RadarStatus = radarStatus(dates, conv, today);

    const wants = c.conversationOutcome === "WANTS_TO_JOIN";
    const group = status.state === "radar" ? "radar" : wants ? "wants" : status.state === "nearly" ? "nearly" : null;
    if (!group) continue;

    out.push({
      id: c.id, name: [c.firstName, c.lastName].filter(Boolean).join(" "), phone: c.doNotContact ? null : c.phone,
      cellId: c.cellId, cellName: c.cell?.name ?? null, group,
      visits: status.visits, visitDates: dates.filter((d) => d.slice(0, 7) >= prevMonth(today)), firstVisit: dates[0] ?? null,
      reachedOn: status.state === "radar" ? status.reachedOn : null,
      conversation: c.conversationAt ? { at: c.conversationAt.toISOString(), outcome: c.conversationOutcome, note: c.conversationNote } : null,
    });
  }
  const rank = { radar: 0, wants: 1, nearly: 2 } as const;
  return out.sort((a, b) => rank[a.group] - rank[b.group] || b.visits - a.visits || a.name.localeCompare(b.name));
}

function prevMonth(today: string): string {
  const [y, m] = today.slice(0, 7).split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}
