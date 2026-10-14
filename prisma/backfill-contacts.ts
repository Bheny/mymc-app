/**
 * One-off: give every existing first timer and soul a Contact, so Contact is the
 * single record of everyone we've met.
 *
 *   npx tsx prisma/backfill-contacts.ts            # DRY RUN — does everything, then rolls back
 *   npx tsx prisma/backfill-contacts.ts --apply    # keep the changes
 *
 * Safe to re-run: first timers that already have a contact are skipped, and each
 * soul's encounter carries a `backfill:soul:<id>` key. Nothing is deleted or
 * overwritten — first_timers and souls keep all their columns.
 *
 *   First timer → Contact (source WALK_IN; ATTENDED, or CONVERTED if they became
 *                 a member) linked via first_timers.contact_id. Reach-out colour
 *                 and note become a NOTE in the contact's history.
 *   Soul        → Contact (source CELL_SOUL, stage NEW) plus one Encounter. If the
 *                 number belongs to a first timer / contact already created, the
 *                 encounter is added to that person instead of making a duplicate.
 *                 If it belongs to a current member, the contact is CONVERTED and
 *                 linked to them — that's how long-standing members get their
 *                 "how did they come in" record.
 *
 * Same phone number = same person (the app-wide rule). People with no number
 * can't be matched, so they're listed for a human to review.
 */

import { PrismaClient, Prisma, ContactStage } from "@prisma/client";
import { normalizePhone } from "../src/lib/evangelism";

const APPLY = process.argv.includes("--apply");

// Interactive transactions don't work through the pooled connection
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } },
});

class DryRun extends Error {}

type Placement = { branchId: string; mcId: string; buscentreId: string; cellId: string };

const report = {
  firstTimers: { seen: 0, linkedNew: 0, linkedExisting: 0, converted: 0, repeatVisits: [] as string[], noPhoneNameTwins: [] as string[], noCell: 0 },
  souls:       { seen: 0, newContacts: 0, addedToExisting: 0, alreadyDone: 0, becameMemberLinks: 0, memberLinkConflicts: [] as string[], noCell: 0 },
  contactsCreated: 0,
};

const full = (p: { firstName: string; lastName?: string | null }) => [p.firstName, p.lastName].filter(Boolean).join(" ");

async function run(tx: Prisma.TransactionClient) {
  // ── Lookups ──
  const cells = await tx.cell.findMany({
    select: { id: true, buscentreId: true, buscentre: { select: { mcId: true, mc: { select: { branchId: true } } } } },
  });
  const placement = new Map<string, Placement>(cells.map((c) => [c.id, {
    branchId: c.buscentre.mc.branchId, mcId: c.buscentre.mcId, buscentreId: c.buscentreId, cellId: c.id,
  }]));

  // Members by (branch, normalized phone)
  const members = await tx.member.findMany({
    where: { phone: { not: null } },
    select: {
      id: true, firstName: true, lastName: true, phone: true,
      cell:      { select: { buscentre: { select: { mc: { select: { branchId: true } } } } } },
      buscentre: { select: { mc: { select: { branchId: true } } } },
      mc:        { select: { branchId: true } },
    },
  });
  const memberByPhone = new Map<string, { id: string; name: string }>();
  for (const m of members) {
    const branchId = m.cell?.buscentre.mc.branchId ?? m.buscentre?.mc.branchId ?? m.mc?.branchId;
    const n = normalizePhone(m.phone);
    if (branchId && n) memberByPhone.set(`${branchId}|${n}`, { id: m.id, name: full(m) });
  }

  // Contacts that already exist, by phone; and which already have a visit / member attached
  const existing = await tx.contact.findMany({
    select: { id: true, branchId: true, phoneNormalized: true, convertedMemberId: true, firstTimer: { select: { id: true } } },
  });
  const contactByPhone = new Map<string, string>();
  const hasVisit       = new Set<string>();
  const usedMembers    = new Set<string>();
  for (const c of existing) {
    if (c.phoneNormalized) contactByPhone.set(`${c.branchId}|${c.phoneNormalized}`, c.id);
    if (c.firstTimer) hasVisit.add(c.id);
    if (c.convertedMemberId) usedMembers.add(c.convertedMemberId);
  }

  // ── First timers ──
  const firstTimers = await tx.firstTimer.findMany({
    where: { contactId: null },
    orderBy: { createdAt: "asc" },
    include: { service: { select: { date: true } } },
  });
  const nameTwins = new Map<string, string[]>();

  for (const ft of firstTimers) {
    report.firstTimers.seen++;
    const where = placement.get(ft.cellId);
    if (!where) { report.firstTimers.noCell++; continue; }

    const phoneNorm = normalizePhone(ft.phone);
    const key       = phoneNorm ? `${where.branchId}|${phoneNorm}` : null;
    const stage: ContactStage = ft.convertedToMemberId ? "CONVERTED" : "ATTENDED";
    let contactId = key ? contactByPhone.get(key) ?? null : null;

    if (contactId) {
      // Same number already tied to a visit → the person came before; the unique
      // link allows one visit per contact, so this one stays unlinked for review
      if (hasVisit.has(contactId)) {
        report.firstTimers.repeatVisits.push(`${full(ft)} (${ft.phone}) — ${ft.service.date.toISOString().slice(0, 10)}`);
        continue;
      }
      await tx.contact.update({
        where: { id: contactId },
        data: { stage, ...(ft.convertedToMemberId && !usedMembers.has(ft.convertedToMemberId)
          ? { convertedMemberId: ft.convertedToMemberId, convertedAt: ft.convertedAt } : {}) },
      });
      report.firstTimers.linkedExisting++;
    } else {
      const created = await tx.contact.create({
        data: {
          firstName: ft.firstName, lastName: ft.lastName || null,
          phone: ft.phone, phoneNormalized: phoneNorm,
          homeArea: ft.location,
          stage, source: "WALK_IN",
          ...where,
          firstMetAt: ft.service.date,
          lastActivityAt: ft.reachedOutAt ?? ft.convertedAt ?? ft.createdAt,
          ...(ft.convertedToMemberId && !usedMembers.has(ft.convertedToMemberId)
            ? { convertedMemberId: ft.convertedToMemberId, convertedAt: ft.convertedAt } : {}),
        },
      });
      contactId = created.id;
      report.contactsCreated++;
      report.firstTimers.linkedNew++;
      if (key) contactByPhone.set(key, contactId);
    }
    if (ft.convertedToMemberId) { usedMembers.add(ft.convertedToMemberId); report.firstTimers.converted++; }
    hasVisit.add(contactId);

    await tx.firstTimer.update({ where: { id: ft.id }, data: { contactId } });

    // The old reach-out colour/note becomes part of the person's history
    if (ft.reachOutStatus || ft.reachOutNote) {
      const label = { GREEN: "Committed", YELLOW: "Promising", RED: "Not a fit" }[ft.reachOutStatus ?? ""] ?? "Reached out";
      await tx.contactActivity.create({
        data: {
          contactId, type: "NOTE", byUserId: ft.recordedById, createdAt: ft.reachedOutAt ?? ft.createdAt,
          note: `Earlier follow-up: ${label}${ft.reachOutNote ? ` — ${ft.reachOutNote}` : ""}`,
        },
      });
    }

    if (!phoneNorm) {
      const k = `${ft.cellId}|${full(ft).toLowerCase().replace(/\s+/g, " ")}`;
      nameTwins.set(k, [...(nameTwins.get(k) ?? []), `${full(ft)} — ${ft.service.date.toISOString().slice(0, 10)}`]);
    }
  }
  nameTwins.forEach((v) => { if (v.length > 1) report.firstTimers.noPhoneNameTwins.push(...v); });

  // ── Souls ──
  const souls = await tx.soul.findMany({ orderBy: { date: "asc" } });
  for (const soul of souls) {
    report.souls.seen++;
    const where = placement.get(soul.cellId);
    if (!where) { report.souls.noCell++; continue; }

    const clientRef = `backfill:soul:${soul.id}`;
    if (await tx.encounter.findUnique({ where: { clientRef }, select: { id: true } })) { report.souls.alreadyDone++; continue; }

    const phoneNorm = normalizePhone(soul.phone);
    const key       = phoneNorm ? `${where.branchId}|${phoneNorm}` : null;
    let contactId   = key ? contactByPhone.get(key) ?? null : null;

    if (contactId) {
      const c = await tx.contact.findUnique({ where: { id: contactId }, select: { firstMetAt: true } });
      if (c && soul.date < c.firstMetAt) await tx.contact.update({ where: { id: contactId }, data: { firstMetAt: soul.date } });
      report.souls.addedToExisting++;
    } else {
      // A soul whose number is a current member's: they came in through this outreach
      const member = key ? memberByPhone.get(key) : undefined;
      const linkMember = member && !usedMembers.has(member.id) ? member : undefined;
      if (member && !linkMember) report.souls.memberLinkConflicts.push(`${full(soul)} (${soul.phone}) matches member ${member.name}, who is already linked to another contact`);

      const created = await tx.contact.create({
        data: {
          firstName: soul.firstName, lastName: soul.lastName || null,
          phone: soul.phone, phoneNormalized: phoneNorm,
          homeArea: soul.location, notes: soul.notes,
          stage: linkMember ? "CONVERTED" : "NEW", source: "CELL_SOUL",
          ...where,
          firstMetAt: soul.date, lastActivityAt: soul.updatedAt,
          ...(linkMember ? { convertedMemberId: linkMember.id, convertedAt: soul.updatedAt } : {}),
        },
      });
      contactId = created.id;
      report.contactsCreated++;
      report.souls.newContacts++;
      if (linkMember) { usedMembers.add(linkMember.id); report.souls.becameMemberLinks++; }
      if (key) contactByPhone.set(key, contactId);
    }

    await tx.encounter.create({
      data: {
        contactId, outreachId: null, metAt: soul.date, metLocation: soul.location, notes: soul.notes,
        response: "NEUTRAL", recordedById: soul.recordedById, clientRef, createdAt: soul.createdAt,
      },
    });
  }
}

async function main() {
  console.log(APPLY ? "\n▶ APPLY — changes will be kept\n" : "\n▶ DRY RUN — everything is rolled back at the end\n");
  try {
    await prisma.$transaction(async (tx) => {
      await run(tx);
      if (!APPLY) throw new DryRun();
    }, { timeout: 10 * 60_000, maxWait: 60_000 });
  } catch (e) {
    if (!(e instanceof DryRun)) throw e;
  }

  const ft = report.firstTimers, s = report.souls;
  const list = (title: string, items: string[]) => {
    if (!items.length) return;
    console.log(`\n  ${title} (${items.length})`);
    items.slice(0, 25).forEach((i) => console.log(`    · ${i}`));
    if (items.length > 25) console.log(`    … and ${items.length - 25} more`);
  };

  console.log("First timers");
  console.log(`  examined:                ${ft.seen}`);
  console.log(`  new contacts created:    ${ft.linkedNew}`);
  console.log(`  linked to a known person:${ft.linkedExisting}`);
  console.log(`  already members:         ${ft.converted}`);
  if (ft.noCell) console.log(`  skipped (cell missing):  ${ft.noCell}`);
  list("Repeat visits — same number came again; left unlinked (one visit per person)", ft.repeatVisits);
  list("No phone number, same name in the same cell — possible duplicates to merge by hand", ft.noPhoneNameTwins);

  console.log("\nSouls");
  console.log(`  examined:                ${s.seen}`);
  console.log(`  new contacts created:    ${s.newContacts}`);
  console.log(`  added to a known person: ${s.addedToExisting}`);
  console.log(`  matched a current member:${s.becameMemberLinks}`);
  console.log(`  already backfilled:      ${s.alreadyDone}`);
  if (s.noCell) console.log(`  skipped (cell missing):  ${s.noCell}`);
  list("Member links that conflicted", s.memberLinkConflicts);

  console.log(`\nContacts created in total: ${report.contactsCreated}`);
  console.log(APPLY ? "\n✔ Applied.\n" : "\nNothing was changed. Re-run with --apply to keep this.\n");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
