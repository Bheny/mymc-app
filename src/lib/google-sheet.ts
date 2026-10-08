// Read-only access to a Google Sheet via its share link (no API key).
// The sheet must be shared as "Anyone with the link can view", or published
// to the web. Each tab is fetched as CSV.

// gidInLink: whether the link itself named a tab. Links copied via the Share
// button (…/edit?usp=sharing) don't, and "0" isn't always a real tab.
export type SheetRef =
  | { type: "shared";    id: string;  gid: string; gidInLink: boolean }  // /spreadsheets/d/{id}/edit#gid=…
  | { type: "published"; key: string; gid: string; gidInLink: boolean }; // /spreadsheets/d/e/{key}/pubhtml

export type SheetTab = { gid: string; name: string };

export type SheetData = {
  headers:   string[];
  rows:      Record<string, string>[];
  table:     string[][];  // raw grid, for tabs that aren't a simple header + rows table
  fetchedAt: string;
};

/** Parse a Google Sheets URL. Returns null if it isn't one. */
export function parseSheetUrl(raw: string): SheetRef | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.hostname !== "docs.google.com" || !u.pathname.startsWith("/spreadsheets/")) return null;

  // gid can be in the query (?gid=) or the hash (#gid=); defaults to the first tab
  const hashGid = new URLSearchParams(u.hash.replace(/^#/, "")).get("gid");
  const linkGid = u.searchParams.get("gid") ?? hashGid;
  const gid = linkGid ?? "0";
  const gidInLink = linkGid !== null;

  const published = u.pathname.match(/^\/spreadsheets\/d\/e\/([\w-]+)/);
  if (published) return { type: "published", key: published[1], gid, gidInLink };

  const shared = u.pathname.match(/^\/spreadsheets\/d\/([\w-]+)/);
  if (shared) return { type: "shared", id: shared[1], gid, gidInLink };

  return null;
}

export function withGid(ref: SheetRef, gid: string): SheetRef {
  return { ...ref, gid, gidInLink: true };
}

export function csvUrl(ref: SheetRef): string {
  return ref.type === "published"
    ? `https://docs.google.com/spreadsheets/d/e/${ref.key}/pub?output=csv&gid=${ref.gid}`
    : `https://docs.google.com/spreadsheets/d/${ref.id}/export?format=csv&gid=${ref.gid}`;
}

/** RFC 4180 CSV parser — handles quoted fields, "" escapes and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/**
 * Turn CSV rows into header-keyed records. Blank rows are dropped; blank or
 * duplicate headers get a fallback name so no column is lost.
 */
export function toRecords(table: string[][]): { headers: string[]; rows: Record<string, string>[] } {
  const nonEmpty = table.filter((r) => r.some((c) => c.trim() !== ""));
  if (!nonEmpty.length) return { headers: [], rows: [] };

  const seen = new Map<string, number>();
  const headers = nonEmpty[0].map((h, i) => {
    // Long form-question headings carry notes on later lines — keep the first
    const base = h.split(/\r?\n/)[0].trim() || `Column ${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });

  const rows = nonEmpty.slice(1).map((r) =>
    Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()]))
  );
  return { headers, rows };
}

export class SheetAccessError extends Error {}

/** Fetch and parse a sheet tab. Throws SheetAccessError with a user-facing message. */
export async function fetchSheet(ref: SheetRef): Promise<SheetData> {
  let res: Response;
  try {
    res = await fetch(csvUrl(ref), { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(15000) });
  } catch {
    throw new SheetAccessError("Couldn't reach Google Sheets. Check your connection and try again.");
  }

  // A private sheet lands on a Google sign-in page (HTML on accounts.google.com);
  // a shared sheet with a missing tab is redirected to the export host, then 400s
  const type = res.headers.get("content-type") ?? "";
  const host = new URL(res.url || csvUrl(ref)).hostname;
  if (host === "accounts.google.com" || res.status === 401 || res.status === 403) {
    throw new SheetAccessError(
      "The sheet isn't publicly readable. In Google Sheets, click Share → General access → \"Anyone with the link\" (Viewer)."
    );
  }
  if (res.status === 400 || res.status === 404) {
    throw new SheetAccessError(
      ref.gidInLink ? "That tab doesn't exist in this sheet any more. Choose another tab." : "Choose which tab to read."
    );
  }
  if (!res.ok || type.includes("text/html")) {
    throw new SheetAccessError(`Google Sheets returned an unexpected response (${res.status}). Try again shortly.`);
  }

  const table = parseCsv(await res.text());
  const { headers, rows } = toRecords(table);
  if (!headers.length) throw new SheetAccessError("The sheet is empty.");
  return { headers, rows, table, fetchedAt: new Date().toISOString() };
}

/**
 * Tabs in a shared sheet, read from its public "htmlview" page (there's no
 * keyless API for this). Returns [] for published links or if the page
 * format changes — callers then fall back to the tab in the link.
 */
export async function listTabs(ref: SheetRef): Promise<SheetTab[]> {
  if (ref.type !== "shared") return [];
  try {
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${ref.id}/htmlview`, {
      cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const tabs: SheetTab[] = [];
    const re = /\{name: "((?:[^"\\]|\\.)*)", pageUrl: "[^"]*?gid(?:=|\\x3d)(\d+)/g;
    for (const m of Array.from(html.matchAll(re))) {
      const name = m[1]
        .replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
        .replace(/\\(.)/g, "$1");
      if (!tabs.some((t) => t.gid === m[2])) tabs.push({ gid: m[2], name });
    }
    return tabs;
  } catch {
    return [];
  }
}
