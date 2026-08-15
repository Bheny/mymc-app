"use client";

import { useEffect, useState } from "react";
import {
  ChevronLeft, ChevronRight, ClipboardList, UserPlus, UserCheck, Heart, Loader2,
} from "lucide-react";
import { useActiveRole } from "@/hooks/use-active-role";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";

// ─── Types ────────────────────────────────────────────────────────────────────

type Scope = "cell" | "buscentre" | "mc" | "branch";

type Summary = {
  lcLiveAvg: number; lcLiveMedian: number; lcLiveServices: number;
  mgsAvg: number;    mgsMedian: number;    mgsServices: number;
  firstTimers: number; retained: number; soulsWon: number;
  activeMembers: number;
};

type ServiceEntry = {
  id: string; type: string; date: string; mode: string;
  speaker: string | null; notes: string | null;
  cellName?: string;
  presentCount: number; totalMarked: number;
  cellShepherdPresent?: number;
  shepherdsPresent?:    number;
  membersPresent?:      number;
  firstTimersCount?:    number;
  firstTimersRetained?: number;
  soulsWonCount?:       number;
  totalAttendance?:     number;
};

// Cell-level breakdown row — carries buscentre/MC info once scope is wide enough
// to need a cascade (mc scope adds buscentre*, branch scope adds mc* on top).
type BreakdownRow = {
  id: string; name: string;
  buscentreId?:   string;
  buscentreName?: string;
  mcId?:          string;
  mcName?:        string;
};

type AnalysisData = {
  scope:     { type: string; name: string; id: string };
  period:    { year: number; month: number | null };
  summary:   Summary;
  breakdown: BreakdownRow[];
  services:  ServiceEntry[];
};

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const TYPE_LABEL: Record<string, string> = {
  LC_LIVE: "LC Live", MGS: "MGS", SHEPHERDS_MEETING: "Shepherds Mtg", SPECIAL_MEETING: "Special Meeting",
};
const TYPE_COLOR: Record<string, string> = {
  LC_LIVE: "var(--brand-navy)", MGS: "#1A8C6C", SHEPHERDS_MEETING: "#7C3AED", SPECIAL_MEETING: "#B45309",
};

// Build a de-duplicated {id, name} option list from breakdown rows, keyed by
// whichever id/name field pair the caller wants (mc or buscentre level).
function uniqueOptions(
  rows: BreakdownRow[],
  idKey: "mcId" | "buscentreId",
  nameKey: "mcName" | "buscentreName",
): { id: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const r of rows) {
    const id = r[idKey], name = r[nameKey];
    if (id && name && !seen.has(id)) seen.set(id, name);
  }
  return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon,
}: {
  label: string; value: string | number; sub?: string; icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl px-5 py-4 flex flex-col gap-1"
         style={{ border: "1px solid var(--brand-border)", background: "#fff" }}>
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color: "var(--brand-muted)" }}>{icon}</span>
        <span className="text-[11px] font-medium uppercase tracking-[0.06em]"
              style={{ color: "var(--brand-muted)" }}>
          {label}
        </span>
      </div>
      <span className="text-[28px] font-bold leading-none" style={{ color: "var(--brand-navy)" }}>
        {value}
      </span>
      {sub && <span className="text-[12px] mt-1" style={{ color: "var(--brand-muted)" }}>{sub}</span>}
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function SummarySection({ scope }: { scope: Scope }) {
  const { activeView, ready } = useActiveRole();
  const actingCellId      = scope === "cell"      && activeView?.isActing && activeView.cellId      ? activeView.cellId      : null;
  const actingBuscentreId = scope === "buscentre" && activeView?.isActing && activeView.buscentreId  ? activeView.buscentreId : null;
  const actingMcId        = scope === "mc"        && activeView?.isActing && activeView.mcId         ? activeView.mcId        : null;
  const actingBranchId    = scope === "branch"    && activeView?.isActing && activeView.branchId     ? activeView.branchId    : null;

  const now = new Date();
  const [year,      setYear]      = useState(now.getFullYear());
  const [month,     setMonth]     = useState<number | null>(null);
  const [filterMcId,        setFilterMcId]        = useState(""); // branch scope only
  const [filterBuscentreId, setFilterBuscentreId] = useState(""); // mc + branch scope
  const [cellId,            setCellId]            = useState(""); // buscentre + mc + branch scope — "" = cumulative
  const [useMedian, setUseMedian] = useState(true);
  const [data,      setData]      = useState<AnalysisData | null>(null);
  const [allBreakdown, setAllBreakdown] = useState<BreakdownRow[]>([]);
  const [loading,   setLoading]   = useState(true);

  const maxMonth = year === now.getFullYear() ? now.getMonth() + 1 : 12;
  const noFiltersActive = !cellId && !filterBuscentreId && !filterMcId;

  // Fetches inside the effect (not a separate useCallback) so its cleanup can guard
  // against out-of-order responses: switching filters quickly (e.g. clicking through
  // months before landing on "Full Year") can otherwise let an older, slower request
  // resolve after a newer one and silently overwrite the display with stale data.
  useEffect(() => {
    if (!ready) return;
    let ignore = false;
    const controller = new AbortController();

    setLoading(true);
    const params = new URLSearchParams({ year: String(year) });
    if (month !== null)     params.set("month", String(month));
    if (actingCellId)       params.set("actingCellId", actingCellId);
    if (actingBuscentreId)  params.set("actingBuscentreId", actingBuscentreId);
    if (actingMcId)         params.set("actingMcId", actingMcId);
    if (actingBranchId)     params.set("actingBranchId", actingBranchId);
    if (scope === "branch" && filterMcId)                        params.set("filterMcId", filterMcId);
    if ((scope === "mc" || scope === "branch") && filterBuscentreId) params.set("filterBuscentreId", filterBuscentreId);
    if ((scope === "buscentre" || scope === "mc" || scope === "branch") && cellId) params.set("cellId", cellId);

    fetch(`/api/analysis?${params}`, { signal: controller.signal })
      .then(async (res) => {
        if (ignore) return;
        if (res.ok) {
          const parsed: AnalysisData = await res.json();
          if (ignore) return;
          setData(parsed);
          // Capture the master option list only from a fully-unfiltered fetch, so
          // narrowing down doesn't shrink the dropdowns themselves.
          if (noFiltersActive) setAllBreakdown(parsed.breakdown ?? []);
        } else {
          setData(null);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (ignore || (err instanceof DOMException && err.name === "AbortError")) return;
        setData(null);
        setLoading(false);
      });

    return () => { ignore = true; controller.abort(); };
  }, [ready, year, month, cellId, filterBuscentreId, filterMcId, actingCellId, actingBuscentreId, actingMcId, actingBranchId, scope, noFiltersActive]);

  // Reset month if it's no longer selectable (e.g. year stepped forward past it)
  useEffect(() => {
    if (month !== null && month > maxMonth) setMonth(null);
  }, [maxMonth, month]);

  if (!data && loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {[...Array(5)].map((_, i) => <div key={i} className="rounded-xl h-24 skeleton" />)}
      </div>
    );
  }
  if (!data) {
    return (
      <p className="text-[13px] mb-6" style={{ color: "var(--brand-muted)" }}>
        Could not load summary data.
      </p>
    );
  }

  const lcValue  = useMedian ? data.summary.lcLiveMedian : data.summary.lcLiveAvg;
  const mgsValue = useMedian ? data.summary.mgsMedian    : data.summary.mgsAvg;

  const isWideScope = scope === "buscentre" || scope === "mc" || scope === "branch";
  const showCellColumn = isWideScope && !cellId;
  // Matches the API: full year is only auto-shown once narrowed to a single cell —
  // narrowing to just a buscentre or MC still isn't enough to bound the query.
  const needsNarrowerScope = isWideScope && !cellId && month === null;

  const mcOptions = scope === "branch" ? uniqueOptions(allBreakdown, "mcId", "mcName") : [];
  const buscentreOptions = (scope === "mc" || scope === "branch")
    ? uniqueOptions(
        scope === "branch" && filterMcId ? allBreakdown.filter((r) => r.mcId === filterMcId) : allBreakdown,
        "buscentreId", "buscentreName",
      )
    : [];
  const cellOptions = scope === "buscentre"
    ? allBreakdown
    : (scope === "mc" || scope === "branch")
      ? allBreakdown.filter((r) => !filterBuscentreId || r.buscentreId === filterBuscentreId)
      : [];

  return (
    <div className="mb-6">
      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Year stepper */}
        <div className="flex items-center gap-1 rounded-lg overflow-hidden"
             style={{ border: "1px solid var(--brand-border)" }}>
          <button onClick={() => setYear((y) => y - 1)}
                  className="px-3 py-2 hover:bg-[var(--brand-navy-light)] transition-colors">
            <ChevronLeft className="h-4 w-4" style={{ color: "var(--brand-muted)" }} />
          </button>
          <span className="px-3 text-[14px] font-semibold" style={{ color: "var(--brand-text)" }}>
            {year}
          </span>
          <button onClick={() => setYear((y) => y + 1)}
                  disabled={year >= now.getFullYear()}
                  className="px-3 py-2 hover:bg-[var(--brand-navy-light)] transition-colors disabled:opacity-30">
            <ChevronRight className="h-4 w-4" style={{ color: "var(--brand-muted)" }} />
          </button>
        </div>

        {/* Month pills — capped at the current month for the current year */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setMonth(null)}
            className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
            style={month === null
              ? { background: "var(--brand-navy)", color: "#fff" }
              : { background: "#fff", color: "var(--brand-muted)", border: "1px solid var(--brand-border)" }}
          >
            Full Year
          </button>
          {MONTH_NAMES.slice(0, maxMonth).map((name, i) => (
            <button
              key={name}
              onClick={() => setMonth(i + 1)}
              className="px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
              style={month === i + 1
                ? { background: "var(--brand-navy)", color: "#fff" }
                : { background: "#fff", color: "var(--brand-muted)", border: "1px solid var(--brand-border)" }}
            >
              {name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {loading && <Loader2 className="animate-spin h-4 w-4 shrink-0" style={{ color: "var(--brand-muted)" }} />}

          {/* Branch Pastor: MC → Buscentre → Cell cascade */}
          {scope === "branch" && mcOptions.length > 0 && (
            <select
              value={filterMcId}
              onChange={(e) => { setFilterMcId(e.target.value); setFilterBuscentreId(""); setCellId(""); }}
              className="h-9 px-3 text-[13px] rounded-lg"
              style={{ border: "1px solid var(--brand-border)", background: "#fff", color: "var(--brand-text)" }}
            >
              <option value="">All MCs (cumulative)</option>
              {mcOptions.map((mc) => <option key={mc.id} value={mc.id}>{mc.name}</option>)}
            </select>
          )}

          {/* MC Pastor / Branch Pastor: Buscentre toggle */}
          {(scope === "mc" || scope === "branch") && buscentreOptions.length > 0 && (
            <select
              value={filterBuscentreId}
              onChange={(e) => { setFilterBuscentreId(e.target.value); setCellId(""); }}
              className="h-9 px-3 text-[13px] rounded-lg"
              style={{ border: "1px solid var(--brand-border)", background: "#fff", color: "var(--brand-text)" }}
            >
              <option value="">All buscentres (cumulative)</option>
              {buscentreOptions.map((bc) => <option key={bc.id} value={bc.id}>{bc.name}</option>)}
            </select>
          )}

          {/* Buscentre Head / MC Pastor / Branch Pastor: Cell toggle */}
          {isWideScope && cellOptions.length > 0 && (
            <select
              value={cellId}
              onChange={(e) => setCellId(e.target.value)}
              className="h-9 px-3 text-[13px] rounded-lg"
              style={{ border: "1px solid var(--brand-border)", background: "#fff", color: "var(--brand-text)" }}
            >
              <option value="">All cells (cumulative)</option>
              {cellOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}

          {/* Median / Average toggle — drives the LC Live and MGS cards */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--brand-border)" }}>
            {(["median", "average"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setUseMedian(opt === "median")}
                className="px-3 py-1.5 text-[12px] font-medium capitalize transition-colors"
                style={{
                  background: (opt === "median") === useMedian ? "var(--brand-navy)" : "#fff",
                  color:      (opt === "median") === useMedian ? "#fff" : "var(--brand-muted)",
                  borderRight: opt === "median" ? "1px solid var(--brand-border)" : "none",
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Data — dims while refetching ── */}
      <div style={{ opacity: loading ? 0.5 : 1, transition: "opacity 0.15s", pointerEvents: loading ? "none" : "auto" }}>

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
          <KpiCard label="LC Live" value={lcValue}
            sub={`${data.summary.lcLiveServices} service${data.summary.lcLiveServices !== 1 ? "s" : ""}`}
            icon={<ClipboardList className="h-3.5 w-3.5" />} />
          <KpiCard label="MGS" value={mgsValue}
            sub={`${data.summary.mgsServices} service${data.summary.mgsServices !== 1 ? "s" : ""}`}
            icon={<ClipboardList className="h-3.5 w-3.5" />} />
          <KpiCard label="First Timers" value={data.summary.firstTimers}
            icon={<UserPlus className="h-3.5 w-3.5" />} />
          <KpiCard label="First Timers Retained" value={data.summary.retained}
            sub={data.summary.firstTimers > 0
              ? `${Math.round((data.summary.retained / data.summary.firstTimers) * 100)}% of FTs`
              : undefined}
            icon={<UserCheck className="h-3.5 w-3.5" />} />
          <KpiCard label="Souls Won" value={data.summary.soulsWon}
            icon={<Heart className="h-3.5 w-3.5" />} />
        </div>

        {/* ── Attendance breakdown table ──
             A single cell always gets the full-year breakdown — a year is only
             ~100-150 services for one cell. Anything wider (all cells, a whole
             buscentre, a whole MC) still requires a month, to keep the query bounded. */}
        {needsNarrowerScope ? (
          <div className="rounded-xl p-8 text-center" style={{ border: "1px solid var(--brand-border)" }}>
            <ClipboardList style={{ width: 28, height: 28, color: "var(--brand-muted)", margin: "0 auto 8px" }} />
            <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>
              Select a month, or a specific cell, to see the service-by-service attendance breakdown.
            </p>
          </div>
        ) : data.services.length === 0 ? (
          <div className="rounded-xl p-8 text-center" style={{ border: "1px solid var(--brand-border)" }}>
            <ClipboardList style={{ width: 28, height: 28, color: "var(--brand-muted)", margin: "0 auto 8px" }} />
            <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>
              No services recorded in {month !== null ? `${MONTH_NAMES[month - 1]} ${year}` : year}.
            </p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--brand-border)" }}>
            <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow style={{ background: "#F9FAFB", position: "sticky", top: 0, zIndex: 1 }}>
                    {showCellColumn && (
                      <TableHead className="text-[11px] font-medium uppercase tracking-[0.04em] px-4 py-2.5 whitespace-nowrap"
                                 style={{ color: "var(--brand-muted)" }}>Cell</TableHead>
                    )}
                    {[
                      "Date", "Service Type", "Cell Shepherd", "Shepherds", "Members",
                      "First Timers", "FTs Retained", "Total Attendance", "Souls Won",
                    ].map((h) => (
                      <TableHead key={h}
                        className={`text-[11px] font-medium uppercase tracking-[0.04em] px-4 py-2.5 whitespace-nowrap ${h === "Date" || h === "Service Type" ? "" : "text-right"}`}
                        style={{ color: "var(--brand-muted)" }}>
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.services.map((svc) => {
                    const dateStr = new Date(svc.date).toLocaleDateString("en-GB", {
                      weekday: "short", day: "numeric", month: "short",
                    });
                    return (
                      <TableRow key={svc.id} style={{ borderBottom: "1px solid var(--brand-border)" }}>
                        {showCellColumn && (
                          <TableCell className="px-4 py-3 text-[13px]" style={{ color: "var(--brand-text)" }}>
                            {svc.cellName ?? "—"}
                          </TableCell>
                        )}
                        <TableCell className="px-4 py-3 text-[13px] whitespace-nowrap" style={{ color: "var(--brand-text)" }}>
                          {dateStr}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <span className="rounded-pill text-[11px] font-semibold px-2.5 py-0.5 text-white whitespace-nowrap"
                                style={{ background: TYPE_COLOR[svc.type] ?? "var(--brand-navy)" }}>
                            {TYPE_LABEL[svc.type] ?? svc.type}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-[13px] text-right" style={{ color: "var(--brand-text)" }}>
                          {svc.cellShepherdPresent ?? 0}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-[13px] text-right" style={{ color: "var(--brand-text)" }}>
                          {svc.shepherdsPresent ?? 0}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-[13px] text-right" style={{ color: "var(--brand-text)" }}>
                          {svc.membersPresent ?? 0}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-[13px] text-right" style={{ color: "var(--brand-text)" }}>
                          {svc.firstTimersCount ?? 0}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-[13px] text-right"
                                   style={{ color: (svc.firstTimersRetained ?? 0) > 0 ? "#085041" : "var(--brand-text)" }}>
                          {svc.firstTimersRetained ?? 0}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-[13px] text-right font-semibold" style={{ color: "var(--brand-navy)" }}>
                          {svc.totalAttendance ?? 0}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-[13px] text-right"
                                   style={{ color: (svc.soulsWonCount ?? 0) > 0 ? "#854F0B" : "var(--brand-text)" }}>
                          {svc.soulsWonCount ?? 0}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
