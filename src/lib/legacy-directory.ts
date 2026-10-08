// Reads a "who leads what" tab from a Legacy sheet. Client-safe.
//
// Handles both layouts seen in the church's sheets:
//   • Bacenta Info     — Name | Bacenta | Senior Shepherd | Cell Shepherd
//   • Church Directory — repeated sections, each headed by a line like
//                        "LAMPO MC — Pastor Che", then Cell | Bacenta |
//                        Senior Shepherd | Cell Shepherd | MC
//
// Optional columns on either layout:
//   Status    — "Collapsed" / "Closed" / "Inactive" / "Merged" … marks a cell
//               that no longer meets; blank or "Active" means it still does
//   Closed on — the date it stopped: "12 Aug 2026" (clearest), YYYY-MM-DD, or
//               M/D/YYYY like the form (D/M/YYYY is read when the day is > 12);
//               blank = after its last report

export type DirectoryEntry = {
  cell:           string;
  bacenta:        string | null;
  seniorShepherd: string | null;  // bacenta head
  cellShepherd:   string | null;
  mc:             string | null;
  mcPastor:       string | null;
  closed:         boolean;        // collapsed / no longer meeting
  closedOn:       string | null;  // YYYY-MM-DD, if the directory gives one
};

const clean = (v: string | undefined) => (v ?? "").replace(/\s+/g, " ").trim();

type Cols = { cell: number; bacenta: number; senior: number; shepherd: number; mc: number; status: number; closedOn: number };

const CLOSED_STATUS = /collaps|clos|inactive|dissolv|merg|disband|stopp|ended|dead/i;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "8/12/2026" (M/D/YYYY, as the form uses), "2026-08-12" or "12 Aug 2026" → "2026-08-12". */
export function parseDirectoryDate(raw: string | null): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  const iso = (y: number, m: number, d: number) => {
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCMonth() === m - 1 ? dt.toISOString().slice(0, 10) : null;
  };
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  // Month-first like the form (8/12/2026 = 12 Aug), unless the first number can
  // only be a day (31/12/2026 = 31 Dec). Writing "12 Aug 2026" avoids the doubt.
  if (m) return +m[1] > 12 ? iso(+m[3], +m[2], +m[1]) : iso(+m[3], +m[1], +m[2]);
  m = v.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3})[a-z]*,?\s+(\d{4})$/i);
  if (m && MONTHS.includes(m[2].toLowerCase())) return iso(+m[3], MONTHS.indexOf(m[2].toLowerCase()) + 1, +m[1]);
  m = v.match(/^([a-z]{3})[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i);
  if (m && MONTHS.includes(m[1].toLowerCase())) return iso(+m[3], MONTHS.indexOf(m[1].toLowerCase()) + 1, +m[2]);
  return null;
}

/** If this row is a header row, where are the columns? */
function headerColumns(row: string[]): Cols | null {
  const n = row.map((c) => clean(c).toLowerCase());
  const find = (re: RegExp) => n.findIndex((c) => re.test(c));
  const cell     = find(/^(cell( name)?|name)$/);
  const shepherd = find(/^cell shepherd/);
  if (cell < 0 || shepherd < 0) return null;
  return {
    cell, shepherd, bacenta: find(/^bacenta/), senior: find(/^senior shepherd/), mc: find(/^mc$/),
    status: find(/^(status|state)$/), closedOn: find(/^(closed|collapsed|ended|stopped|closure)( on| date)?$|^date (closed|collapsed)$/),
  };
}

/** "LAMPO MC — Pastor Che" → { mc: "LAMPO", pastor: "Pastor Che" } */
function sectionTitle(row: string[]): { mc: string; pastor: string } | null {
  const filled = row.map(clean).filter(Boolean);
  if (filled.length !== 1) return null;
  const m = filled[0].match(/^(.+?)\s+MC\s*[—–-]+\s*(.+)$/i);
  return m ? { mc: m[1].trim(), pastor: m[2].trim() } : null;
}

export function parseDirectory(table: string[][]): DirectoryEntry[] {
  const out: DirectoryEntry[] = [];
  let cols: Cols | null = null;
  let section: { mc: string; pastor: string } | null = null;

  for (const row of table) {
    const title = sectionTitle(row);
    if (title) { section = title; cols = null; continue; }
    const header = headerColumns(row);
    if (header) { cols = header; continue; }
    if (!cols) continue;

    const cell = clean(row[cols.cell]);
    if (!cell) continue;
    const at = (i: number) => (i >= 0 ? clean(row[i]) || null : null);
    out.push({
      cell,
      bacenta:        at(cols.bacenta),
      seniorShepherd: at(cols.senior),
      cellShepherd:   at(cols.shepherd),
      mc:             at(cols.mc) ?? section?.mc ?? null,
      mcPastor:       section?.pastor ?? null,
      // A closure date on its own also marks the cell closed
      closed:         CLOSED_STATUS.test(at(cols.status) ?? "") || !!parseDirectoryDate(at(cols.closedOn)),
      closedOn:       parseDirectoryDate(at(cols.closedOn)),
    });
  }
  return out;
}

/** Cell-name key that ignores case, spacing and punctuation ("Data Link" = "datalink"). */
export function cellKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export type SourcedEntry = DirectoryEntry & { source: string | null }; // null = the shared church directory

/**
 * Find the directory entry for a reported cell. The shared church directory is
 * the source of truth; a sheet's own directory tab only covers cells the church
 * directory doesn't list. When several entries share a cell name, the bacenta
 * typed on the form decides, then an MC named like the sheet.
 */
export function matchCell(
  entries: SourcedEntry[],
  report: { cell: string; source: string; formBacenta: string },
): { entry: SourcedEntry | null; ambiguous: boolean } {
  const key = cellKey(report.cell);
  const same = (a: string | null, b: string) => !!a && cellKey(a) === cellKey(b);

  const pickFrom = (candidates: SourcedEntry[]) => {
    if (candidates.length <= 1) return { entry: candidates[0] ?? null, ambiguous: false };
    const pick =
      candidates.find((e) => same(e.bacenta, report.formBacenta)) ??
      candidates.find((e) => same(e.mc, report.source));
    return { entry: pick ?? candidates[0], ambiguous: !pick };
  };

  const named = entries.filter((e) => cellKey(e.cell) === key);
  const church = named.filter((e) => e.source === null);
  if (church.length) return pickFrom(church);
  return pickFrom(named.filter((e) => e.source === report.source));
}
