/**
 * One-off: make the platform look as though it launched on 1 October 2026 by removing attendance
 * and related activity recorded BEFORE that date. People, cells, leaders and everything dated on
 * or after the launch are left alone, and so is the Legacy side (it lives in a Google Sheet).
 *
 *   npx tsx prisma/reset-to-launch.ts                       # DRY RUN: counts only, changes nothing
 *   npx tsx prisma/reset-to-launch.ts --apply --confirm-host=<host shown in the dry run>
 *
 * Always removed (only rows dated before the cutoff):
 *   · services                (their attendance marks and first-timer records go with them)
 *   · souls                   (the soul tracker entries)
 *   · absence notifications   (the "11 absent — MGS 6 Sept" alerts)
 * Opt-in:
 *   --capacity-warnings       capacity warnings logged before the cutoff
 *   --status-history          active/inactive history rows before the cutoff
 *   --before=YYYY-MM-DD       a different cutoff (default 2026-10-01)
 *
 * Before deleting, every row that will be removed is saved to prisma/backups/ as JSON, so it can be
 * restored by hand if needed. That file contains names, so keep it private (it is git-ignored).
 * The deletion runs in one transaction: it all happens or none of it does.
 */

import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const arg = (name: string) => process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const val = (name: string) => arg(name)?.split("=")[1];
const APPLY = !!arg("apply");
const CUTOFF = val("before") ?? "2026-10-01";
const WITH_WARNINGS = !!arg("capacity-warnings");
const WITH_STATUS = !!arg("status-history");

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";
const host = (() => { try { return new URL(url).host; } catch { return "(unknown)"; } })();
const prisma = new PrismaClient({ datasources: { db: { url } } });
const before = new Date(CUTOFF + "T00:00:00Z");

async function main() {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(CUTOFF) || isNaN(before.getTime())) throw new Error(`Bad --before date: ${CUTOFF}`);
  if (before.getTime() > Date.now()) throw new Error("The cutoff is in the future — that would delete current data. Stopping.");

  console.log(`\nDatabase: ${host}`);
  console.log(`Cutoff:   everything dated before ${CUTOFF}`);
  console.log(APPLY ? "Mode:     APPLY (will delete)\n" : "Mode:     DRY RUN (nothing is changed)\n");

  const services = await prisma.service.findMany({
    where: { date: { lt: before } },
    orderBy: { date: "asc" },
    include: { attendance: true, firstTimers: true },
  });
  const souls = await prisma.soul.findMany({ where: { date: { lt: before } } });
  const alerts = await prisma.notification.findMany({ where: { type: "absent_member", createdAt: { lt: before } } });
  const warnings = WITH_WARNINGS ? await prisma.capacityWarning.findMany({ where: { createdAt: { lt: before } } }) : [];
  const status = WITH_STATUS ? await prisma.memberStatusChange.findMany({ where: { createdAt: { lt: before } } }) : [];

  const marks = services.reduce((n, s) => n + s.attendance.length, 0);
  const visits = services.flatMap((s) => s.firstTimers);
  const kept = await prisma.service.count({ where: { date: { gte: before } } });

  console.log("Will remove:");
  console.log(`  ${String(services.length).padStart(4)}  services   (${marks} attendance marks, ${visits.length} first-timer records)`);
  services.forEach((s) => console.log(`          ${s.date.toISOString().slice(0, 10)}  ${s.type.padEnd(18)} ${s.attendance.length} marks`));
  console.log(`  ${String(souls.length).padStart(4)}  souls`);
  console.log(`  ${String(alerts.length).padStart(4)}  absence notifications`);
  if (WITH_WARNINGS) console.log(`  ${String(warnings.length).padStart(4)}  capacity warnings`);
  if (WITH_STATUS)   console.log(`  ${String(status.length).padStart(4)}  member status history rows`);
  console.log(`\nStays untouched: ${kept} service(s) on or after ${CUTOFF}, all members, cells, leaders, evangelism records and the Legacy sheet.`);

  // A first-timer visit that is an evangelism contact's one visit: deleting it would leave that contact
  // marked as having attended with no visit behind it. Asked of the database directly, so this check
  // works even if the generated Prisma client is older than the schema.
  const linked = await prisma.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM first_timers f JOIN services s ON s.id = f.service_id
    WHERE s.date < ${before} AND f.contact_id IS NOT NULL`;
  if (linked[0]?.n) {
    throw new Error(`${linked[0].n} first-timer record(s) to be deleted are linked to evangelism contacts. Resolve those contacts first (this script will not guess).`);
  }
  // Members who came in as first timers keep their record (they are members now); only the visit is removed.
  const converted = visits.filter((v) => v.convertedToMemberId).length;
  if (converted) console.log(`Note: ${converted} of those first timers became members — the members are kept.`);

  if (!APPLY) {
    console.log("\nNothing was changed. To go ahead:");
    console.log(`  npx tsx prisma/reset-to-launch.ts --apply --confirm-host=${host}${WITH_WARNINGS ? " --capacity-warnings" : ""}${WITH_STATUS ? " --status-history" : ""}\n`);
    return;
  }

  if (val("confirm-host") !== host) {
    throw new Error(`Refusing to delete: add --confirm-host=${host} to confirm this is the database you mean.`);
  }

  // 1. Save everything first
  const dir = path.join(__dirname, "backups");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `reset-before-${CUTOFF}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify({ takenAt: new Date().toISOString(), host, cutoff: CUTOFF, services, souls, alerts, warnings, status }, null, 2));
  console.log(`\nBackup written: ${file}`);

  // 2. Delete, all or nothing
  const result = await prisma.$transaction(async (tx) => {
    const s = await tx.service.deleteMany({ where: { date: { lt: before } } });          // cascades to attendance + first timers
    const o = await tx.soul.deleteMany({ where: { date: { lt: before } } });
    const n = await tx.notification.deleteMany({ where: { type: "absent_member", createdAt: { lt: before } } });
    const w = WITH_WARNINGS ? await tx.capacityWarning.deleteMany({ where: { createdAt: { lt: before } } }) : { count: 0 };
    const h = WITH_STATUS ? await tx.memberStatusChange.deleteMany({ where: { createdAt: { lt: before } } }) : { count: 0 };
    return { services: s.count, souls: o.count, alerts: n.count, warnings: w.count, status: h.count };
  }, { timeout: 60_000 });

  // 3. Check the result
  const left = await prisma.service.count({ where: { date: { lt: before } } });
  const stillKept = await prisma.service.count({ where: { date: { gte: before } } });
  console.log("\nDeleted:", result);
  console.log(`Check: ${left} service(s) before ${CUTOFF} remain (should be 0); ${stillKept} on/after (was ${kept}).`);
  if (left !== 0 || stillKept !== kept) throw new Error("The after-check does not match. Look at the backup file before doing anything else.");
  console.log("\n✔ Done.\n");
}

main().catch((e) => { console.error("\n✖", e instanceof Error ? e.message : e, "\n"); process.exit(1); }).finally(() => prisma.$disconnect());
