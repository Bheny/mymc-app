"use client";

import { useEffect } from "react";
import { SWRConfig, useSWRConfig } from "swr";
import { useSession } from "next-auth/react";
import { fetchJson } from "@/lib/fetch-json";
import { clearPersistedCache, loadPersisted, savePersisted } from "@/lib/persist-cache";
import { toast } from "@/hooks/use-toast";
import type { ReactNode } from "react";

/**
 * App-wide data cache. Pages that read through SWR show their last-known data
 * instantly when revisited and refresh it quietly in the background, instead of
 * starting from a skeleton every time.
 *
 * The cache is re-created whenever the signed-in user changes (the `key` below), so
 * one person's data can never appear for another on a shared device. Cache keys are
 * the request URLs, which already carry the acting role/scope, so switching role never
 * reuses another role's data.
 *
 * A copy is also kept on the device (lib/persist-cache) so reopening the app is instant.
 */

// Tell the user once in a while — not for every request — that things are slow
let lastSlowNotice = 0;
function notifySlow() {
  if (Date.now() - lastSlowNotice < 30_000) return;
  lastSlowNotice = Date.now();
  toast({ title: "Still loading…", description: "Your connection looks slow. We'll keep trying." });
}

/**
 * Fills the cache from the saved copy right after the first render. It happens after
 * hydration on purpose: if the saved data were present during the first render, the page
 * would differ from the server's HTML.
 */
function CacheSync({ userId }: { userId: string }) {
  const { cache, mutate } = useSWRConfig();

  useEffect(() => {
    // Nobody signed in (login page, after sign-out): leave nothing behind
    if (userId === "anonymous") { clearPersistedCache(); return; }

    for (const [key, data] of loadPersisted(userId)) {
      if (cache.get(key)?.data === undefined) mutate(key, data, { revalidate: false });
    }

    const save = () => savePersisted(userId, cache);
    const onHide = () => { if (document.visibilityState === "hidden") save(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", save);
    const timer = setInterval(save, 30_000);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", save);
      clearInterval(timer);
    };
  }, [userId, cache, mutate]);

  return null;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "anonymous";

  return (
    <SWRConfig
      key={userId}
      value={{
        provider: () => new Map(),
        fetcher: (url: string) => fetchJson(url),
        // Keep showing the previous result while a new key (search, filter) loads
        keepPreviousData: true,
        // Quietly re-check when the user comes back to the app, at most once a minute
        revalidateOnFocus: true,
        focusThrottleInterval: 60_000,
        revalidateOnReconnect: true,
        dedupingInterval: 5_000,
        errorRetryCount: 2,
        errorRetryInterval: 4_000,
        // A request still running after 8s gets a notice, so a slow connection never looks frozen
        loadingTimeout: 8_000,
        onLoadingSlow: notifySlow,
      }}
    >
      <CacheSync userId={userId} />
      {children}
    </SWRConfig>
  );
}
