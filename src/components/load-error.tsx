"use client";

import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shown in place of a skeleton when a page's data couldn't be loaded. */
export function LoadError({
  message = "Couldn't load this page.",
  onRetry,
  compact = false,
}: {
  message?: string;
  onRetry: () => void;
  /** Inline version for inside a list or card (no page padding / border) */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="p-8 text-center flex flex-col items-center gap-3">
        <WifiOff style={{ width: 28, height: 28, color: "var(--brand-muted)" }} />
        <p className="text-[14px]" style={{ color: "var(--brand-text)" }}>{message}</p>
        <Button onClick={onRetry} variant="outline" className="h-9 text-[13px]" style={{ borderRadius: 8 }}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Try again
        </Button>
      </div>
    );
  }
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-10 max-w-[480px] mx-auto">
      <div className="rounded-xl p-8 text-center flex flex-col items-center gap-3"
           style={{ border: "1px solid var(--brand-border)", background: "var(--surface)" }}>
        <WifiOff style={{ width: 32, height: 32, color: "var(--brand-muted)" }} />
        <p className="text-[14px]" style={{ color: "var(--brand-text)" }}>{message}</p>
        <Button onClick={onRetry} className="h-9 text-[13px]"
                style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Try again
        </Button>
      </div>
    </div>
  );
}

/** Slim notice when a background refresh failed but earlier data is still on screen. */
export function StaleNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-lg px-3 py-2 mb-4 flex items-center justify-between gap-3 text-[12px]"
         style={{ background: "var(--tint-warn-bg)", color: "var(--tint-warn-fg)" }}>
      <span>Couldn&apos;t refresh — showing the last data loaded.</span>
      <button onClick={onRetry} className="font-medium underline shrink-0">Retry</button>
    </div>
  );
}
