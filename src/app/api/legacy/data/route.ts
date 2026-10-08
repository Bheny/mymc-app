import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getLegacyData } from "@/lib/legacy-sheet";
import {
  addIssues, emptyIssues, normaliseReports, type DuplicateGroup, type LegacyReport, type PossibleDuplicate,
} from "@/lib/legacy-report";
import { matchCell, type SourcedEntry } from "@/lib/legacy-directory";

// Who can view the Legacy dashboard — widen once the audience is decided
const LEGACY_VIEWER_ROLES = ["admin", "chief_shepherd"];

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
 * GET — cleaned service reports from every Legacy sheet, merged.
 * Each cell's MC and bacenta come from the church directory (falling back to
 * the sheet's own directory tab, then to the sheet name / form's Bacenta
 * column). Cached for 60s per sheet; ?fresh=1 refetches. Personal columns
 * (e.g. submitter email) are never sent to the browser.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!LEGACY_VIEWER_ROLES.includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  const fresh = !!new URL(request.url).searchParams.get("fresh");
  const result = await getLegacyData({ fresh });
  if (!result) return NextResponse.json({ configured: false });

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

  // Collapsed cells: not expected to report after this date. With no date in the
  // directory, the cell's last report is taken as when it stopped.
  const closures: Record<string, { on: string; inferred: boolean }> = {};
  for (const [key, on] of Array.from(closedCells)) {
    const last = reports.find((r) => `${r.mc}|${r.cell}` === key)?.date ?? null; // reports are newest first
    const date = on ?? last;
    if (date) closures[key] = { on: date, inferred: !on };
  }

  return NextResponse.json({
    configured: true,
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
    unlisted:  Array.from(unlisted).sort(),
    ambiguous: Array.from(ambiguous).sort(),
  });
}
