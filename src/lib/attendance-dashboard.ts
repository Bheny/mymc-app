// Calculations behind the attendance dashboard. Client-safe: no server imports.
// Works only on the app's own records (services, attendance marks, first timers).
//
// Two ways of counting, kept apart on purpose:
//   · "attended"  = members marked present + first timers + returning guests — everyone in the room.
//                   Used for medians, averages, trends and the targets.
//   · rate        = members present ÷ members marked — about the roster only.

export type SvcType = "LC_LIVE" | "MGS";

/** Members present / marked under one shepherd at one service. `s` is null for members with no shepherd. */
export type ShepherdCount = { s: string | null; p: number; t: number };

export type DashCell = { id: string; name: string; createdAt: string; buscentreId: string; buscentre: string; mcId: string; mc: string };
export type DashShepherd = { id: string; cellId: string; name: string };
export type DashService = {
  cellId: string; type: SvcType; date: string; online: boolean; cancelled: boolean;
  present: number; absent: number; excused: number; firstTimers: number;
  /** Returning guests (not yet members) who came again — in the room, but not on any roster */
  guests: number;
  sh: ShepherdCount[];
};
/** A first timer, and whether anyone has followed them up (reached out, called, visited, invited) */
export type DashFirstTimer = { cellId: string; date: string; type: SvcType; followedUp: boolean; joined: boolean };

export type ContactStage =
  | "NEW" | "CONTACTED" | "INVITED" | "ATTENDED" | "CONVERTED"
  | "NOT_INTERESTED" | "UNREACHABLE" | "OUT_OF_AREA" | "DO_NOT_CONTACT";
/** An evangelism contact. Placement is the cell/buscentre/MC currently holding them (cell is null until assigned). */
export type DashContact = {
  cellId: string | null; buscentreId: string | null; mcId: string | null;
  stage: ContactStage; met: string; last: string; missed: boolean;
};
export type DashSoul = { cellId: string; date: string; src: "tracker" | "outreach" };

export type History = {
  scopeLevel: string; scopeName: string; since: string; sinceLaunch: boolean; today: string;
  cells: DashCell[]; shepherds: DashShepherd[]; services: DashService[];
  joined: { cellId: string; date: string }[]; souls: DashSoul[];
  firstTimerRows: DashFirstTimer[];
};

export const TYPE_LABEL: Record<SvcType, string> = { LC_LIVE: "LC Live", MGS: "MGS" };

// ── Dates (all YYYY-MM-DD strings, handled in UTC so a date never shifts) ─────

const toDate = (s: string) => new Date(s + "T00:00:00Z");
const toStr  = (d: Date) => d.toISOString().slice(0, 10);

export const monthKey = (d: string) => d.slice(0, 7);
/** The Sunday that starts the week containing `d` — the same week an LC Live (Wed) and MGS (Sun) belong to */
export function weekStart(d: string): string {
  const x = toDate(d); x.setUTCDate(x.getUTCDate() - x.getUTCDay()); return toStr(x);
}
export function formatDay(d: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  return toDate(d).toLocaleDateString("en-GB", { timeZone: "UTC", ...opts });
}
export function formatMonth(m: string, long = false) {
  return toDate(m + "-01").toLocaleDateString("en-GB", { timeZone: "UTC", month: long ? "long" : "short", ...(long ? { year: "numeric" } : { year: "2-digit" }) });
}

// ── Numbers ────────────────────────────────────────────────────────────────────

export const rate = (present: number, total: number) => (total > 0 ? Math.round((present / total) * 100) : 0);
export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}
const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0);
export const total = (s: { present: number; absent: number; excused: number }) => s.present + s.absent + s.excused;
/** Everyone in the room at one service: members present, first timers, and returning guests */
export const attended = (s: { present: number; firstTimers: number; guests?: number }) => s.present + s.firstTimers + (s.guests ?? 0);

export type Metric = "rate" | "present";
export type Agg = { present: number; total: number; firstTimers: number; attended: number };
const zero = (): Agg => ({ present: 0, total: 0, firstTimers: 0, attended: 0 });
const add = (a: Agg, s: DashService) => {
  a.present += s.present; a.total += total(s); a.firstTimers += s.firstTimers; a.attended += attended(s); return a;
};

export function sum(services: DashService[]): Agg { return services.reduce(add, zero()); }

/** Totals for each service date (across whichever cells are selected) */
function perDate(services: DashService[]): Map<string, Agg> {
  const m = new Map<string, Agg>();
  for (const s of services) m.set(s.date, add(m.get(s.date) ?? zero(), s));
  return m;
}

/** People attending on each service date, oldest first — one number per service across the selected cells */
export function serviceTotals(services: DashService[]): { date: string; attended: number }[] {
  return Array.from(perDate(services).entries()).map(([date, a]) => ({ date, attended: a.attended })).sort((a, b) => a.date.localeCompare(b.date));
}

export type Headline = { rate: number; present: number; total: number; median: number; average: number; services: number };
export function headline(services: DashService[]): Headline {
  const a = sum(services), values = serviceTotals(services).map((t) => t.attended);
  return { rate: rate(a.present, a.total), present: a.present, total: a.total, services: values.length, median: median(values), average: mean(values) };
}

// ── Attendance targets, per service ────────────────────────────────────────────
// A cell is 13 (10 members + 2 shepherds + the cell shepherd); a buscentre is two cells, an MC two buscentres.
export const TARGETS = { cell: 13, buscentre: 26, mc: 52 } as const;
export type TargetLevel = "cell" | "buscentre" | "mc" | "branch";
export const TARGET_LEVEL_LABEL: Record<TargetLevel, string> = { cell: "cell", buscentre: "buscentre", mc: "MC", branch: "branch" };

/** What the current view is expected to reach at each service. A branch view is the sum of its MCs. */
export function targetFor(level: TargetLevel, mcCount: number): number {
  return level === "branch" ? TARGETS.mc * Math.max(1, mcCount) : TARGETS[level];
}

export type TargetResult = {
  target: number; services: number; median: number; average: number; met: number;
  latest: { date: string; attended: number } | null; status: "none" | "met" | "close" | "below";
};
/** How a set of services measures up against the target (people attending per service date, first timers included) */
export function againstTarget(services: DashService[], target: number): TargetResult {
  const totals = serviceTotals(services), values = totals.map((t) => t.attended);
  const med = median(values);
  return {
    target, services: totals.length, median: med, average: mean(values),
    met: values.filter((v) => v >= target).length,
    latest: totals.length ? totals[totals.length - 1] : null,
    status: !totals.length ? "none" : med >= target ? "met" : med >= target * 0.75 ? "close" : "below",
  };
}
export const targetColor = (status: TargetResult["status"]) =>
  status === "met" ? "var(--brand-success)" : status === "close" ? "var(--brand-warning)" : status === "below" ? "var(--brand-danger)" : "var(--brand-muted)";
/** Colour for a single count against a target */
export const countColor = (n: number, target: number) => targetColor(n >= target ? "met" : n >= target * 0.75 ? "close" : "below");

// ── Trend ──────────────────────────────────────────────────────────────────────

export type TrendView = "day" | "week" | "month";
export type TrendRow = { x: string; LC_LIVE?: number; MGS?: number; dates: Record<string, string[]>; n: Record<string, number> };

export function trend(services: DashService[], view: TrendView, metric: Metric): TrendRow[] {
  const keyOf = (d: string) => (view === "day" ? d : view === "week" ? weekStart(d) : monthKey(d));
  const buckets = new Map<string, { type: SvcType; key: string; list: DashService[] }>();
  for (const s of services) {
    const id = `${s.type}|${keyOf(s.date)}`;
    const b = buckets.get(id) ?? { type: s.type, key: keyOf(s.date), list: [] };
    b.list.push(s); buckets.set(id, b);
  }
  const rows = new Map<string, TrendRow>();
  buckets.forEach((b) => {
    const row = rows.get(b.key) ?? { x: b.key, dates: {}, n: {} };
    const dates = perDate(b.list), a = sum(b.list);
    // A month shows the typical service (median attending); a day or week shows the total
    row[b.type] = metric === "rate" ? rate(a.present, a.total)
      : view === "month" ? median(Array.from(dates.values()).map((d) => d.attended)) : a.attended;
    row.dates[b.type] = Array.from(dates.keys()).sort();
    row.n[b.type] = dates.size;
    rows.set(b.key, row);
  });
  return Array.from(rows.values()).sort((a, b) => a.x.localeCompare(b.x));
}

// ── Breakdown by MC / buscentre / cell / shepherd ──────────────────────────────

export type GroupBy = "mc" | "buscentre" | "cell" | "shepherd";
export type BreakdownRow = {
  id: string; name: string; value: number; rate: number; median: number; services: number;
  firstTimers: number; cells: number;
  /** Shepherd rows only: members marked present / marked, summed over the period */
  roster?: { present: number; marked: number };
};

export function breakdown(services: DashService[], cells: DashCell[], group: Exclude<GroupBy, "shepherd">, metric: Metric): BreakdownRow[] {
  const cellById = new Map(cells.map((c) => [c.id, c]));
  const groups = new Map<string, { name: string; list: DashService[]; cells: Set<string> }>();
  for (const s of services) {
    const c = cellById.get(s.cellId); if (!c) continue;
    const id = group === "mc" ? c.mcId : group === "buscentre" ? c.buscentreId : c.id;
    const name = group === "mc" ? c.mc : group === "buscentre" ? c.buscentre : c.name;
    const g = groups.get(id) ?? { name, list: [], cells: new Set<string>() };
    g.list.push(s); g.cells.add(c.id); groups.set(id, g);
  }
  return Array.from(groups.entries()).map(([id, g]) => {
    const h = headline(g.list);
    return {
      id, name: g.name, rate: h.rate, median: h.median, services: h.services,
      firstTimers: sum(g.list).firstTimers, cells: g.cells.size, value: metric === "rate" ? h.rate : h.median,
    };
  }).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

/**
 * Per shepherd: how many of their members were present at each service. First timers aren't
 * assigned to a shepherd, so they aren't in these numbers. Members with no shepherd are grouped
 * as "No shepherd" within their cell.
 */
export function breakdownByShepherd(
  services: DashService[], shepherds: DashShepherd[], cells: DashCell[], metric: Metric, showCell: boolean,
): BreakdownRow[] {
  const shepherdById = new Map(shepherds.map((s) => [s.id, s]));
  const cellName = new Map(cells.map((c) => [c.id, c.name]));
  const groups = new Map<string, { name: string; cell: string; per: number[]; present: number; marked: number }>();
  for (const s of services) {
    for (const e of s.sh) {
      const id = e.s ?? `none|${s.cellId}`;
      const sh = e.s ? shepherdById.get(e.s) : undefined;
      const g = groups.get(id) ?? { name: sh?.name ?? "No shepherd", cell: cellName.get(s.cellId) ?? "", per: [], present: 0, marked: 0 };
      g.per.push(e.p); g.present += e.p; g.marked += e.t; groups.set(id, g);
    }
  }
  // Two shepherds can share a name (e.g. unfilled slots) — the chart needs distinct labels
  const seen = new Map<string, number>();
  return Array.from(groups.entries()).map(([id, g]) => {
    const base = showCell && g.cell ? `${g.name} · ${g.cell}` : g.name;
    const n = (seen.get(base) ?? 0) + 1; seen.set(base, n);
    const r = rate(g.present, g.marked), med = median(g.per);
    return {
      id, name: n > 1 ? `${base} (${n})` : base, rate: r, median: med, services: g.per.length,
      firstTimers: 0, cells: 1, value: metric === "rate" ? r : med, roster: { present: g.present, marked: g.marked },
    };
  }).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

// ── Outreach by month ──────────────────────────────────────────────────────────

export type MonthlyRow = { month: string; firstTimers: number; joined: number; souls: number };
export function monthly(
  services: DashService[], joined: { date: string }[], souls: { date: string }[], months: string[],
): MonthlyRow[] {
  const rows = new Map(months.map((m) => [m, { month: m, firstTimers: 0, joined: 0, souls: 0 }]));
  for (const s of services) { const r = rows.get(monthKey(s.date)); if (r) r.firstTimers += s.firstTimers; }
  for (const j of joined)   { const r = rows.get(monthKey(j.date)); if (r) r.joined += 1; }
  for (const o of souls)    { const r = rows.get(monthKey(o.date)); if (r) r.souls += 1; }
  return Array.from(rows.values());
}

// ── Services that should have been recorded but weren't ────────────────────────
// A cell is expected to meet on Wednesdays (LC Live) and Sundays (MGS), from the day
// the cell was created until yesterday. Cancelled services count as recorded.

export type Missing = { cellId: string; cellName: string; type: SvcType; date: string };

export function expectedDates(from: string, to: string): { date: string; type: SvcType }[] {
  const out: { date: string; type: SvcType }[] = [];
  for (let d = toDate(from); toStr(d) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay();
    if (dow === 3) out.push({ date: toStr(d), type: "LC_LIVE" });
    if (dow === 0) out.push({ date: toStr(d), type: "MGS" });
  }
  return out;
}

export function missing(
  cells: DashCell[], allServices: DashService[], from: string, to: string, service: "all" | SvcType,
): { missing: Missing[]; expected: number } {
  const recorded = new Set(allServices.map((s) => `${s.cellId}|${s.type}|${s.date}`));
  const dates = expectedDates(from, to).filter((e) => service === "all" || e.type === service);
  const out: Missing[] = []; let expected = 0;
  for (const c of cells) {
    for (const e of dates) {
      if (e.date < c.createdAt) continue;       // the cell didn't exist yet
      expected++;
      if (!recorded.has(`${c.id}|${e.type}|${e.date}`)) out.push({ cellId: c.id, cellName: c.name, type: e.type, date: e.date });
    }
  }
  return { missing: out.sort((a, b) => b.date.localeCompare(a.date) || a.cellName.localeCompare(b.cellName)), expected };
}

export const rateColor = (pct: number) => (pct >= 80 ? "var(--brand-success)" : pct >= 60 ? "var(--brand-warning)" : "var(--brand-danger)");

export function monthRange(month: string): { from: string; to: string } {
  const first = toDate(month + "-01");
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
  return { from: toStr(first), to: toStr(last) };
}

export function yesterday(today: string): string {
  const d = toDate(today); d.setUTCDate(d.getUTCDate() - 1); return toStr(d);
}

/** Every month key from `from` to `to` inclusive */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = toDate(monthKey(from) + "-01"); toStr(d) <= to; d.setUTCMonth(d.getUTCMonth() + 1)) out.push(toStr(d).slice(0, 7));
  return out;
}

// ── Latest service and how it moved ────────────────────────────────────────────

/** The most recent service's attendance, and the change from the one before it (null if there's only one) */
export function latestChange(services: DashService[]): { date: string; attended: number; delta: number | null } | null {
  const t = serviceTotals(services);
  if (!t.length) return null;
  const last = t[t.length - 1], prev = t.length > 1 ? t[t.length - 2] : null;
  return { date: last.date, attended: last.attended, delta: prev ? last.attended - prev.attended : null };
}

/** Which cells are behind on recording, worst first */
export function missingByCell(list: Missing[]): { name: string; n: number }[] {
  const m = new Map<string, number>();
  for (const x of list) m.set(x.cellName, (m.get(x.cellName) ?? 0) + 1);
  return Array.from(m.entries()).map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
}

// ── First timers: have they been followed up? ──────────────────────────────────

export function firstTimerFollowUp(rows: DashFirstTimer[]) {
  const followedUp = rows.filter((r) => r.followedUp).length;
  return { total: rows.length, followedUp, toFollowUp: rows.length - followedUp, joined: rows.filter((r) => r.joined).length };
}

// ── Outreach: where the people we've met have got to ───────────────────────────

const OPEN_STAGES: ContactStage[] = ["NEW", "CONTACTED", "INVITED"];
/** A contact with no activity for this long is going cold */
export const QUIET_DAYS = 14;

export function daysBetween(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000);
}

/** Of everyone met: how many were reached, invited, came to a service, and joined. Each step includes the ones after it. */
export function outreachFunnel(contacts: DashContact[]) {
  const reached = (c: DashContact) => !["NEW", "UNREACHABLE"].includes(c.stage);
  return {
    met: contacts.length,
    reached: contacts.filter(reached).length,
    invited: contacts.filter((c) => ["INVITED", "ATTENDED", "CONVERTED"].includes(c.stage)).length,
    came: contacts.filter((c) => c.stage === "ATTENDED" || c.stage === "CONVERTED").length,
    joined: contacts.filter((c) => c.stage === "CONVERTED").length,
  };
}

/** People who need someone to act: still working with them, but nobody has moved them on */
export function followUpNeeds(contacts: DashContact[], today: string) {
  const open = contacts.filter((c) => OPEN_STAGES.includes(c.stage));
  const notContacted = open.filter((c) => c.stage === "NEW");
  const noCell       = open.filter((c) => !c.cellId);
  const missedInvite = open.filter((c) => c.stage === "INVITED" && c.missed);
  const quiet        = open.filter((c) => c.stage !== "NEW" && daysBetween(c.last, today) >= QUIET_DAYS);
  const needing = new Set([...notContacted, ...noCell, ...missedInvite, ...quiet]);
  return { open: open.length, notContacted: notContacted.length, noCell: noCell.length, missedInvite: missedInvite.length, quiet: quiet.length, total: needing.size };
}
