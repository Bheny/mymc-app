import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canWorkNode, findContactByPhone, getEvangelismUser, normalizePhone, resolveNode } from "@/lib/evangelism";
import { json } from "@/lib/evangelism-api";

// today's guests first, then people who missed an earlier invite, then future invites
const DUE_ORDER: Record<string, number> = { TODAY: 0, MISSED: 1, LATER: 2 };
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

// GET /api/evangelism/expected-guests?cellId=&date=YYYY-MM-DD
//   &q=name-or-phone   → also search people held by this cell / its buscentre
//   &phone=            → is this number someone we already know?
//
// Powers the attendance page: who was invited to come, so one tap turns an
// invited contact into a first timer.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return json({ error: "Unauthorised" }, 401);
  const user = await getEvangelismUser(session.user.id);
  if (!user) return json({ error: "No access" }, 403);

  const sp     = new URL(request.url).searchParams;
  const cellId = sp.get("cellId");
  if (!cellId) return json({ error: "cellId is required" }, 400);
  const date   = sp.get("date") ?? dayKey(new Date());

  // Same rule as taking attendance: your own cell, a cell you're acting up in,
  // or one inside your scope
  const acting = ((session.user.actingAt ?? {}) as Record<string, string>).cell_id;
  const cell = await resolveNode("CELL", cellId);
  if (!cell) return json({ error: "Cell not found" }, 404);
  if (cellId !== session.user.cellId && cellId !== acting && !canWorkNode(user, cell)) {
    return json({ error: "No access to this cell" }, 403);
  }

  const pick = {
    id: true, firstName: true, lastName: true, phone: true, homeArea: true, stage: true, doNotContact: true,
  } satisfies Prisma.ContactSelect;
  const hide = <T extends { doNotContact: boolean; phone: string | null }>(c: T) => (c.doNotContact ? { ...c, phone: null } : c);

  // ── Phone lookup ──
  const phone = sp.get("phone");
  if (phone) {
    const norm = normalizePhone(phone);
    const hit  = norm ? await findContactByPhone(cell.branchId, norm) : null;
    if (!hit) return json({ match: null });
    const full = await prisma.contact.findUnique({ where: { id: hit.id }, select: { ...pick, convertedMemberId: true, firstTimer: { select: { id: true } } } });
    return json({
      match: full && {
        id: full.id, firstName: full.firstName, lastName: full.lastName, stage: full.stage, homeArea: full.homeArea,
        attendedBefore: !!full.firstTimer || !!full.convertedMemberId || full.stage === "ATTENDED" || full.stage === "CONVERTED",
      },
    });
  }

  const base: Prisma.ContactWhereInput = {
    branchId: cell.branchId, archivedAt: null, mergedIntoId: null,
    firstTimer: null, convertedMemberId: null,
  };

  // ── Search by name / number ──
  const q = sp.get("q")?.trim();
  if (q) {
    const digits = q.replace(/\D/g, "");
    const rows = await prisma.contact.findMany({
      where: {
        ...base,
        stage: { notIn: ["ATTENDED", "CONVERTED"] },
        // Held by this cell, or by its buscentre/MC without a cell yet
        AND: [
          { OR: [
            { cellId },
            { cellId: null, buscentreId: cell.buscentreId },
            { cellId: null, buscentreId: null, mcId: cell.mcId },
          ] },
          { OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName:  { contains: q, mode: "insensitive" } },
            ...(digits.length >= 4 ? [{ phoneNormalized: { contains: digits.slice(-9) } }] : []),
          ] },
        ],
      },
      select: pick, take: 8, orderBy: { lastActivityAt: "desc" },
    });
    return json({ results: rows.map(hide) });
  }

  // ── Expected guests: invited and held by this cell ──
  const invited = await prisma.contact.findMany({
    where: { ...base, cellId, stage: "INVITED" },
    select: {
      ...pick,
      activities: {
        where: { type: "INVITED" }, orderBy: { createdAt: "desc" }, take: 1,
        select: { invitedServiceDate: true, invitedServiceType: true },
      },
    },
    take: 100,
  });

  const expected = invited.map((c) => {
    const inv = c.activities[0];
    const when = inv?.invitedServiceDate ? dayKey(inv.invitedServiceDate) : null;
    return {
      ...hide({ ...c, activities: undefined }),
      invitedFor: when, invitedType: inv?.invitedServiceType ?? null,
      due: when === date ? "TODAY" : when && when < date ? "MISSED" : "LATER",
    };
  }).sort((a, b) => (DUE_ORDER[a.due] ?? 3) - (DUE_ORDER[b.due] ?? 3));

  // Guests who've already had their first visit and aren't members yet: one tap says they came again.
  // Showing how many services they've come to this month makes it plain who is nearing 3.
  const monthPrefix = date.slice(0, 7);
  const returningRows = await prisma.contact.findMany({
    where: {
      branchId: cell.branchId, archivedAt: null, mergedIntoId: null, convertedMemberId: null,
      cellId, stage: "ATTENDED", firstTimer: { isNot: null },
    },
    select: {
      ...pick,
      firstTimer: { select: { service: { select: { id: true, date: true } } } },
      guestVisits: { select: { service: { select: { id: true, date: true } } } },
    },
    take: 100,
  });
  const returning = returningRows.map((c) => {
    const byService = new Map<string, string>();
    if (c.firstTimer) byService.set(c.firstTimer.service.id, dayKey(c.firstTimer.service.date));
    c.guestVisits.forEach((g) => byService.set(g.service.id, dayKey(g.service.date)));
    const dates = Array.from(byService.values()).sort();
    return {
      ...hide({ id: c.id, firstName: c.firstName, lastName: c.lastName, phone: c.phone, homeArea: c.homeArea, stage: c.stage, doNotContact: c.doNotContact }),
      visitsThisMonth: dates.filter((d) => d.startsWith(monthPrefix)).length, lastVisit: dates[dates.length - 1] ?? null,
    };
  }).sort((a, b) => b.visitsThisMonth - a.visitsThisMonth || a.firstName.localeCompare(b.firstName));

  return json({ expected, returning });
}
