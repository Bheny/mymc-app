import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DashContact } from "@/lib/attendance-dashboard";

const day = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Outreach contacts in a scope who were first met on or after `since`, as the compact rows the
 * summaries work from. `missed` marks someone invited to a service that has passed without them
 * coming. Returns [] if the evangelism tables aren't there yet.
 */
export async function loadContactRows(where: Prisma.ContactWhereInput, since: Date, now: Date): Promise<DashContact[]> {
  try {
    const rows = await prisma.contact.findMany({
      where: { ...where, archivedAt: null, mergedIntoId: null, firstMetAt: { gte: since } },
      select: { id: true, cellId: true, buscentreId: true, mcId: true, stage: true, firstMetAt: true, lastActivityAt: true },
    });
    const invitedIds = rows.filter((c) => c.stage === "INVITED").map((c) => c.id);
    const lastInvite = new Map<string, Date>();
    if (invitedIds.length) {
      const inv = await prisma.contactActivity.findMany({
        where: { contactId: { in: invitedIds }, type: "INVITED", invitedServiceDate: { not: null } },
        select: { contactId: true, invitedServiceDate: true },
      });
      for (const i of inv) {
        const prev = lastInvite.get(i.contactId);
        if (i.invitedServiceDate && (!prev || i.invitedServiceDate > prev)) lastInvite.set(i.contactId, i.invitedServiceDate);
      }
    }
    const todayStart = new Date(day(now) + "T00:00:00Z");
    return rows.map((c) => ({
      cellId: c.cellId, buscentreId: c.buscentreId, mcId: c.mcId, stage: c.stage, met: day(c.firstMetAt), last: day(c.lastActivityAt),
      missed: c.stage === "INVITED" && (lastInvite.get(c.id) ?? todayStart) < todayStart,
    }));
  } catch {
    return [];
  }
}
