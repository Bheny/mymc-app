// Server-only: reads every connected Legacy sheet and returns the cleaned, merged
// view the dashboard (and the first-timers page) are built from.
import { getLegacyData } from "@/lib/legacy-sheet";
import {
  addIssues, emptyIssues, normaliseReports, type DuplicateGroup, type LegacyReport, type PossibleDuplicate,
} from "@/lib/legacy-report";
import { matchCell, type SourcedEntry } from "@/lib/legacy-directory";
import { normaliseFirstTimers } from "@/lib/legacy-first-timers";

// Who can view the Legacy dashboard and its first-timers page — widen once the audience is decided
const LEGACY_VIEWER_ROLES = ["admin", "chief_shepherd"];
export const canViewLegacy = (role?: string | null) => LEGACY_VIEWER_ROLES.includes(role ?? "");

/** "LAMPO MC" / "lampo" → "Lampo"; mixed-case names are kept as typed. */
function tidyMc(name: string): string {
  const n = name.replace(/\s+mc$/i, "").trim();
  return n === n.toUpperCase() || n === n.toLowerCase()
    ? n.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
    : n;
}

type CellLeaders = {
  cellShepherd:   string | null;
  seniorShepherd: string | null;
  mcPastor:       string | null;
};


/**
 * Cleaned service reports from every Legacy sheet, merged. Each cell's MC and
 * bacenta come from the church directory (falling back to the sheet's own
 * directory tab, then to the sheet name / form's Bacenta column). Cached for 60s per
 * sheet; `fresh` refetches. Personal columns (submitter email, first timers' names
 * and numbers) never leave the server. Returns null when nothing is connected.
 */
export async function loadLegacyView({ fresh = false } = {}) {
  const result = await getLegacyData({ fresh });
  if (!result) return null;

  // ── Directory entries: shared church directory (source null) + per-sheet tabs ──
  const entries: SourcedEntry[] = [
    ...(result.church?.directory ?? []).map((e) => ({ ...e, source: null })),
    ...result.results.flatMap(({ source, directory }) => directory.map((e) => ({ ...e, source: source.name }))),
  ];

  // ── Reports ──
  let issues = emptyIssues();
  const reports: LegacyReport[] = [];
  const duplicates: DuplicateGroup[] = [];
  const possibleDuplicates: PossibleDuplicate[] = [];
  const sources = result.results.map(({ source, data, error, directoryError }) => {
    const base = { name: source.name, url: source.url, tabName: source.tabName, directoryError: directoryError ?? null };
    if (!data) return { ...base, ok: false, error, count: 0 };
    const norm = normaliseReports(data.headers, data.rows, source.name);
    if (norm.missing.length) {
      return { ...base, ok: false, count: 0,
        error: `Missing columns: ${norm.missing.join(", ")}. Is the form-responses tab selected?` };
    }
    reports.push(...norm.reports);
    duplicates.push(...norm.duplicates);
    possibleDuplicates.push(...norm.possibleDuplicates);
    issues = addIssues(issues, norm.issues);
    return { ...base, ok: true, count: norm.reports.length, fetchedAt: data.fetchedAt };
  });

  // ── Resolve each report's MC and bacenta through the directory ──
  const hasDirectory = (sheet: string) => !!result.church?.directory.length || entries.some((e) => e.source === sheet);
  const unlisted  = new Set<string>();
  const ambiguous = new Set<string>();
  const leaders: Record<string, CellLeaders> = {};   // "mc|cell" → leaders
  const closedCells = new Map<string, string | null>(); // "mc|cell" → closing date from the directory (or null)
  const mcPastors: Record<string, string | null> = {};

  for (const r of reports) {
    const { entry, ambiguous: unsure } = matchCell(entries, r);
    if (entry) {
      r.mc      = entry.mc ? tidyMc(entry.mc) : r.source;
      r.bacenta = entry.bacenta ?? r.formBacenta;
      if (unsure) ambiguous.add(`${r.cell} (${r.source})`);
      leaders[`${r.mc}|${r.cell}`] ??= {
        cellShepherd:   entry.cellShepherd,
        seniorShepherd: entry.seniorShepherd,
        mcPastor:       entry.mcPastor,
      };
      if (entry.mcPastor) mcPastors[r.mc] ??= entry.mcPastor;
      if (entry.closed) closedCells.set(`${r.mc}|${r.cell}`, entry.closedOn);
    } else if (hasDirectory(r.source)) {
      unlisted.add(`${r.cell} (${r.source})`);
    }
  }
  // A sheet's own MC pastor applies only to cells still grouped under that sheet's name
  for (const { source } of result.results) if (source.mcPastor) mcPastors[source.name] ??= source.mcPastor;

  reports.sort((a, b) => b.date.localeCompare(a.date) || a.mc.localeCompare(b.mc) || a.cell.localeCompare(b.cell));

  // ── First Timers registration tab ──
  // Cleaned against the MC names the dashboard uses ("LAMPP" → "Lampo"). Only the privacy-safe
  // rows are sent — names and phone numbers stay on the server.
  let firstTimers: {
    tabName: string | null; rows: ReturnType<typeof normaliseFirstTimers>["rows"];
    issues: ReturnType<typeof normaliseFirstTimers>["issues"]; error: string | null;
  } | null = null;
  if (result.config.firstTimers) {
    const ft = result.firstTimers;
    const base = { tabName: result.config.firstTimers.tabName, rows: [], issues: { skipped: 0, unrecognisedStatus: 0 } };
    if (!ft?.data) {
      firstTimers = { ...base, error: ft?.error ?? "Couldn't read the first timers tab." };
    } else {
      const norm = normaliseFirstTimers(ft.data.headers, ft.data.rows, Array.from(new Set(reports.map((r) => r.mc))));
      firstTimers = norm.missing.length
        ? { ...base, error: `Missing columns: ${norm.missing.join(", ")}. Is the First Timers tab selected?` }
        : { tabName: base.tabName, rows: norm.rows, issues: norm.issues, error: null };
    }
  }

  // Collapsed cells: not expected to report after this date. With no date in the
  // directory, the cell's last report is taken as when it stopped.
  const closures: Record<string, { on: string; inferred: boolean }> = {};
  for (const [key, on] of Array.from(closedCells)) {
    const last = reports.find((r) => `${r.mc}|${r.cell}` === key)?.date ?? null; // reports are newest first
    const date = on ?? last;
    if (date) closures[key] = { on: date, inferred: !on };
  }


  // First timers the cells' own reports counted, by MC and month — to compare with registrations
  const reportedFirstTimers: Record<string, number> = {};
  for (const r of reports) {
    if (!r.firstTimers) continue;
    const k = `${r.mc}|${r.date.slice(0, 7)}`;
    reportedFirstTimers[k] = (reportedFirstTimers[k] ?? 0) + r.firstTimers;
  }

  return {
    label:      result.config.label,
    fetchedAt:  new Date().toISOString(),
    sources,
    church: result.config.directory
      ? { tabName: result.config.directory.tabName, count: result.church?.directory.length ?? 0,
          error: result.church?.directoryError ?? null }
      : null,
    reports,
    issues,
    leaders,
    mcPastors,
    closures,
    duplicates: duplicates.sort((a, b) => b.date.localeCompare(a.date) || a.cell.localeCompare(b.cell)),
    possibleDuplicates: possibleDuplicates.sort((a, b) => b.week.localeCompare(a.week) || a.cell.localeCompare(b.cell)),
    firstTimers,
    reportedFirstTimers,
    mcs: Array.from(new Set(reports.map((r) => r.mc))).sort(),
    unlisted:  Array.from(unlisted).sort(),
    ambiguous: Array.from(ambiguous).sort(),
  };
}

export type LegacyView = NonNullable<Awaited<ReturnType<typeof loadLegacyView>>>;
