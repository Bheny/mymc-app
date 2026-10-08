// Builds the Legacy data-integrity report as WhatsApp-formatted text
// (*bold*, _italic_, simple bullets). Client-safe, pure.

import type { DuplicateGroup, LegacyReport, PossibleDuplicate } from "@/lib/legacy-report";

export const INTEGRITY_SECTIONS = {
  missing:    "Missing reports",
  duplicates: "Submitted more than once",
  sameWeek:   "Same service twice in one week",
  wrongDay:   "Date doesn't match the service day",
  textValues: "Text in number fields",
  retained:   "Retained first timers not recorded",
  directory:  "Cells not in the church directory",
} as const;

export type IntegritySection = keyof typeof INTEGRITY_SECTIONS;

type Leaders = Record<string, { cellShepherd: string | null }>;

export type IntegrityInput = {
  title:      string;             // e.g. "Lampo · October"
  reports:    LegacyReport[];     // the reports in the current view
  missed:     { mc: string; cell: string; services: string[] }[];  // services: "YYYY-MM-DD|MGS" (week start)
  duplicates: DuplicateGroup[];   // differing duplicates only
  possibleDuplicates?: PossibleDuplicate[];  // same cell/service, two dates, one week
  unlisted:   string[];
  ambiguous:  string[];
  leaders:    Leaders;
  multiMc:    boolean;
  sections:   Record<IntegritySection, boolean>;
  today?:     Date;
};

// Expected weekday per service (0 = Sunday)
const SERVICE_DAY: Record<string, { day: number; name: string }> = {
  MGS:       { day: 0, name: "Sunday" },
  "LC LIVE": { day: 3, name: "Wednesday" },
};

const svcName = (s: string) => (s === "MGS" ? "MGS" : s === "LC LIVE" ? "LC Live" : s);

function day(iso: string, withWeekday = true): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC", ...(withWeekday ? { weekday: "short" } : {}), day: "numeric", month: "short",
  });
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The date a service in a given week should have happened on. */
function serviceDate(weekStart: string, service: string): string {
  return addDays(weekStart, SERVICE_DAY[service]?.day ?? 0);
}

function monthName(key: string): string {
  return new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", month: "long" });
}

export function buildIntegrityReport(input: IntegrityInput): { text: string; counts: Record<IntegritySection, number> } {
  const { reports, leaders, multiMc, sections } = input;
  const today = input.today ?? new Date();

  const who = (mc: string, cell: string) => {
    const shepherd = leaders[`${mc}|${cell}`]?.cellShepherd;
    const parts = [multiMc ? mc : null, shepherd].filter(Boolean);
    return parts.length ? ` (${parts.join(" · ")})` : "";
  };
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

  const blocks: string[] = [];
  const counts = {} as Record<IntegritySection, number>;

  // ── Missing reports, per cell ──
  const missing = input.missed.filter((c) => c.services.length)
    .sort((a, b) => b.services.length - a.services.length || a.cell.localeCompare(b.cell));
  counts.missing = missing.reduce((a, c) => a + c.services.length, 0);
  if (sections.missing && missing.length) {
    // Every missing date, one per line, newest first (WhatsApp folds long messages itself)
    const lines = missing.map((c) => {
      const shown = c.services
        .map((ws) => ({ svc: ws.slice(11), date: serviceDate(ws.slice(0, 10), ws.slice(11)) }))
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((d) => `   • ${svcName(d.svc)} · ${day(d.date)}`);
      return `*${c.cell}*${who(c.mc, c.cell)} — ${plural(c.services.length, "missing report")}\n${shown.join("\n")}`;
    });
    blocks.push(`📭 *${INTEGRITY_SECTIONS.missing}* (${counts.missing})\n_Please submit these on the form._\n\n${lines.join("\n\n")}`);
  }

  // ── Duplicates with different numbers ──
  counts.duplicates = input.duplicates.length;
  if (sections.duplicates && input.duplicates.length) {
    const reportMc = new Map(reports.map((r) => [r.id, r.mc]));
    const lines = input.duplicates.map((g) => {
      const mc = reportMc.get(g.id) ?? g.source;
      const subs = g.submissions.map((s) => {
        const sent = new Date(s.submittedAt).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });
        return `sent ${sent}: ${s.attendance} in person, ${s.firstTimers} FT${s.counted ? " _(counted)_" : ""}`;
      });
      return `• *${g.cell}*${who(mc, g.cell)} · ${svcName(g.service)} · ${day(g.date)}\n   ${subs.join("\n   ")}`;
    });
    blocks.push(
      `🔁 *${INTEGRITY_SECTIONS.duplicates}* (${counts.duplicates})\n` +
      `_Same service reported twice with different numbers. If one was meant for another week, correct its date; otherwise delete the wrong row._\n\n` +
      lines.join("\n\n"),
    );
  }

  // ── Same service reported on two dates in one week ──
  const sameWeek = input.possibleDuplicates ?? [];
  counts.sameWeek = sameWeek.length;
  if (sections.sameWeek && sameWeek.length) {
    const reportMc = new Map(reports.map((r) => [r.id, r.mc]));
    const lines = sameWeek.map((g) => {
      const mc = reportMc.get(g.reports[0].id) ?? g.source;
      const dates = g.reports.map((r) => `${day(r.date)} (${r.attendance} in person)`).join(" and ");
      return `• *${g.cell}*${who(mc, g.cell)} · ${svcName(g.service)} — ${dates}`;
    });
    blocks.push(
      `🗓️ *${INTEGRITY_SECTIONS.sameWeek}* (${counts.sameWeek})\n` +
      `_Both are being counted. If one date is wrong, correct it on the sheet; if both services really happened, ignore this._\n\n` +
      lines.join("\n"),
    );
  }

  // ── Date on the wrong weekday for the service ──
  const wrongDay = reports.filter((r) => {
    const want = SERVICE_DAY[r.service];
    return want && new Date(`${r.date}T00:00:00Z`).getUTCDay() !== want.day;
  }).sort((a, b) => b.date.localeCompare(a.date));
  // Also: services dated in the future
  const todayIso = today.toISOString().slice(0, 10);
  const future = reports.filter((r) => r.date > todayIso);
  counts.wrongDay = wrongDay.length + future.filter((r) => !wrongDay.includes(r)).length;
  if (sections.wrongDay && counts.wrongDay) {
    const lines = [
      ...wrongDay.map((r) =>
        `• *${r.cell}*${who(r.mc, r.cell)} · ${svcName(r.service)} dated ${day(r.date)} — ${svcName(r.service)} is on ${SERVICE_DAY[r.service].name}`),
      ...future.filter((r) => !wrongDay.includes(r)).map((r) =>
        `• *${r.cell}*${who(r.mc, r.cell)} · ${svcName(r.service)} dated ${day(r.date)} — that's in the future`),
    ];
    blocks.push(`📅 *${INTEGRITY_SECTIONS.wrongDay}* (${counts.wrongDay})\n_Check the date picked on the form._\n\n${lines.join("\n")}`);
  }

  // ── Text typed into number fields (and other cleaned values) ──
  const noted = reports.filter((r) => r.notes?.length).sort((a, b) => b.date.localeCompare(a.date));
  counts.textValues = noted.reduce((a, r) => a + r.notes.length, 0);
  if (sections.textValues && noted.length) {
    const lines = noted.map((r) =>
      `• *${r.cell}*${who(r.mc, r.cell)} · ${svcName(r.service)} · ${day(r.date)}\n   ${r.notes.join("\n   ")}`);
    blocks.push(`✏️ *${INTEGRITY_SECTIONS.textValues}* (${counts.textValues})\n_Only numbers in count fields — put explanations elsewhere._\n\n${lines.join("\n")}`);
  }

  // ── Retained first timers not recorded for a finished month ──
  const thisMonth = todayIso.slice(0, 7);
  const byCellMonth = new Map<string, { mc: string; cell: string; month: string; firstTimers: number; recorded: boolean }>();
  for (const r of reports) {
    const month = r.date.slice(0, 7);
    if (month >= thisMonth) continue; // the month isn't over yet
    const k = `${r.mc}|${r.cell}|${month}`;
    const e = byCellMonth.get(k) ?? { mc: r.mc, cell: r.cell, month, firstTimers: 0, recorded: false };
    e.firstTimers += r.firstTimers;
    if (r.retained !== null) e.recorded = true;
    byCellMonth.set(k, e);
  }
  const notRecorded = Array.from(byCellMonth.values()).filter((e) => e.firstTimers > 0 && !e.recorded)
    .sort((a, b) => b.month.localeCompare(a.month) || a.cell.localeCompare(b.cell));
  counts.retained = notRecorded.length;
  if (sections.retained && notRecorded.length) {
    const lines = notRecorded.map((e) =>
      `• *${e.cell}*${who(e.mc, e.cell)} — ${monthName(e.month)} (${plural(e.firstTimers, "first timer")})`);
    blocks.push(
      `🌱 *${INTEGRITY_SECTIONS.retained}* (${counts.retained})\n` +
      `_Fill "No. first timers retained" on the last service report of the month._\n\n${lines.join("\n")}`,
    );
  }

  // ── Directory gaps ──
  counts.directory = input.unlisted.length + input.ambiguous.length;
  if (sections.directory && counts.directory) {
    const lines = [
      ...input.unlisted.map((c) => `• ${c} — not listed`),
      ...input.ambiguous.map((c) => `• ${c} — name appears more than once`),
    ];
    blocks.push(`📒 *${INTEGRITY_SECTIONS.directory}* (${counts.directory})\n_Admin: update the Church Directory._\n\n${lines.join("\n")}`);
  }

  // ── Assemble ──
  const generated = today.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const summary = (Object.keys(INTEGRITY_SECTIONS) as IntegritySection[])
    .filter((k) => sections[k] && counts[k])
    .map((k) => `• ${INTEGRITY_SECTIONS[k]}: *${counts[k]}*`);

  const header = `📋 *Legacy data check — ${input.title}*\n_${generated} · ${plural(reports.length, "report")} checked_`;
  const body = summary.length
    ? `${summary.join("\n")}\n\n${blocks.join("\n\n━━━━━━━━━━\n\n")}`
    : "✅ No issues found. Thank you all!";
  const footer = `_Please fix these in the Google Sheet — the dashboard updates within a minute._`;

  return { text: `${header}\n\n${body}\n\n${footer}`, counts };
}
