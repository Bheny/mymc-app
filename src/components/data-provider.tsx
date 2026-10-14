"use client";

import { SWRConfig } from "swr";
import { useSession } from "next-auth/react";
import { fetchJson } from "@/lib/fetch-json";
import type { ReactNode } from "react";

/**
 * App-wide data cache. Pages that read through SWR show their last-known data
 * instantly when revisited and refresh it quietly in the background, instead of
 * starting from a skeleton every time.
 *
 * The cache lives in memory and is re-created whenever the signed-in user
 * changes (the `key` below), so one person's data can never appear for another on a
 * shared device. Cache keys are the request URLs, which already carry the acting
 * role/scope, so switching role never reuses another role's data.
 */
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
      }}
    >
      {children}
    </SWRConfig>
  );
}
