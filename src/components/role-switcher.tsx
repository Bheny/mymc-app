"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Check, X } from "lucide-react";
import { useActiveRole, roleLabel, type RoleView } from "@/hooks/use-active-role";

// Fetches the display name for an acting scope (e.g. the cell name for cell_id)
function useScopeName(view: RoleView | null): string | null {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!view?.isActing || !view.scopeId || !view.scopeType) return;

    const endpoints: Record<string, string> = {
      cell:      `/api/org/cells/${view.scopeId}`,
      buscentre: `/api/org/buscentres/${view.scopeId}`,
      mc:        `/api/org/mega-churches/${view.scopeId}`,
    };

    const url = endpoints[view.scopeType];
    if (!url) return;

    fetch(url)
      .then((r) => r.json())
      .then((d) => setName(d.name ?? null))
      .catch(() => {});
  }, [view?.scopeId, view?.scopeType, view?.isActing]);

  return name;
}

function ViewLabel({ view }: { view: RoleView; showScopeName?: boolean }) {
  const scopeName = useScopeName(view.isActing ? view : null);

  return (
    <span>
      {roleLabel(view.role)}
      {view.isActing && scopeName && (
        <span className="opacity-60 ml-1 text-[11px]">· {scopeName}</span>
      )}
    </span>
  );
}

export function RoleSwitcher({ collapsed = false }: { collapsed?: boolean }) { // eslint-disable-line @typescript-eslint/no-unused-vars
  const { allViews, activeView, switchToView, removeActing, hasMultipleViews } = useActiveRole();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  if (!activeView) return null;

  // ── Single role — just a static badge ────────────────────────────────────
  if (!hasMultipleViews) {
    return (
      <div className="px-5 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <span
          className="text-[11px] font-medium px-2 py-1 rounded-lg"
          style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.55)" }}
        >
          {roleLabel(activeView.role)}
        </span>
      </div>
    );
  }

  // ── Multiple roles — dropdown switcher ────────────────────────────────────
  return (
    <div ref={ref} className="px-3 py-2 relative"
         style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-left transition-colors hover:bg-white/10"
      >
        <span className="text-[12px] font-medium truncate" style={{ color: "rgba(255,255,255,0.85)" }}>
          <ViewLabel view={activeView} />
        </span>
        <ChevronDown
          className="shrink-0 transition-transform"
          style={{ width: 14, height: 14, color: "rgba(255,255,255,0.5)",
                   // Dropdown opens upward, so chevron points down when closed and up when open
                   transform: open ? "rotate(0deg)" : "rotate(180deg)" }}
        />
      </button>

      {open && (
        <div
          className="absolute left-3 right-3 rounded-xl overflow-hidden z-50 py-1"
          style={{
            bottom: "calc(100% + 4px)",   // open upward — avoids sidebar clipping
            background: "#fff",
            boxShadow: "0 -4px 24px rgba(0,0,0,0.15)",
            border: "1px solid var(--brand-border)",
          }}
        >
          {allViews.map((view) => {
            const isActive = view.key === activeView.key;
            return (
              <button
                key={view.key}
                onClick={() => { switchToView(view.key); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-[var(--brand-navy-light)]"
              >
                {/* Check or spacer */}
                <span style={{ width: 16, flexShrink: 0 }}>
                  {isActive && <Check style={{ width: 14, height: 14, color: "var(--brand-navy)" }} />}
                </span>

                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: "var(--brand-text)" }}>
                    {roleLabel(view.role)}
                  </p>
                  {view.isActing && (
                    <p className="text-[11px]" style={{ color: "var(--brand-muted)" }}>
                      Acting · {view.scopeType}
                    </p>
                  )}
                </div>

                {view.isActing && (
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className="rounded-pill text-[10px] font-medium px-1.5 py-0.5"
                      style={{ background: "#FEF3DC", color: "#854F0B" }}
                    >
                      acting
                    </span>
                    {/* End acting role */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeActing(view);
                        setOpen(false);
                      }}
                      className="rounded p-0.5 transition-colors hover:bg-red-50"
                      title="End this acting role"
                    >
                      <X style={{ width: 12, height: 12, color: "var(--brand-danger)" }} />
                    </button>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
