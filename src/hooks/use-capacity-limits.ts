"use client";

import { useEffect, useState } from "react";
import { defaultCapacityLimits, type CapacityLimits } from "@/lib/capacity-defaults";

// Module-level cache so every badge on a page shares one request
let cached: CapacityLimits | null = null;
let inflight: Promise<CapacityLimits> | null = null;

function fetchLimits(): Promise<CapacityLimits> {
  inflight ??= fetch("/api/settings/capacity")
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (cached = d?.limits ?? defaultCapacityLimits()))
    .catch(() => defaultCapacityLimits())
    .finally(() => { inflight = null; });
  return inflight;
}

/** Call after saving limits so open pages pick up the new values. */
export function invalidateCapacityLimits() {
  cached = null;
}

/** Structure limits from Settings; returns defaults until loaded. */
export function useCapacityLimits(): CapacityLimits {
  const [limits, setLimits] = useState<CapacityLimits>(cached ?? defaultCapacityLimits());
  useEffect(() => {
    if (cached) { setLimits(cached); return; }
    let alive = true;
    fetchLimits().then((l) => { if (alive) setLimits(l); });
    return () => { alive = false; };
  }, []);
  return limits;
}
