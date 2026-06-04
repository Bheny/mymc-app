"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useActiveRole } from "@/hooks/use-active-role";
import { Button } from "@/components/ui/button";
import {
  LayoutGrid, Users, BarChart2, UserPlus, TrendingUp, FileText,
  X, ChevronRight, Loader2,
} from "lucide-react";

// ─── Report definitions ────────────────────────────────────────────────────────

type ReportDef = {
  id:          string;
  label:       string;
  description: string;
  icon:        React.ElementType;
  color:       string;
  needsDates:  boolean;
};

const REPORTS: ReportDef[] = [
  {
    id: "cells-ready-to-divide", label: "Cells Ready to Divide",
    description: "Cells at or above the 13-member cap, ranked by count.",
    icon: LayoutGrid, color: "#7C3AED", needsDates: false,
  },
  {
    id: "consistent-absentees", label: "Consistent Absentees",
    description: "Members absent 2+ times in the selected period — your pastoral follow-up list.",
    icon: Users, color: "#DC2626", needsDates: true,
  },
  {
    id: "shepherd-load", label: "Shepherd Load",
    description: "Every shepherd ranked by member count vs the 5-member cap.",
    icon: Users, color: "#B45309", needsDates: false,
  },
  {
    id: "first-timer-conversion", label: "First Timer Conversion",
    description: "How many first timers became members, broken down by cell.",
    icon: UserPlus, color: "#059669", needsDates: true,
  },
  {
    id: "highest-attendance", label: "Highest Attendance",
    description: "Top 10 services by attendance rate in the selected period.",
    icon: BarChart2, color: "var(--brand-navy)", needsDates: true,
  },
  {
    id: "monthly-summary", label: "Monthly / Quarterly Summary",
    description: "Members, attendance averages, first timers, and souls won in one view.",
    icon: TrendingUp, color: "#1A8C6C", needsDates: true,
  },
];

type Option = { id: string; name: string };

// ─── Component ────────────────────────────────────────────────────────────────

export function GenerateReportModal({ onClose }: { onClose: () => void }) {
  const { data: session } = useSession();
  const { activeView }    = useActiveRole();

  const activeRole = activeView?.role ?? session?.user?.role ?? null;

  // Step — "select" | "configure"
  const [step,       setStep]       = useState<"select" | "configure">("select");
  const [selected,   setSelected]   = useState<ReportDef | null>(null);

  // Dates
  const today  = new Date().toISOString().slice(0, 10);
  const jan1   = `${new Date().getFullYear()}-01-01`;
  const [from, setFrom] = useState(jan1);
  const [to,   setTo]   = useState(today);

  // Scope cascade
  const [mcOptions,        setMcOptions]        = useState<Option[]>([]);
  const [buscentreOptions, setBuscentreOptions] = useState<Option[]>([]);
  const [cellOptions,      setCellOptions]       = useState<Option[]>([]);
  const [filterMcId,        setFilterMcId]        = useState("");
  const [filterBuscentreId, setFilterBuscentreId] = useState("");
  const [filterCellId,      setFilterCellId]      = useState("");

  const [generating, setGenerating] = useState(false);

  // Determine which scope levels to show based on active role
  const showMcPicker       = activeRole === "admin" || activeRole === "chief_shepherd";
  const showBuscentrePicker = showMcPicker || activeRole === "mc_pastor";
  const showCellPicker      = showMcPicker || activeRole === "mc_pastor" || activeRole === "buscentre_head";

  // Scope IDs pre-filled from the active view
  const lockedBuscentreId = (activeRole === "buscentre_head" || activeRole === "cell_shepherd")
    ? (activeView?.buscentreId ?? null) : null;
  const lockedCellId = activeRole === "cell_shepherd"
    ? (activeView?.cellId ?? null) : null;
  const lockedMcId   = activeRole === "mc_pastor"
    ? (activeView?.mcId ?? null) : null;

  // ── Fetch MC options for admin/chief_shepherd ─────────────────────────────
  useEffect(() => {
    if (!showMcPicker) return;
    fetch("/api/org/mega-churches").then((r) => r.json()).then(setMcOptions).catch(() => {});
  }, [showMcPicker]);

  // ── Cascade MC → buscentres ───────────────────────────────────────────────
  useEffect(() => {
    const mcId = filterMcId || lockedMcId;
    if (!mcId) { setBuscentreOptions([]); return; }
    fetch(`/api/org/buscentres?mcId=${mcId}`)
      .then((r) => r.json()).then(setBuscentreOptions).catch(() => {});
  }, [filterMcId, lockedMcId]);

  // ── Cascade buscentre → cells ─────────────────────────────────────────────
  useEffect(() => {
    const bcId = filterBuscentreId || lockedBuscentreId;
    if (!bcId) { setCellOptions([]); return; }
    fetch(`/api/org/cells?buscentreId=${bcId}`)
      .then((r) => r.json()).then(setCellOptions).catch(() => {});
  }, [filterBuscentreId, lockedBuscentreId]);

  // ── Resolve the effective scope to pass to the API ────────────────────────
  function resolveScope(): { scope: string; scopeId: string } {
    if (filterCellId || lockedCellId) return { scope: "cell",      scopeId: filterCellId || lockedCellId! };
    if (filterBuscentreId || lockedBuscentreId) return { scope: "buscentre", scopeId: filterBuscentreId || lockedBuscentreId! };
    if (filterMcId || lockedMcId)   return { scope: "mc",         scopeId: filterMcId || lockedMcId! };
    return { scope: "all", scopeId: "" };
  }

  function handleSelect(report: ReportDef) {
    setSelected(report);
    setStep("configure");
  }

  async function handleGenerate() {
    if (!selected) return;
    setGenerating(true);

    const { scope, scopeId } = resolveScope();
    const params = new URLSearchParams({ type: selected.id });
    if (scope !== "all") { params.set("scope", scope); if (scopeId) params.set("scopeId", scopeId); }
    if (selected.needsDates) { params.set("from", from); params.set("to", to); }

    // Open in new tab — the preview page fetches its own data
    window.open(`/report?${params.toString()}`, "_blank");
    setGenerating(false);
    onClose();
  }

  // ── Scope label for display ───────────────────────────────────────────────
  function scopeLabel(): string {
    const { scope, scopeId } = resolveScope();
    if (scope === "cell") {
      const name = cellOptions.find((c) => c.id === scopeId)?.name ?? (lockedCellId ? "My Cell" : scopeId);
      return `Cell: ${name}`;
    }
    if (scope === "buscentre") {
      const name = buscentreOptions.find((b) => b.id === scopeId)?.name ?? (lockedBuscentreId ? "My Buscentre" : scopeId);
      return `Buscentre: ${name}`;
    }
    if (scope === "mc") {
      const name = mcOptions.find((m) => m.id === scopeId)?.name ?? (lockedMcId ? "My MC" : scopeId);
      return `MC: ${name}`;
    }
    return "All data";
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full rounded-2xl flex flex-col overflow-hidden"
        style={{ maxWidth: 560, maxHeight: "90vh", background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4"
             style={{ borderBottom: "1px solid var(--brand-border)" }}>
          <div className="flex items-center gap-2">
            {step === "configure" && (
              <button
                onClick={() => setStep("select")}
                className="mr-1 p-1 rounded hover:bg-[var(--brand-navy-light)] transition-colors"
              >
                <ChevronRight className="h-4 w-4 rotate-180" style={{ color: "var(--brand-muted)" }} />
              </button>
            )}
            <FileText className="h-4 w-4" style={{ color: "var(--brand-navy)" }} />
            <h2 className="text-[16px] font-semibold" style={{ color: "var(--brand-text)" }}>
              {step === "select" ? "Generate Report" : selected?.label}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:opacity-60 transition-opacity">
            <X className="h-5 w-5" style={{ color: "var(--brand-muted)" }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Step 1: Select report ── */}
          {step === "select" && (
            <div className="p-5 grid grid-cols-1 gap-3">
              {REPORTS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleSelect(r)}
                  className="text-left flex items-start gap-4 rounded-xl px-4 py-3.5 transition-all hover:shadow-sm"
                  style={{ border: "1px solid var(--brand-border)", background: "#fff" }}
                >
                  <div className="flex items-center justify-center rounded-xl shrink-0"
                       style={{ width: 40, height: 40, background: `${r.color}18` }}>
                    <r.icon className="h-5 w-5" style={{ color: r.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold" style={{ color: "var(--brand-text)" }}>{r.label}</p>
                    <p className="text-[12px] mt-0.5" style={{ color: "var(--brand-muted)" }}>{r.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 mt-1 shrink-0" style={{ color: "var(--brand-muted)" }} />
                </button>
              ))}
            </div>
          )}

          {/* ── Step 2: Configure ── */}
          {step === "configure" && selected && (
            <div className="p-5 flex flex-col gap-5">

              {/* Date range — only for reports that need it */}
              {selected.needsDates && (
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.06em]"
                     style={{ color: "var(--brand-muted)" }}>Date range</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[12px]" style={{ color: "var(--brand-muted)" }}>From</label>
                      <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                             className="h-10 px-3 text-[14px] rounded-lg"
                             style={{ border: "1px solid var(--brand-border)", background: "#fff", color: "var(--brand-text)" }} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[12px]" style={{ color: "var(--brand-muted)" }}>To</label>
                      <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                             className="h-10 px-3 text-[14px] rounded-lg"
                             style={{ border: "1px solid var(--brand-border)", background: "#fff", color: "var(--brand-text)" }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Scope — cascade based on role */}
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.06em]"
                   style={{ color: "var(--brand-muted)" }}>Scope</p>

                {/* Admin/Chief: MC → Buscentre → Cell */}
                {showMcPicker && (
                  <select value={filterMcId}
                          onChange={(e) => { setFilterMcId(e.target.value); setFilterBuscentreId(""); setFilterCellId(""); }}
                          className="h-10 px-3 text-[14px] rounded-lg"
                          style={{ border: "1px solid var(--brand-border)", background: "#fff", color: "var(--brand-text)" }}>
                    <option value="">All MCs</option>
                    {mcOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                )}

                {/* MC Pastor: Buscentre → Cell (MC auto-scoped) */}
                {showBuscentrePicker && !lockedBuscentreId && (
                  <select value={filterBuscentreId}
                          onChange={(e) => { setFilterBuscentreId(e.target.value); setFilterCellId(""); }}
                          disabled={showMcPicker && !filterMcId && !lockedMcId}
                          className="h-10 px-3 text-[14px] rounded-lg disabled:opacity-40"
                          style={{ border: "1px solid var(--brand-border)", background: "#fff", color: "var(--brand-text)" }}>
                    <option value="">All buscentres</option>
                    {buscentreOptions.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                )}
                {lockedBuscentreId && (
                  <div className="h-10 px-3 flex items-center rounded-lg text-[14px]"
                       style={{ border: "1px solid var(--brand-border)", background: "#F9FAFB", color: "var(--brand-text)" }}>
                    {buscentreOptions.find((b) => b.id === lockedBuscentreId)?.name ?? "My Buscentre"}
                    <span className="ml-auto text-[11px] px-2 py-0.5 rounded-pill"
                          style={{ background: "var(--brand-navy-light)", color: "var(--brand-navy)" }}>locked</span>
                  </div>
                )}

                {/* Buscentre Head + MC Pastor: Cell */}
                {showCellPicker && !lockedCellId && (
                  <select value={filterCellId} onChange={(e) => setFilterCellId(e.target.value)}
                          disabled={!filterBuscentreId && !lockedBuscentreId}
                          className="h-10 px-3 text-[14px] rounded-lg disabled:opacity-40"
                          style={{ border: "1px solid var(--brand-border)", background: "#fff", color: "var(--brand-text)" }}>
                    <option value="">All cells</option>
                    {cellOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
                {lockedCellId && (
                  <div className="h-10 px-3 flex items-center rounded-lg text-[14px]"
                       style={{ border: "1px solid var(--brand-border)", background: "#F9FAFB", color: "var(--brand-text)" }}>
                    {cellOptions.find((c) => c.id === lockedCellId)?.name ?? "My Cell"}
                    <span className="ml-auto text-[11px] px-2 py-0.5 rounded-pill"
                          style={{ background: "var(--brand-navy-light)", color: "var(--brand-navy)" }}>locked</span>
                  </div>
                )}

                {/* Scope summary */}
                <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
                  Reporting on: <span className="font-medium" style={{ color: "var(--brand-text)" }}>{scopeLabel()}</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "configure" && (
          <div className="px-5 py-4 flex justify-end gap-3"
               style={{ borderTop: "1px solid var(--brand-border)" }}>
            <Button variant="outline" onClick={onClose} className="h-9 text-[13px]" style={{ borderRadius: 8 }}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="h-9 text-[13px]"
              style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}
            >
              {generating
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…</>
                : <><FileText className="h-4 w-4 mr-2" /> Preview Report</>}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
