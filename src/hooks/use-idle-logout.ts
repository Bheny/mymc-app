"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";

const IDLE_LIMIT_MS = 15 * 60 * 1000; // 15 minutes
const STORAGE_KEY   = "mymc:lastActivity";
const CHECK_EVERY_MS = 60 * 1000;

const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll"] as const;

/**
 * Signs the user out after IDLE_LIMIT_MS of inactivity.
 *
 * Activity is timestamped to localStorage (not just in-memory) so that a tab
 * discarded and reloaded by a mobile OS still sees how long it's really been —
 * otherwise the user would land on a fresh "active" timer and never get logged out.
 */
export function useIdleLogout(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const recordActivity = () => {
      try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch {}
    };

    const checkIdle = () => {
      let last = Date.now();
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) last = Number(stored);
      } catch {}

      if (Date.now() - last >= IDLE_LIMIT_MS) {
        signOut({ callbackUrl: "/login" });
      }
    };

    recordActivity();

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, recordActivity, { passive: true });
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") checkIdle();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", checkIdle);

    const interval = setInterval(checkIdle, CHECK_EVERY_MS);

    return () => {
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, recordActivity);
      }
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", checkIdle);
      clearInterval(interval);
    };
  }, [enabled]);
}
