// The Google Sheets behind the Legacy dashboard: one source per MC (any sheet
// + tab in the same form-responses format), stored config + cached reads.
import { prisma } from "@/lib/prisma";
import { fetchSheet, parseSheetUrl, withGid, SheetAccessError, type SheetData } from "@/lib/google-sheet";
import { parseDirectory, type DirectoryEntry } from "@/lib/legacy-directory";

const SETTING_KEY = "legacy.sheet";
const CACHE_MS    = 60 * 1000;
export const MAX_LEGACY_SOURCES = 12;

// Per-instance cache so a busy dashboard doesn't hit Google on every request
const cache = new Map<string, { data: SheetData; at: number }>();

export type LegacySource = {
  id:      string;         // stable key for the UI
  name:    string;         // MC name shown in the dashboard
  url:     string;
  gid:     string;         // tab to read
  tabName: string | null;
  // Optional "who leads what" tab in the same file (e.g. Bacenta Info)
  directoryGid?:     string | null;
  directoryTabName?: string | null;
  mcPastor?:         string | null;
};

export type ChurchDirectory = { url: string; gid: string; tabName: string | null };

export type LegacyConfig = {
  label:   string | null;
  sources: LegacySource[];
  // Shared "which cell belongs to which bacenta / MC" tab — the source of truth
  // for structure, so one sheet can feed several MCs
  directory?: ChurchDirectory | null;
};

export async function getLegacyConfig(): Promise<LegacyConfig | null> {
  let value: unknown;
  try {
    value = (await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } }))?.value;
  } catch {
    return null; // app_settings table not created yet
  }
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<LegacyConfig> & { url?: string; gid?: string; tabName?: string | null };

  // Single-sheet config from before multi-MC support
  if (v.url && !v.sources) {
    return {
      label: null,
      sources: [{
        id:      "source-1",
        name:    v.label ?? v.tabName ?? "MC 1",
        url:     v.url,
        gid:     v.gid ?? parseSheetUrl(v.url)?.gid ?? "0",
        tabName: v.tabName ?? null,
      }],
    };
  }
  return v.sources?.length ? { label: v.label ?? null, sources: v.sources, directory: v.directory ?? null } : null;
}

export async function saveLegacyConfig(config: LegacyConfig | null, userId: string) {
  cache.clear();
  if (!config || !config.sources.length) {
    await prisma.appSetting.deleteMany({ where: { key: SETTING_KEY } });
    return;
  }
  await prisma.appSetting.upsert({
    where:  { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: config, updatedById: userId },
    update: { value: config, updatedById: userId },
  });
}

export type SourceResult =
  | { source: LegacySource; data: SheetData; error?: undefined; directory: DirectoryEntry[]; directoryError?: string }
  | { source: LegacySource; data?: undefined; error: string; directory: DirectoryEntry[]; directoryError?: string };

/** Read one source's tab. `fresh` bypasses the 60s cache. */
export async function readSource(source: Pick<LegacySource, "url" | "gid">, fresh = false): Promise<SheetData> {
  const key = `${source.url}#${source.gid}`;
  const hit = cache.get(key);
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const ref = parseSheetUrl(source.url);
  if (!ref) throw new SheetAccessError("That isn't a Google Sheets link.");
  const data = await fetchSheet(withGid(ref, source.gid));
  cache.set(key, { data, at: Date.now() });
  return data;
}

/** Parse a directory tab; failures are reported, never thrown. */
export async function readDirectory(
  where: Pick<LegacySource, "url" | "gid">, fresh = false,
): Promise<{ directory: DirectoryEntry[]; directoryError?: string }> {
  try {
    return { directory: parseDirectory((await readSource(where, fresh)).table) };
  } catch (e) {
    return { directory: [], directoryError: e instanceof SheetAccessError ? e.message : "Couldn't read the directory tab." };
  }
}

/** All sources, fetched in parallel. One failing sheet doesn't block the rest. */
export async function getLegacyData({ fresh = false } = {}): Promise<{
  config: LegacyConfig;
  results: SourceResult[];
  church: { directory: DirectoryEntry[]; directoryError?: string } | null;
} | null> {
  const config = await getLegacyConfig();
  if (!config) return null;
  const church = config.directory ? readDirectory(config.directory, fresh) : Promise.resolve(null);
  const results = await Promise.all(config.sources.map(async (source): Promise<SourceResult> => {
    // The directory is optional extra detail — its failure never blocks the reports
    const dir = source.directoryGid
      ? readDirectory({ url: source.url, gid: source.directoryGid }, fresh)
      : Promise.resolve({ directory: [] as DirectoryEntry[] });
    try {
      const [data, d] = await Promise.all([readSource(source, fresh), dir]);
      return { source, data, ...d };
    } catch (e) {
      return { source, error: e instanceof SheetAccessError ? e.message : "Couldn't read this sheet.", ...(await dir) };
    }
  }));
  return { config, results, church: await church };
}
