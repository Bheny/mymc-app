"use client";

import { Check, Crown } from "lucide-react";
import type { LeaderOption } from "@/lib/leader-attendance";

// Senior shepherds and MC pastors aren't on a cell's roster, so they're ticked here instead.
// Someone already counted at another cell that day is shown but can't be ticked again.

const KIND_LABEL = { senior_shepherd: "Senior shepherd", mc_pastor: "MC pastor" } as const;

export function LeaderAttendancePicker({ options, selected, onToggle, serviceType }: {
  options: LeaderOption[]; selected: Set<string>; onToggle: (id: string) => void; serviceType: string;
}) {
  if (options.length === 0) return null;
  const visiting = serviceType === "LC_LIVE" && options.some((o) => o.mode === "visiting");

  return (
    <div className="mt-8">
      <div className="mb-3">
        <h2 className="text-[16px] font-semibold" style={{ color: "var(--brand-text)" }}>Leaders</h2>
        <p className="text-[13px] mt-0.5" style={{ color: "var(--brand-muted)" }}>
          {visiting
            ? "Senior shepherds visit a different cell each LC Live. Tick the ones who were here. Each is counted at one cell per service."
            : "Senior shepherds and pastors counted at this cell. Each is counted at one cell per service."}
        </p>
      </div>

      <ul className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--brand-border)" }}>
        {options.map((o, i) => {
          const on = selected.has(o.id), blocked = !!o.takenBy;
          return (
            <li key={o.id} style={i > 0 ? { borderTop: "1px solid var(--brand-border)" } : undefined}>
              <button
                type="button" disabled={blocked} aria-pressed={on} onClick={() => onToggle(o.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left disabled:opacity-60 active:bg-[var(--brand-navy-light)]"
              >
                <span className="h-7 w-7 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: "var(--brand-navy-light)", color: "var(--brand-link)" }}>
                  <Crown className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium truncate" style={{ color: "var(--brand-text)" }}>{o.name}</span>
                  <span className="block text-[12px] truncate" style={{ color: "var(--brand-muted)" }}>
                    {KIND_LABEL[o.kind]}
                    {blocked ? ` · already counted at ${o.takenBy}`
                      : o.mode === "visiting" ? ` · visiting${o.homeCellName ? ` (home: ${o.homeCellName})` : ""}`
                      : " · home cell"}
                  </span>
                </span>
                <span className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                      style={on
                        ? { background: "var(--brand-navy)", color: "#fff" }
                        : { border: "1px solid var(--brand-border)", color: "transparent" }}>
                  <Check className="h-4 w-4" />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
