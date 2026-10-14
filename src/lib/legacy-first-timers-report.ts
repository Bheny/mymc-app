// Builds the first timers summary as WhatsApp-formatted text (*bold*, _italic_, bullets).
// Client-safe, pure.

import type { FirstTimerSummary } from "@/lib/legacy-first-timers";

export const FIRST_TIMER_REPORT_SECTIONS = {
  headline:    "Headline numbers",
  months:      "Registered per month",
  mcs:         "Follow-up by MC",
  areas:       "Campus / area",
  departments: "Departments they'd like to join",
  handlers:    "Who's following up",
  notes:       "Needs attention",
} as const;

export type FirstTimerReportSection = keyof typeof FIRST_TIMER_REPORT_SECTIONS;

export type FirstTimerReportInput = {
  title:           string;                 // e.g. "Lampo · October"
  summary:         FirstTimerSummary;
  notes:           string[];
  reportedByCells: number;                 // first timers the cells' reports counted (0 = unknown)
  period:          string;                 // "all" or YYYY-MM
  monthLabel:      (key: string) => string;
  sections:        Record<FirstTimerReportSection, boolean>;
  today?:          Date;
};

const n = (x: number) => x.toLocaleString("en-GB");
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const plural = (c: number, w: string) => `${n(c)} ${w}${c === 1 ? "" : "s"}`;

/** How many items each section would list — also tells the picker what's worth including. */
export function firstTimerReportCounts(
  s: FirstTimerSummary, notes: string[], period: string,
): Record<FirstTimerReportSection, number> {
  return {
    headline:    s.total ? 1 : 0,
    months:      period === "all" && s.byMonth.length > 1 ? s.byMonth.length : 0,
    mcs:         s.byMc.length > 1 ? s.byMc.length : 0,
    areas:       s.byArea.length,
    departments: s.byDepartment.length,
    handlers:    s.byHandler.length,
    notes:       notes.length,
  };
}

export function buildFirstTimersReport(input: FirstTimerReportInput): string {
  const { summary: s, notes, sections, period, monthLabel, reportedByCells } = input;
  const today = input.today ?? new Date();
  const counts = firstTimerReportCounts(s, notes, period);
  const recorded = s.total - s.status.NONE;
  const blocks: string[] = [];

  if (sections.headline && counts.headline) {
    const lines = [
      `• Registered: *${n(s.total)}*` +
        (reportedByCells > 0 ? ` (cells reported ${n(reportedByCells)} · ${pct(s.total, reportedByCells)}% registered)` : ""),
      `• Want to join: *${n(s.intent.JOIN)}* (${pct(s.intent.JOIN, s.total)}%) · ${n(s.intent.UNSURE)} unsure · ${n(s.intent.VISITING)} just visiting`,
      `• Follow-up recorded: *${pct(recorded, s.total)}%* (${n(recorded)} of ${n(s.total)})`,
      `• Established: *${n(s.status.ESTABLISHED)}*` + (recorded ? ` (${pct(s.status.ESTABLISHED, recorded)}% of those followed up)` : ""),
      `• Being worked on: *${n(s.status.WORKING)}* · Cannot work with: *${n(s.status.CANNOT)}*`,
    ];
    blocks.push(`📊 *${FIRST_TIMER_REPORT_SECTIONS.headline}*\n${lines.join("\n")}`);
  }

  if (sections.months && counts.months) {
    blocks.push(
      `📅 *${FIRST_TIMER_REPORT_SECTIONS.months}*\n` +
      s.byMonth.map((m) => `• ${monthLabel(m.month)} — ${n(m.count)}`).join("\n"),
    );
  }

  if (sections.mcs && counts.mcs) {
    const lines = s.byMc.map((m) =>
      `• *${m.mc}* — ${n(m.total)} registered · ${n(m.established)} established · ${n(m.working)} working on · ` +
      `${n(m.cannot)} cannot · ${pct(m.total - m.none, m.total)}% followed up`);
    blocks.push(`🏛️ *${FIRST_TIMER_REPORT_SECTIONS.mcs}*\n${lines.join("\n")}`);
  }

  if (sections.areas && counts.areas) {
    blocks.push(`🎓 *${FIRST_TIMER_REPORT_SECTIONS.areas}*\n` + s.byArea.map((a) => `• ${a.name} — ${n(a.count)}`).join("\n"));
  }

  if (sections.departments && counts.departments) {
    blocks.push(
      `🙌 *${FIRST_TIMER_REPORT_SECTIONS.departments}*\n_People can pick more than one._\n` +
      s.byDepartment.map((d) => `• ${d.name} — ${n(d.count)}`).join("\n"),
    );
  }

  if (sections.handlers && counts.handlers) {
    const lines = s.byHandler.map((h) => {
      const parts = [
        h.established ? `${n(h.established)} established` : null,
        h.working ? `${n(h.working)} working on` : null,
        h.cannot ? `${n(h.cannot)} cannot work with` : null,
      ].filter(Boolean);
      return `• *${h.name}* — ${n(h.total)}${parts.length ? ` (${parts.join(" · ")})` : ""}`;
    });
    blocks.push(
      `🤝 *${FIRST_TIMER_REPORT_SECTIONS.handlers}*\n_${n(s.withHandler)} of ${n(s.total)} have a handler recorded._\n` + lines.join("\n"),
    );
  }

  if (sections.notes && counts.notes) {
    blocks.push(`⚠️ *${FIRST_TIMER_REPORT_SECTIONS.notes}*\n` + notes.map((x) => `• ${x}`).join("\n"));
  }

  const date = today.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const header = `🌱 *First timers — ${input.title}*\n_${date} · ${plural(s.total, "registration")}_`;
  return blocks.length ? `${header}\n\n${blocks.join("\n\n")}` : `${header}\n\n_Nothing selected._`;
}
