// Saves the page-data cache (SWR) on the device so reopening the app shows the last-known
// numbers at once, then refreshes them quietly — instead of starting from a loading state.
//
// Safety rules:
//   · one saved copy, tagged with the signed-in user; another user's copy is never loaded
//   · wiped on sign-out (and whenever nobody is signed in), so nothing is left on a shared phone
//   · only successful /api/ reads are kept, capped in size and age
//   · every read/write is guarded: private windows and full storage just mean "no saved copy"

const KEY = "mymc-swr-cache";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;   // older than a day isn't worth showing
const MAX_ENTRY_CHARS = 400_000;          // skip one very large response
const MAX_TOTAL_CHARS = 2_000_000;        // localStorage allows ~5MB per site; stay well under

type Saved = { uid: string; at: number; entries: [string, unknown][] };
type CacheLike = { keys(): Iterable<string>; get(key: string): { data?: unknown; error?: unknown } | undefined };

const persistable = (key: string) => key.startsWith("/api/") && !key.startsWith("/api/auth");

export function loadPersisted(uid: string): [string, unknown][] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const saved = JSON.parse(raw) as Saved;
    if (saved.uid !== uid || Date.now() - saved.at > MAX_AGE_MS || !Array.isArray(saved.entries)) return [];
    return saved.entries;
  } catch {
    return [];
  }
}

export function savePersisted(uid: string, cache: CacheLike) {
  try {
    // Newest entries are added last, so walk backwards to keep the most recent within budget
    const all = Array.from(cache.keys()).filter(persistable);
    const entries: [string, unknown][] = [];
    let total = 0;
    for (let i = all.length - 1; i >= 0; i--) {
      const state = cache.get(all[i]);
      if (!state || state.data === undefined || state.error) continue;
      const size = JSON.stringify(state.data).length;
      if (size > MAX_ENTRY_CHARS || total + size > MAX_TOTAL_CHARS) continue;
      total += size;
      entries.push([all[i], state.data]);
    }
    if (entries.length === 0) return;
    localStorage.setItem(KEY, JSON.stringify({ uid, at: Date.now(), entries } satisfies Saved));
  } catch { /* storage full or unavailable — fine, it's only a speed-up */ }
}

/** Call on sign-out. */
export function clearPersistedCache() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
