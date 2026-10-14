// Turns rows from the "First Timers" registration tab (the form first timers fill
// in) into privacy-safe rows plus summaries. Client-safe, pure.
//
// Names and phone numbers never leave this file's input: a row keeps only what the
// summary needs (date, gender, intent, campus/area, MC, handler, status, departments)
// and two flags about the phone number (already registered / not a real number).

import { cellKey } from "@/lib/legacy-directory";
import { parseUsDate } from "@/lib/legacy-report";

export type FirstTimerStatus = "ESTABLISHED" | "WORKING" | "CANNOT";
export type FirstTimerIntent = "JOIN" | "UNSURE" | "VISITING";

export type FirstTimerRow = {
  date:        string;                  // registration date, YYYY-MM-DD
  gender:      "Male" | "Female" | null;
  intent:      FirstTimerIntent | null;
  area:        string | null;           // campus / work: UHAS, HTU, Working …
  mc:          string | null;           // matched MC name (as the dashboard spells it)
  mcKnown:     boolean;                 // false when it matches none of the connected MCs
  handlers:    string[];                // tidy names; usually 0 or 1
  status:      FirstTimerStatus | null; // null = nobody has recorded one
  departments: string[];                // what they'd like to join
  repeatPhone: boolean;                 // this number was registered earlier too
  badPhone:    boolean;                 // too short to be a real number
};

export type FirstTimerIssues = {
  skipped:            number;  // rows without a usable date
  unrecognisedStatus: number;  // a status that isn't one of the three
};

// Column → accepted headings (lower-case). Exact match first, then "starts with".
const COLUMNS = {
  timestamp:  { exact: ["timestamp"], prefix: [] as string[] },
  gender:     { exact: ["gender", "sex"], prefix: [] },
  phone:      { exact: [], prefix: ["mobile", "phone", "contact"] },
  intent:     { exact: [], prefix: ["which of these applies"] },
  area:       { exact: ["location", "campus", "area"], prefix: [] },
  department: { exact: [], prefix: ["which department"] },
  mc:         { exact: ["assigned mc", "mc"], prefix: ["assigned mc"] },
  handler:    { exact: [], prefix: ["handled by"] },
  status:     { exact: ["status"], prefix: [] },
} as const;

type Field = keyof typeof COLUMNS;

export function mapFirstTimerColumns(headers: string[]) {
  const norm = headers.map((h) => ({ h, n: h.replace(/\s+/g, " ").toLowerCase().trim() }));
  const map: Partial<Record<Field, string>> = {};
  for (const [field, { exact, prefix }] of Object.entries(COLUMNS) as [Field, { exact: readonly string[]; prefix: readonly string[] }][]) {
    const hit = norm.find(({ n }) => exact.includes(n)) ?? norm.find(({ n }) => prefix.some((p) => n.startsWith(p)));
    if (hit) map[field] = hit.h;
  }
  // A date is essential; beyond that it should look like this registration form
  const missing: string[] = [];
  if (!map.timestamp) missing.push("Timestamp");
  if (!map.mc && !map.status && !map.intent) missing.push("ASSIGNED MC / STATUS");
  return { map, missing };
}

// ─── Cleaning helpers ─────────────────────────────────────────────────────────

const tidyWords = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

function editDistanceAtMost1(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);          // one substitution
  const [long, short] = a.length > b.length ? [a, b] : [b, a];
  return long.slice(i + 1) === short.slice(i);                                   // one insertion/deletion
}

/** "LAMPO" / "Lampo" / "LAMPP" (typo) → "Lampo", when "Lampo" is a connected MC. */
export function matchMcName(raw: string, knownMcs: string[]): { name: string | null; known: boolean } {
  const cleaned = raw.replace(/\s+/g, " ").replace(/\s+mc$/i, "").trim();
  if (!cleaned) return { name: null, known: false };
  const key = cellKey(cleaned);
  const exact = knownMcs.find((m) => cellKey(m) === key);
  if (exact) return { name: exact, known: true };
  // One-letter typos, only if exactly one MC is that close (so "Agape" never snaps to "Lampo")
  const close = key.length >= 4 ? knownMcs.filter((m) => editDistanceAtMost1(cellKey(m), key)) : [];
  if (close.length === 1) return { name: close[0], known: true };
  return { name: tidyWords(cleaned), known: false };
}

function parseStatus(raw: string): { status: FirstTimerStatus | null; recognised: boolean } {
  const v = raw.trim().toLowerCase();
  if (!v) return { status: null, recognised: true };
  if (/establish/.test(v))                              return { status: "ESTABLISHED", recognised: true };
  if (/cannot|can't|cant|not (a )?fit|unreach|no (longer|response)/.test(v)) return { status: "CANNOT", recognised: true };
  if (/work|progress|follow|ongoing|pending/.test(v))   return { status: "WORKING", recognised: true };
  return { status: null, recognised: false };
}

function parseIntent(raw: string): FirstTimerIntent | null {
  const v = raw.toLowerCase();
  if (/join|member/.test(v)) return "JOIN";
  if (/not sure|unsure|undecided/.test(v)) return "UNSURE";
  if (/visit/.test(v)) return "VISITING";
  return null;
}

// Titles people put before a handler's name: "SS Isaac", "Ps Timothy", "S. Derrick" …
const TITLE = /^(?:senior shepherd|pastor|shepherd|snr|ss|ps|pr|sr|s)\b\.?\s*/i;

function rawHandlerNames(raw: string): string[] {
  return raw.split(/[\/,&;]|\band\b/i).map((part) => {
    let p = part.replace(/[.]/g, " ").replace(/\s+/g, " ").trim();
    for (let i = 0; i < 3 && TITLE.test(p) && p.replace(TITLE, "").trim(); i++) p = p.replace(TITLE, "").trim();
    return p;
  }).filter(Boolean);
}

/** Departments are a comma-separated multi-select; commas inside brackets don't split. */
function splitDepartments(raw: string): string[] {
  return raw.split(/,\s*(?![^()]*\))/).map((d) => d.trim()).filter(Boolean);
}

// ─── Main entry ───────────────────────────────────────────────────────────────

export function normaliseFirstTimers(
  headers: string[],
  rows: Record<string, string>[],
  knownMcs: string[],
): { rows: FirstTimerRow[]; issues: FirstTimerIssues; missing: string[] } {
  const { map, missing } = mapFirstTimerColumns(headers);
  const issues: FirstTimerIssues = { skipped: 0, unrecognisedStatus: 0 };
  if (missing.length) return { rows: [], issues, missing };

  const get = (r: Record<string, string>, f: Field) => (map[f] ? (r[map[f]!] ?? "").trim() : "");

  // Handler spellings: "tim" and "timothy" are one person — fold a name into a longer one it prefixes
  const handlerCounts = new Map<string, number>();
  for (const r of rows) for (const n of rawHandlerNames(get(r, "handler"))) {
    const k = n.toLowerCase();
    handlerCounts.set(k, (handlerCounts.get(k) ?? 0) + 1);
  }
  const keys = Array.from(handlerCounts.keys());
  const canonicalKey = (k: string) => {
    const longer = keys.filter((o) => o !== k && o.length > k.length && k.length >= 3 && o.startsWith(k));
    return longer.sort((a, b) => (handlerCounts.get(b) ?? 0) - (handlerCounts.get(a) ?? 0))[0] ?? k;
  };
  const handlerLabel = (k: string) => (k.length <= 2 ? k.toUpperCase() : tidyWords(k));

  const seenPhones = new Set<string>();
  const out: FirstTimerRow[] = [];

  for (const r of rows) {
    const when = parseUsDate(get(r, "timestamp"));
    if (!when) { issues.skipped++; continue; }

    const mc = matchMcName(get(r, "mc"), knownMcs);
    const status = parseStatus(get(r, "status"));
    if (!status.recognised) issues.unrecognisedStatus++;

    const digits = get(r, "phone").replace(/\D/g, "");
    const phoneKey = digits.slice(-9);
    const badPhone = digits.length < 9;
    const repeatPhone = !badPhone && seenPhones.has(phoneKey);
    if (!badPhone) seenPhones.add(phoneKey);

    const g = get(r, "gender").toLowerCase();
    out.push({
      date:        when.toISOString().slice(0, 10),
      gender:      g.startsWith("m") ? "Male" : g.startsWith("f") ? "Female" : null,
      intent:      parseIntent(get(r, "intent")),
      area:        get(r, "area") || null,
      mc:          mc.name,
      mcKnown:     mc.known,
      handlers:    Array.from(new Set(rawHandlerNames(get(r, "handler")).map((n) => handlerLabel(canonicalKey(n.toLowerCase()))))),
      status:      status.status,
      departments: splitDepartments(get(r, "department")),
      repeatPhone,
      badPhone,
    });
  }
  return { rows: out, issues, missing: [] };
}

// ─── Summary (over whatever rows the page's filters leave) ───────────────────

export type Tally = { name: string; count: number };

export type FirstTimerSummary = {
  total:       number;
  status:      { ESTABLISHED: number; WORKING: number; CANNOT: number; NONE: number };
  intent:      { JOIN: number; UNSURE: number; VISITING: number; UNKNOWN: number };
  gender:      { Male: number; Female: number };
  byMonth:     { month: string; count: number }[];
  byMc:        { mc: string; total: number; established: number; working: number; cannot: number; none: number }[];
  byArea:      Tally[];
  byDepartment: Tally[];
  byHandler:   { name: string; total: number; established: number; working: number; cannot: number }[];
  withHandler: number;
  repeatPhones: number;
  badPhones:   number;
  unknownMc:   number;
};

const tally = (map: Map<string, number>): Tally[] =>
  Array.from(map, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

export function summariseFirstTimers(rows: FirstTimerRow[]): FirstTimerSummary {
  const s: FirstTimerSummary = {
    total: rows.length,
    status: { ESTABLISHED: 0, WORKING: 0, CANNOT: 0, NONE: 0 },
    intent: { JOIN: 0, UNSURE: 0, VISITING: 0, UNKNOWN: 0 },
    gender: { Male: 0, Female: 0 },
    byMonth: [], byMc: [], byArea: [], byDepartment: [], byHandler: [],
    withHandler: 0, repeatPhones: 0, badPhones: 0, unknownMc: 0,
  };
  const months = new Map<string, number>();
  const areas = new Map<string, number>();
  const depts = new Map<string, number>();
  const mcs = new Map<string, FirstTimerSummary["byMc"][number]>();
  const handlers = new Map<string, FirstTimerSummary["byHandler"][number]>();

  for (const r of rows) {
    s.status[r.status ?? "NONE"]++;
    s.intent[r.intent ?? "UNKNOWN"]++;
    if (r.gender) s.gender[r.gender]++;
    if (r.repeatPhone) s.repeatPhones++;
    if (r.badPhone) s.badPhones++;
    if (r.mc && !r.mcKnown) s.unknownMc++;

    const m = r.date.slice(0, 7);
    months.set(m, (months.get(m) ?? 0) + 1);
    if (r.area) areas.set(r.area, (areas.get(r.area) ?? 0) + 1);
    for (const d of r.departments) depts.set(d, (depts.get(d) ?? 0) + 1);

    const mcName = r.mc ?? "Not assigned";
    const mcRow = mcs.get(mcName) ?? { mc: mcName, total: 0, established: 0, working: 0, cannot: 0, none: 0 };
    mcRow.total++;
    if (r.status === "ESTABLISHED") mcRow.established++; else if (r.status === "WORKING") mcRow.working++;
    else if (r.status === "CANNOT") mcRow.cannot++; else mcRow.none++;
    mcs.set(mcName, mcRow);

    if (r.handlers.length) s.withHandler++;
    for (const h of r.handlers) {
      const hr = handlers.get(h) ?? { name: h, total: 0, established: 0, working: 0, cannot: 0 };
      hr.total++;
      if (r.status === "ESTABLISHED") hr.established++; else if (r.status === "WORKING") hr.working++;
      else if (r.status === "CANNOT") hr.cannot++;
      handlers.set(h, hr);
    }
  }

  s.byMonth = Array.from(months, ([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month));
  s.byMc = Array.from(mcs.values()).sort((a, b) => b.total - a.total);
  s.byArea = tally(areas);
  s.byDepartment = tally(depts);
  s.byHandler = Array.from(handlers.values()).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  return s;
}

// ─── Filtering and notes shared by the page and the WhatsApp report ──────────

/** The rows for one MC (or all) and one month (or all time). */
export function filterFirstTimers(rows: FirstTimerRow[], mc: string, period: string): FirstTimerRow[] {
  return rows.filter((r) => (!mc || r.mc === mc) && (period === "all" || r.date.slice(0, 7) === period));
}

const pctOf = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

/** Things in the registrations that someone should fix or follow up. */
export function buildFirstTimerNotes(s: FirstTimerSummary, issues: FirstTimerIssues): string[] {
  const n = (x: number) => x.toLocaleString("en-GB");
  const notes: string[] = [];
  if (s.status.NONE) notes.push(`${n(s.status.NONE)} (${pctOf(s.status.NONE, s.total)}%) have no follow-up status recorded`);
  if (s.withHandler < s.total) notes.push(`${n(s.total - s.withHandler)} have no handler recorded`);
  if (s.repeatPhones) notes.push(`${n(s.repeatPhones)} registration${s.repeatPhones === 1 ? "" : "s"} repeat a number already registered — possible duplicates`);
  if (s.badPhones) notes.push(`${n(s.badPhones)} ${s.badPhones === 1 ? "has" : "have"} a phone number that's too short`);
  if (s.unknownMc) notes.push(`${n(s.unknownMc)} ${s.unknownMc === 1 ? "is" : "are"} assigned to an MC that isn't connected here`);
  if (issues.unrecognisedStatus) notes.push(`${n(issues.unrecognisedStatus)} ${issues.unrecognisedStatus === 1 ? "has" : "have"} a status that isn't Established / Working On / Cannot Work With`);
  if (issues.skipped) notes.push(`${n(issues.skipped)} row${issues.skipped === 1 ? "" : "s"} skipped (no readable date)`);
  return notes;
}
