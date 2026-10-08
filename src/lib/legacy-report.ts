// Turns rows from the Legacy Google Sheet (cell service-report form responses)
// into clean, typed reports. Client-safe — no server imports.

import { cellKey } from "@/lib/legacy-directory";

export type ServiceType = "MGS" | "LC LIVE";

export type LegacyReport = {
  id:             string;  // stable key: mc|cell|date|service
  date:           string;  // service date, YYYY-MM-DD
  submittedAt:    string;  // form timestamp, ISO
  source:         string;  // the sheet it came from
  mc:             string;  // from the church directory; the sheet's name if the cell isn't listed
  formBacenta:    string;  // bacenta as typed on the form (fallback)
  cell:           string;
  bacenta:        string;
  service:        ServiceType | string;
  // In-person attendance by role
  pastor:         number;
  seniorShepherd: number;
  shepherds:      number;
  cellShepherd:   number;
  members:        number;
  firstTimers:    number;
  attendance:     number;  // sum of the six above (the sheet's "Total")
  online:         number;
  soulsWon:       number;
  retained:       number | null;  // filled after the last service of each month
  teens:          number | null;  // MGS teens service
  children:       number | null;  // LC Live children
  // What cleaning changed on this row, for the integrity report
  // e.g. 'Pastor: "0 I'm" read as 0', 'Date: year 2001 corrected to 2026'
  notes:          string[];
};

/** One submission in a duplicate group, as shown for review. */
export type DuplicateSubmission = {
  submittedAt: string;
  attendance:  number;
  online:      number;
  firstTimers: number;
  soulsWon:    number;
  counted:     boolean;  // the one the dashboard uses (the latest)
};

/** The same cell, date and service submitted more than once — flagged for review. */
export type DuplicateGroup = {
  id:          string;   // matches the counted report's id
  source:      string;
  cell:        string;
  date:        string;
  service:     string;
  identical:   boolean;  // every submission has the same numbers — nothing to review
  submissions: DuplicateSubmission[];  // oldest first
};

/**
 * The same cell and service reported on different dates within one week — maybe
 * one report was given the wrong date. Both are counted; flagged for review only.
 */
export type PossibleDuplicate = {
  key:     string;   // source|cell|week|service
  source:  string;
  cell:    string;
  week:    string;   // Sunday the week starts on
  service: string;
  reports: { id: string; date: string; submittedAt: string; attendance: number; firstTimers: number; soulsWon: number }[];
};

export type LegacyIssues = {
  duplicatesRemoved: number;  // extra submissions not counted (flagged as duplicates)
  valuesCleaned:     number;  // text in number cells ("o", "None", "3(2 online)")
  datesFixed:        number;  // year typos corrected from the submission timestamp
  skipped:           number;  // rows without a date or cell
};

// Column → field. Matched case-insensitively on the start of the heading so
// small wording changes in the form don't break the dashboard.
const COLUMNS = {
  timestamp:      ["timestamp"],
  date:           ["date"],
  cell:           ["cell name"],
  service:        ["service type"],
  pastor:         ["pastor"],
  seniorShepherd: ["senior shepherd"],
  shepherds:      ["shepherds"],
  cellShepherd:   ["cell shepherd"],
  members:        ["members"],
  firstTimers:    ["first timers"],
  retained:       ["no. first timers retained", "first timers retained"],
  soulsWon:       ["souls won"],
  online:         ["total number of people who joined online", "online"],
  teens:          ["teens"],
  children:       ["number of children", "children"],
  bacenta:        ["bacenta"],
} as const;

type Field = keyof typeof COLUMNS;
const REQUIRED: Field[] = ["date", "cell", "service", "members"];

export function mapColumns(headers: string[]): { map: Partial<Record<Field, string>>; missing: Field[] } {
  const norm = headers.map((h) => ({ h, n: h.toLowerCase().trim() }));
  const map: Partial<Record<Field, string>> = {};
  for (const [field, aliases] of Object.entries(COLUMNS) as [Field, readonly string[]][]) {
    // Exact match first (so "Shepherds" doesn't grab "Senior Shepherd"), then prefix
    const hit =
      norm.find(({ n }) => aliases.includes(n)) ??
      norm.find(({ n }) => aliases.some((a) => n.startsWith(a)));
    if (hit) map[field] = hit.h;
  }
  return { map, missing: REQUIRED.filter((f) => !map[f]) };
}

/** "M/D/YYYY" (optionally with a time) → Date in UTC, or null. */
function parseUsDate(v: string): Date | null {
  const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const [, mo, d, y, hh = "0", mm = "0", ss = "0"] = m;
  const date = new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm, +ss));
  return isNaN(date.getTime()) ? null : date;
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export function normaliseReports(
  headers: string[],
  rows: Record<string, string>[],
  mc: string,
): {
  reports: LegacyReport[]; issues: LegacyIssues; missing: string[];
  duplicates: DuplicateGroup[]; possibleDuplicates: PossibleDuplicate[];
} {
  const { map, missing } = mapColumns(headers);
  const issues: LegacyIssues = { duplicatesRemoved: 0, valuesCleaned: 0, datesFixed: 0, skipped: 0 };
  if (missing.length) return { reports: [], issues, missing: missing.map((f) => COLUMNS[f][0]), duplicates: [], possibleDuplicates: [] };

  const get = (r: Record<string, string>, f: Field) => (map[f] ? r[map[f]!] ?? "" : "");

  // One spelling per cell: "Charis", "charis" and "CHARIS" are the same cell,
  // shown under whichever spelling is used most
  const spellings = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const name = get(r, "cell").replace(/\s+/g, " ").trim();
    if (!name) continue;
    const k = cellKey(name);
    const m = spellings.get(k) ?? new Map<string, number>();
    m.set(name, (m.get(name) ?? 0) + 1);
    spellings.set(k, m);
  }
  const canonical = new Map(Array.from(spellings, ([k, m]) => [k, Array.from(m).sort((a, b) => b[1] - a[1])[0][0]]));

  // Numbers: leading digits win ("3(2 online)" → 3); o/O/None/blank → 0.
  // Anything cleaned is noted on the current row.
  let notes: string[] = [];
  const num = (raw: string, field?: Field): number => {
    const v = raw.trim();
    if (v === "") return 0;
    if (/^\d+$/.test(v)) return Number(v);
    issues.valuesCleaned++;
    const lead = v.match(/^\d+/);
    const value = lead ? Number(lead[0]) : 0;
    if (field) notes.push(`${map[field] ?? field}: "${v}" read as ${value}`);
    return value;
  };
  const optNum = (raw: string, field?: Field): number | null => (raw.trim() === "" ? null : num(raw, field));
  const field = (r: Record<string, string>, f: Field) => num(get(r, f), f);

  const byKey = new Map<string, LegacyReport>();
  const allByKey = new Map<string, LegacyReport[]>();  // every submission, for duplicate review
  for (const r of rows) {
    const typedCell = get(r, "cell").replace(/\s+/g, " ").trim();
    const cell = typedCell ? canonical.get(cellKey(typedCell)) ?? typedCell : "";
    const submitted = parseUsDate(get(r, "timestamp"));
    let date = parseUsDate(get(r, "date"));
    if (!cell || !date) { issues.skipped++; continue; }
    notes = [];

    // Year typos (e.g. 2001 or 2025 for 2026). A service is reported within
    // weeks, so if the date is months before its own submission but the same
    // day in the submission year lands just before it, the year was mistyped.
    if (submitted && date.getUTCFullYear() !== submitted.getUTCFullYear()) {
      const DAY = 86_400_000;
      const sameDayThisYear = new Date(Date.UTC(submitted.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      const lagAsTyped = (submitted.getTime() - date.getTime()) / DAY;
      const lagFixed   = (submitted.getTime() - sameDayThisYear.getTime()) / DAY;
      const farOff     = Math.abs(date.getUTCFullYear() - submitted.getUTCFullYear()) > 1;
      if (farOff || (lagAsTyped > 120 && lagFixed >= -1 && lagFixed <= 90)) {
        notes.push(`Date: year ${date.getUTCFullYear()} corrected to ${submitted.getUTCFullYear()}`);
        date = sameDayThisYear;
        issues.datesFixed++;
      }
    }

    const service = get(r, "service").trim().toUpperCase() === "MGS" ? "MGS"
      : /lc\s*live/i.test(get(r, "service")) ? "LC LIVE"
      : get(r, "service").trim();

    const report: LegacyReport = {
      id:             `${mc}|${cellKey(cell)}|${isoDay(date)}|${service}`,
      date:           isoDay(date),
      submittedAt:    (submitted ?? date).toISOString(),
      source:         mc,
      mc,
      cell,
      bacenta:        get(r, "bacenta").trim() || "Unassigned",
      formBacenta:    get(r, "bacenta").trim() || "Unassigned",
      service,
      pastor:         field(r, "pastor"),
      seniorShepherd: field(r, "seniorShepherd"),
      shepherds:      field(r, "shepherds"),
      cellShepherd:   field(r, "cellShepherd"),
      members:        field(r, "members"),
      firstTimers:    field(r, "firstTimers"),
      attendance:     0,
      online:         field(r, "online"),
      soulsWon:       field(r, "soulsWon"),
      retained:       optNum(get(r, "retained"), "retained"),
      teens:          optNum(get(r, "teens"), "teens"),
      children:       optNum(get(r, "children"), "children"),
      notes,
    };
    report.attendance = report.pastor + report.seniorShepherd + report.shepherds
      + report.cellShepherd + report.members + report.firstTimers;

    allByKey.set(report.id, [...(allByKey.get(report.id) ?? []), report]);

    // Repeat submissions: count the latest, flag the group for review
    const prev = byKey.get(report.id);
    if (prev) {
      issues.duplicatesRemoved++;
      if (prev.submittedAt > report.submittedAt) continue;
    }
    byKey.set(report.id, report);
  }

  const reports = Array.from(byKey.values()).sort((a, b) => b.date.localeCompare(a.date) || a.cell.localeCompare(b.cell));

  const duplicates: DuplicateGroup[] = [];
  for (const [id, subs] of Array.from(allByKey)) {
    if (subs.length < 2) continue;
    const counted = byKey.get(id)!;
    const sig = (r: LegacyReport) => [r.attendance, r.online, r.firstTimers, r.soulsWon, r.retained, r.teens, r.children,
      r.pastor, r.seniorShepherd, r.shepherds, r.cellShepherd, r.members].join("|");
    duplicates.push({
      id, source: mc, cell: counted.cell, date: counted.date, service: counted.service,
      identical: new Set(subs.map(sig)).size === 1,
      submissions: [...subs].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt)).map((r) => ({
        submittedAt: r.submittedAt, attendance: r.attendance, online: r.online,
        firstTimers: r.firstTimers, soulsWon: r.soulsWon, counted: r === counted,
      })),
    });
  }
  // Same cell + service on different dates in one week → possible duplicate
  const byWeek = new Map<string, LegacyReport[]>();
  for (const r of reports) {
    const k = `${mc}|${cellKey(r.cell)}|${weekStart(r.date)}|${r.service}`;
    byWeek.set(k, [...(byWeek.get(k) ?? []), r]);
  }
  const possibleDuplicates: PossibleDuplicate[] = [];
  for (const [key, rs] of Array.from(byWeek)) {
    if (rs.length < 2) continue;
    possibleDuplicates.push({
      key, source: mc, cell: rs[0].cell, week: weekStart(rs[0].date), service: rs[0].service,
      reports: [...rs].sort((a, b) => a.date.localeCompare(b.date)).map((r) => ({
        id: r.id, date: r.date, submittedAt: r.submittedAt,
        attendance: r.attendance, firstTimers: r.firstTimers, soulsWon: r.soulsWon,
      })),
    });
  }
  possibleDuplicates.sort((a, b) => b.week.localeCompare(a.week) || a.cell.localeCompare(b.cell));

  return { reports, issues, missing: [], duplicates, possibleDuplicates };
}

// ─── Aggregation helpers (used by the dashboard) ──────────────────────────────

/**
 * Median of people counts, as a whole number — with an even number of values
 * the midpoint (e.g. 44.5) is rounded to the nearest person (.5 rounds up).
 */
export function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

/** Sunday that starts the week containing `iso` (MGS Sunday + LC Live Wednesday share a week). */
export function weekStart(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return isoDay(d);
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function formatDay(iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", ...opts });
}

export function formatMonth(key: string, long = false): string {
  return new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC", month: long ? "long" : "short", ...(long ? { year: "numeric" } : {}),
  });
}

export function emptyIssues(): LegacyIssues {
  return { duplicatesRemoved: 0, valuesCleaned: 0, datesFixed: 0, skipped: 0 };
}

export function addIssues(a: LegacyIssues, b: LegacyIssues): LegacyIssues {
  return {
    duplicatesRemoved: a.duplicatesRemoved + b.duplicatesRemoved,
    valuesCleaned:     a.valuesCleaned + b.valuesCleaned,
    datesFixed:        a.datesFixed + b.datesFixed,
    skipped:           a.skipped + b.skipped,
  };
}
