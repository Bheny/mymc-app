import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { listTabs, parseSheetUrl, SheetAccessError, type SheetTab } from "@/lib/google-sheet";
import {
  getLegacyConfig, readSource, saveLegacyConfig, MAX_LEGACY_SOURCES, type ChurchDirectory, type LegacySource,
} from "@/lib/legacy-sheet";
import { mapColumns } from "@/lib/legacy-report";
import { parseDirectory } from "@/lib/legacy-directory";

const EDITOR_ROLES = ["admin", "chief_shepherd"];

async function requireEditor() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Unauthorised" }, { status: 401 }) };
  if (!EDITOR_ROLES.includes(session.user.role ?? "")) {
    return { error: NextResponse.json({ error: "Only admins and chief shepherds can manage the Legacy data sources" }, { status: 403 }) };
  }
  return { session };
}

type Status =
  | { ok: true; rowCount: number; headers: string[]; directoryCount?: number; directoryError?: string }
  | { ok: false; error: string };

/** Can we read this tab, and is it in the form-responses format the dashboard needs? */
async function probe(source: Pick<LegacySource, "url" | "gid">, fresh = true): Promise<Status> {
  if (!parseSheetUrl(source.url)) return { ok: false, error: "That isn't a Google Sheets link." };
  try {
    const data = await readSource(source, fresh);
    const { missing } = mapColumns(data.headers);
    if (missing.length) {
      return { ok: false, error: `This tab doesn't look like form responses — missing ${missing.join(", ")} columns.` };
    }
    return { ok: true, rowCount: data.rows.length, headers: data.headers };
  } catch (e) {
    return { ok: false, error: e instanceof SheetAccessError ? e.message : "Couldn't read the sheet." };
  }
}

/** How many cells a directory tab lists, or why it can't be used. */
async function probeDirectory(url: string, gid: string, fresh = true): Promise<{ count: number } | { error: string }> {
  try {
    const entries = parseDirectory((await readSource({ url, gid }, fresh)).table);
    return entries.length ? { count: entries.length } : { error: "No Cell / Cell Shepherd columns found in that tab." };
  } catch (e) {
    return { error: e instanceof SheetAccessError ? e.message : "Couldn't read the directory tab." };
  }
}

/** Likely "who leads what" tab, if the file has one. */
function suggestDirectory(tabs: SheetTab[]): string | null {
  return tabs.find((t) => /bacenta info|directory|leadership/i.test(t.name))?.gid ?? null;
}

/** Default tab: the one in the link, else a form-responses tab, else the first. */
function suggestTab(tabs: SheetTab[], linkGid: string | null): string | null {
  if (linkGid && (tabs.length === 0 || tabs.some((t) => t.gid === linkGid))) return linkGid;
  return (tabs.find((t) => /response/i.test(t.name)) ?? tabs[0])?.gid ?? null;
}

/**
 * GET — current config, plus:
 *   ?check=1     a live check of every source
 *   ?tabs=<url>  the tabs in a pasted link, with a suggested default
 */
export async function GET(request: Request) {
  const { error } = await requireEditor();
  if (error) return error;

  const sp = new URL(request.url).searchParams;

  const tabsFor = sp.get("tabs");
  if (tabsFor !== null) {
    const ref = parseSheetUrl(tabsFor);
    if (!ref) return NextResponse.json({ error: "That isn't a Google Sheets link." }, { status: 400 });
    const tabs = await listTabs(ref);
    return NextResponse.json({
      tabs,
      suggested: suggestTab(tabs, ref.gidInLink ? ref.gid : null),
      suggestedDirectory: suggestDirectory(tabs),
    });
  }

  const config = await getLegacyConfig();
  const status = config && sp.get("check")
    ? Object.fromEntries(await Promise.all(config.sources.map(async (s) => {
        const st = await probe(s);
        if (st.ok && s.directoryGid) {
          const d = await probeDirectory(s.url, s.directoryGid);
          Object.assign(st, "count" in d ? { directoryCount: d.count } : { directoryError: d.error });
        }
        return [s.id, st] as const;
      })))
    : null;
  const church = config?.directory && sp.get("check")
    ? await probeDirectory(config.directory.url, config.directory.gid)
    : null;
  return NextResponse.json({ config, status, church });
}

/**
 * PUT — { label?, directory?: { url, gid? } | null, sources: [{ id?, name, url, gid?, directoryGid?, mcPastor? }] }.
 * directory: the shared church directory — each cell's MC and bacenta come from it.
 * directoryGid: "" for none, omitted to auto-detect a "Bacenta Info"-style tab.
 * Every source is checked before saving; errors come back keyed by index.
 */
export async function PUT(request: Request) {
  const { session, error } = await requireEditor();
  if (error) return error;

  const body = await request.json();
  const label = typeof body.label === "string" ? body.label.trim() || null : null;
  const input: unknown[] = Array.isArray(body.sources) ? body.sources : [];
  if (!input.length) return NextResponse.json({ error: "Add at least one sheet" }, { status: 400 });
  if (input.length > MAX_LEGACY_SOURCES) {
    return NextResponse.json({ error: `You can connect up to ${MAX_LEGACY_SOURCES} sheets` }, { status: 400 });
  }

  // ── Shared church directory (optional) ──
  let directory: ChurchDirectory | null = null;
  let church: { count: number } | null = null;
  const dirInput = body.directory as { url?: unknown; gid?: unknown } | null | undefined;
  const dirUrl = typeof dirInput?.url === "string" ? dirInput.url.trim() : "";
  if (dirUrl) {
    const ref = parseSheetUrl(dirUrl);
    if (!ref) return NextResponse.json({ error: "Church directory: that isn't a Google Sheets link.", directoryError: true }, { status: 400 });
    const tabs = await listTabs(ref);
    const gid = (typeof dirInput?.gid === "string" && dirInput.gid) || suggestDirectory(tabs) || (ref.gidInLink ? ref.gid : null);
    if (!gid) return NextResponse.json({ error: "Church directory: choose which tab lists the cells.", directoryError: true }, { status: 400 });
    const d = await probeDirectory(dirUrl, gid);
    if ("error" in d) return NextResponse.json({ error: `Church directory: ${d.error}`, directoryError: true }, { status: 400 });
    directory = { url: dirUrl, gid, tabName: tabs.find((t) => t.gid === gid)?.name ?? null };
    church = d;
  }

  const errors: Record<number, string> = {};
  const names = new Set<string>();
  const sources: LegacySource[] = [];
  const statuses: Status[] = [];

  await Promise.all(input.map(async (raw, i) => {
    const s = (raw ?? {}) as Record<string, unknown>;
    const name = typeof s.name === "string" ? s.name.trim() : "";
    const url  = typeof s.url === "string" ? s.url.trim() : "";
    if (!name) { errors[i] = directory ? "Give this sheet a label" : "Give this MC a name"; return; }
    if (!url)  { errors[i] = "Paste the sheet link"; return; }
    const ref = parseSheetUrl(url);
    if (!ref)  { errors[i] = "That isn't a Google Sheets link."; return; }

    const tabs = await listTabs(ref);
    const gid = (typeof s.gid === "string" && s.gid) || suggestTab(tabs, ref.gidInLink ? ref.gid : null) || ref.gid;
    const status = await probe({ url, gid });
    if (!status.ok) { errors[i] = status.error; return; }

    // Directory tab: "" = none, missing = auto-detect
    const directoryGid = typeof s.directoryGid === "string"
      ? s.directoryGid || null
      : suggestDirectory(tabs);
    if (directoryGid) {
      if (directoryGid === gid) { errors[i] = "The directory tab must be different from the reports tab."; return; }
      const d = await probeDirectory(url, directoryGid);
      if ("error" in d) {
        // Only block when the admin picked it; an auto-detected tab that doesn't parse is just skipped
        if (typeof s.directoryGid === "string") { errors[i] = `Directory tab: ${d.error}`; return; }
      } else {
        status.directoryCount = d.count;
      }
    }
    const usedDirectory = directoryGid && status.directoryCount ? directoryGid : null;

    sources[i] = {
      id:      typeof s.id === "string" && s.id ? s.id : `source-${Date.now()}-${i}`,
      name, url, gid,
      tabName: tabs.find((t) => t.gid === gid)?.name ?? null,
      directoryGid:     usedDirectory,
      directoryTabName: usedDirectory ? tabs.find((t) => t.gid === usedDirectory)?.name ?? null : null,
      mcPastor: typeof s.mcPastor === "string" ? s.mcPastor.trim() || null : null,
    };
    statuses[i] = status;
  }));

  sources.forEach((s, i) => {
    const key = s.name.toLowerCase();
    if (names.has(key)) errors[i] = directory ? "Each sheet needs a different label" : "Each MC needs a different name";
    names.add(key);
  });
  // Same tab connected twice would double-count every report
  const seen = new Set<string>();
  sources.forEach((s, i) => {
    const ref = parseSheetUrl(s.url);
    const key = `${ref?.type === "shared" ? ref.id : ref?.key}#${s.gid}`;
    if (seen.has(key)) errors[i] = "This tab is already connected above";
    seen.add(key);
  });

  if (Object.keys(errors).length) return NextResponse.json({ error: "Some sheets need attention", errors }, { status: 400 });

  try {
    await saveLegacyConfig({ label, sources, directory }, session.user.id);
  } catch (e) {
    console.error("[settings/legacy-sheet] save failed:", e);
    return NextResponse.json(
      { error: "Could not save — the app_settings table may not exist yet (run `npx prisma db push`)." },
      { status: 500 }
    );
  }
  return NextResponse.json({
    config: { label, sources, directory },
    status: Object.fromEntries(sources.map((s, i) => [s.id, statuses[i]])),
    church,
  });
}

/** DELETE — disconnect all sheets. */
export async function DELETE() {
  const { session, error } = await requireEditor();
  if (error) return error;
  await saveLegacyConfig(null, session.user.id);
  return NextResponse.json({ success: true });
}
