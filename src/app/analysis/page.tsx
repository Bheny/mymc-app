"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from "recharts";
import {
  ChevronLeft, ChevronRight, Users, Heart,
  UserPlus, UserCheck, ClipboardList, BarChart2, Loader2, FileText,
} from "lucide-react";
import { useActiveRole } from "@/hooks/use-active-role";
import { GenerateReportModal } from "@/components/generate-report-modal";

// ─── Types ────────────────────────────────────────────────────────────────────

type MonthData = {
  month: number; label: string;
  lcLiveAvg: number; lcLiveServices: number;
  mgsAvg: number;    mgsServices: number;
  firstTimers: number; retained: number; soulsWon: number;
};

type ShepherdBreakdown = {
  id: string; name: string; memberCount: number;
  lcLiveAvg: number; mgsAvg: number;
};

type CellBreakdown = {
  id: string; name: string; cellShepherd: string | null; memberCount: number;
  lcLiveAvg: number; mgsAvg: number;
  firstTimers: number; retained: number; soulsWon: number;
  buscentreName?: string; // MC/admin scope — which buscentre this cell belongs to
  buscentreId?:  string;
};

type Summary = {
  lcLiveAvg: number; lcLiveServices: number;
  mgsAvg: number;    mgsServices: number;
  firstTimers: number; retained: number; soulsWon: number;
  activeMembers: number;
};

type ServiceEntry = {
  id:           string;
  type:         string;
  date:         string;
  mode:         string;
  speaker:      string | null;
  notes:        string | null;
  cellName?:    string;
  presentCount: number;
  totalMarked:  number;
};

type AnalysisData = {
  scope:     { type: "cell" | "buscentre" | "mc" | "admin"; name: string; id: string };
  period:    { year: number; month: number | null };
  summary:   Summary;
  monthly:   MonthData[];
  breakdown: ShepherdBreakdown[] | CellBreakdown[];
  services:  ServiceEntry[];
};

type Option = { id: string; name: string };

const TYPE_LABEL: Record<string, string> = {
  LC_LIVE:           "LC Live",
  MGS:               "MGS",
  SHEPHERDS_MEETING: "Shepherds Mtg",
  SPECIAL_MEETING:   "Special Meeting",
};
const TYPE_COLOR: Record<string, string> = {
  LC_LIVE:           "var(--brand-navy)",
  MGS:               "#1A8C6C",
  SHEPHERDS_MEETING: "#7C3AED",
  SPECIAL_MEETING:   "#B45309",
};

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon, highlight = false,
}: {
  label:      string;
  value:      string | number;
  sub?:       string;
  icon:       React.ReactNode;
  highlight?: boolean;
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
      <span className="text-[32px] font-bold leading-none"
            style={{ color: highlight ? "var(--brand-navy)" : "var(--brand-text)" }}>
        {value}
      </span>
      {sub && (
        <span className="text-[12px] mt-1" style={{ color: "var(--brand-muted)" }}>{sub}</span>
      )}
    </div>
  );
}

// ─── Custom tooltips ──────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-4 py-3 text-[13px] shadow-lg"
         style={{ background: "#fff", border: "1px solid var(--brand-border)" }}>
      <p className="font-semibold mb-2" style={{ color: "var(--brand-text)" }}>{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: p.color }} />
          <span style={{ color: "var(--brand-muted)" }}>{p.name}:</span>
          <span className="font-medium ml-auto pl-4" style={{ color: "var(--brand-text)" }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function ServiceTooltip({ active, payload, label }: {
  active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  const present = payload.find((p) => p.dataKey === "present")?.value ?? 0;
  const absent  = payload.find((p) => p.dataKey === "absent")?.value  ?? 0;
  const total   = present + absent;
  const rate    = total > 0 ? Math.round((present / total) * 100) : 0;
  return (
    <div className="rounded-xl px-4 py-3 text-[13px] shadow-lg"
         style={{ background: "#fff", border: "1px solid var(--brand-border)" }}>
      <p className="font-semibold mb-2" style={{ color: "var(--brand-text)" }}>{label}</p>
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: "var(--brand-success)" }} />
        <span style={{ color: "var(--brand-muted)" }}>Present:</span>
        <span className="font-medium ml-auto pl-4" style={{ color: "var(--brand-text)" }}>{present}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: "#E5E7EB" }} />
        <span style={{ color: "var(--brand-muted)" }}>Absent:</span>
        <span className="font-medium ml-auto pl-4" style={{ color: "var(--brand-text)" }}>{absent}</span>
      </div>
      <div className="mt-1.5 pt-1.5" style={{ borderTop: "1px solid var(--brand-border)" }}>
        <span className="font-semibold" style={{ color: rate >= 75 ? "var(--brand-success)" : rate >= 50 ? "#854F0B" : "var(--brand-danger)" }}>
          {rate}% attendance
        </span>
      </div>
    </div>
  );
}


// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1200px] mx-auto pb-20 lg:pb-8">
      <div className="skeleton h-8 w-48 rounded mb-2" />
      <div className="skeleton h-4 w-64 rounded mb-6" />
      <div className="flex gap-2 mb-6">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-9 w-16 rounded-lg" />)}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
      </div>
      <div className="skeleton h-72 rounded-xl mb-6" />
      <div className="skeleton h-48 rounded-xl" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const { activeView, ready } = useActiveRole();
  const actingCellId      = activeView?.isActing && activeView.cellId      ? activeView.cellId      : null;
  const actingBuscentreId = activeView?.isActing && activeView.buscentreId ? activeView.buscentreId : null;

  const [reportModalOpen, setReportModalOpen] = useState(false);

  const [year,    setYear]    = useState(new Date().getFullYear());
  const [month,   setMonth]   = useState<number | null>(null);
  const [data,    setData]    = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);

  // Hierarchical filter state — populated based on active role
  const [filterMcId,        setFilterMcId]        = useState("");
  const [filterBuscentreId, setFilterBuscentreId] = useState("");
  const [filterId,          setFilterId]          = useState(""); // cell (buscentre scope) or shepherd (cell scope)

  // Option lists for the filter dropdowns
  const [mcOptions,        setMcOptions]        = useState<Option[]>([]);
  const [buscentreOptions, setBuscentreOptions] = useState<Option[]>([]);
  // Cache the final-level breakdown options (cells for buscentre/mc, shepherds for cell)
  const [dropdownOptions, setDropdownOptions] = useState<(ShepherdBreakdown | CellBreakdown)[]>([]);

  const activeRole = activeView?.role ?? null;

  const load = useCallback(async () => {
    if (!ready) return; // wait for acting-roles before fetching scoped data
    setLoading(true);
    const params = new URLSearchParams({ year: String(year) });
    if (month !== null)    params.set("month",            String(month));
    if (actingCellId)      params.set("actingCellId",     actingCellId);
    if (actingBuscentreId) params.set("actingBuscentreId", actingBuscentreId);

    // Role-aware filter params
    if (activeRole === "admin" || activeRole === "chief_shepherd") {
      if (filterMcId)        params.set("filterMcId",        filterMcId);
      if (filterBuscentreId) params.set("filterBuscentreId", filterBuscentreId);
      if (filterId)          params.set("cellId",            filterId);
    } else if (activeRole === "mc_pastor") {
      if (filterBuscentreId) params.set("filterBuscentreId", filterBuscentreId);
      if (filterId)          params.set("cellId",            filterId);
    } else if (activeRole === "buscentre_head") {
      if (filterId) {
        params.set("shepherdId", filterId);
        params.set("cellId",     filterId);
      }
    }
    // cell_shepherd / shepherd: no filter params — API locks to their cell

    const res = await fetch(`/api/analysis?${params}`);
    if (res.ok) {
      const parsed: AnalysisData = await res.json();
      setData(parsed);
      // Refresh bottom-level dropdown options when no final filter is active
      if (!filterId) {
        setDropdownOptions(parsed.breakdown as (ShepherdBreakdown | CellBreakdown)[]);
      }
    } else {
      setData(null);
    }
    setLoading(false);
  }, [ready, year, month, filterId, filterMcId, filterBuscentreId, actingCellId, actingBuscentreId, activeRole]);

  useEffect(() => { load(); }, [load]);

  // Reset all filters when the active role changes
  useEffect(() => {
    setFilterMcId("");
    setFilterBuscentreId("");
    setFilterId("");
    setMcOptions([]);
    setBuscentreOptions([]);
    setDropdownOptions([]);
  }, [activeRole]);

  // Fetch MC list for admin / chief_shepherd
  useEffect(() => {
    if (activeRole !== "admin" && activeRole !== "chief_shepherd") return;
    fetch("/api/org/mega-churches")
      .then((r) => r.json())
      .then(setMcOptions)
      .catch(() => {});
  }, [activeRole]);

  // Fetch buscentre list when MC is known
  useEffect(() => {
    const mcIdForFetch =
      activeRole === "mc_pastor"
        ? (activeView?.mcId ?? null)
        : (activeRole === "admin" || activeRole === "chief_shepherd")
        ? filterMcId || null
        : null;

    if (!mcIdForFetch) { setBuscentreOptions([]); return; }
    fetch(`/api/org/buscentres?mcId=${mcIdForFetch}`)
      .then((r) => r.json())
      .then(setBuscentreOptions)
      .catch(() => {});
  }, [activeRole, filterMcId, activeView?.mcId]);

  if (loading && !data) return <Skeleton />;
  if (!data) return (
    <div className="px-4 py-12 text-center">
      <BarChart2 style={{ width: 40, height: 40, color: "var(--brand-muted)", margin: "0 auto 12px" }} />
      <p className="text-[14px]" style={{ color: "var(--brand-muted)" }}>
        No analysis data available. Make sure your account is scoped to a cell or buscentre.
      </p>
    </div>
  );

  const { scope, summary, monthly, breakdown } = data;
  const isCellScope = scope.type === "cell";

  // Period label
  const periodLabel = month !== null
    ? `${MONTH_NAMES[month - 1]} ${year}`
    : `${year}`;

  // Highlight the selected month's bar in the chart
  const chartData = monthly.map((m) => ({
    ...m,
    _active: month === null || m.month === month,
  }));

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1200px] mx-auto pb-20 lg:pb-8">

      {/* ── Header ── */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 className="h-5 w-5" style={{ color: "var(--brand-navy)" }} />
            <h1 className="text-[24px] font-semibold" style={{ color: "var(--brand-text)" }}>
              Analysis
            </h1>
          </div>
          <p className="text-[14px]" style={{ color: "var(--brand-muted)" }}>
            {scope.name} · {periodLabel}
          </p>
        </div>
        <button
          onClick={() => setReportModalOpen(true)}
          className="flex items-center gap-2 h-9 px-4 rounded-lg text-[13px] font-medium shrink-0 transition-colors hover:opacity-90"
          style={{ background: "var(--brand-navy)", color: "#fff" }}
        >
          <FileText className="h-4 w-4" /> Generate Report
        </button>
      </div>

      {/* ── Report modal ── */}
      {reportModalOpen && <GenerateReportModal onClose={() => setReportModalOpen(false)} />}

      {/* ── Period controls ── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
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
                  className="px-3 py-2 hover:bg-[var(--brand-navy-light)] transition-colors"
                  disabled={year >= new Date().getFullYear()}>
            <ChevronRight className="h-4 w-4" style={{ color: "var(--brand-muted)" }} />
          </button>
        </div>

        {/* Month pills */}
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
          {MONTH_NAMES.map((name, i) => (
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

        {/* ── Scope filters (role-aware) + loading spinner ── */}
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {loading && (
            <Loader2 className="animate-spin h-4 w-4 shrink-0" style={{ color: "var(--brand-muted)" }} />
          )}

          {/* Admin / Chief Shepherd: MC → Buscentre → Cell */}
          {(activeRole === "admin" || activeRole === "chief_shepherd") && (
            <>
              <select
                value={filterMcId}
                onChange={(e) => { setFilterMcId(e.target.value); setFilterBuscentreId(""); setFilterId(""); setBuscentreOptions([]); setDropdownOptions([]); }}
                className="h-9 px-3 text-[13px] rounded-lg"
                style={{ border: "1px solid var(--brand-border)", background: "#fff", color: "var(--brand-text)" }}
              >
                <option value="">— Select MC —</option>
                {mcOptions.map((mc) => <option key={mc.id} value={mc.id}>{mc.name}</option>)}
              </select>
              {filterMcId && (
                <select
                  value={filterBuscentreId}
                  onChange={(e) => { setFilterBuscentreId(e.target.value); setFilterId(""); setDropdownOptions([]); }}
                  className="h-9 px-3 text-[13px] rounded-lg"
                  style={{ border: "1px solid var(--brand-border)", background: "#fff", color: "var(--brand-text)" }}
                >
                  <option value="">All buscentres</option>
                  {buscentreOptions.map((bc) => <option key={bc.id} value={bc.id}>{bc.name}</option>)}
                </select>
              )}
              {filterBuscentreId && (dropdownOptions.length > 1 || !!filterId) && (
                <select
                  value={filterId}
                  onChange={(e) => setFilterId(e.target.value)}
                  className="h-9 px-3 text-[13px] rounded-lg"
                  style={{ border: "1px solid var(--brand-border)", background: "#fff", color: "var(--brand-text)" }}
                >
                  <option value="">All cells</option>
                  {dropdownOptions.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              )}
            </>
          )}

          {/* MC Pastor: Buscentre → Cell */}
          {activeRole === "mc_pastor" && (
            <>
              <select
                value={filterBuscentreId}
                onChange={(e) => { setFilterBuscentreId(e.target.value); setFilterId(""); setDropdownOptions([]); }}
                className="h-9 px-3 text-[13px] rounded-lg"
                style={{ border: "1px solid var(--brand-border)", background: "#fff", color: "var(--brand-text)" }}
              >
                <option value="">All buscentres</option>
                {buscentreOptions.map((bc) => <option key={bc.id} value={bc.id}>{bc.name}</option>)}
              </select>
              {filterBuscentreId && (dropdownOptions.length > 1 || !!filterId) && (
                <select
                  value={filterId}
                  onChange={(e) => setFilterId(e.target.value)}
                  className="h-9 px-3 text-[13px] rounded-lg"
                  style={{ border: "1px solid var(--brand-border)", background: "#fff", color: "var(--brand-text)" }}
                >
                  <option value="">All cells</option>
                  {dropdownOptions.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              )}
            </>
          )}

          {/* Buscentre Head: Cell filter */}
          {activeRole === "buscentre_head" && (dropdownOptions.length > 1 || !!filterId) && (
            <select
              value={filterId}
              onChange={(e) => setFilterId(e.target.value)}
              className="h-9 px-3 text-[13px] rounded-lg"
              style={{ border: "1px solid var(--brand-border)", background: "#fff", color: "var(--brand-text)" }}
            >
              <option value="">All cells</option>
              {dropdownOptions.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}

          {/* Cell shepherd: no filter (locked to their cell) */}
        </div>
      </div>

      {/* ── Data section — dims while refetching ── */}
      <div style={{ opacity: loading ? 0.5 : 1, transition: "opacity 0.15s", pointerEvents: loading ? "none" : "auto" }}>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard
          label="LC Live Avg"
          value={summary.lcLiveAvg}
          sub={`${summary.lcLiveServices} service${summary.lcLiveServices !== 1 ? "s" : ""}`}
          icon={<ClipboardList className="h-3.5 w-3.5" />}
          highlight
        />
        <KpiCard
          label="MGS Avg"
          value={summary.mgsAvg}
          sub={`${summary.mgsServices} service${summary.mgsServices !== 1 ? "s" : ""}`}
          icon={<ClipboardList className="h-3.5 w-3.5" />}
          highlight
        />
        <KpiCard
          label="First Timers"
          value={summary.firstTimers}
          icon={<UserPlus className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Retained"
          value={summary.retained}
          sub={summary.firstTimers > 0
            ? `${Math.round((summary.retained / summary.firstTimers) * 100)}% of FTs`
            : undefined}
          icon={<UserCheck className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Souls Won"
          value={summary.soulsWon}
          icon={<Heart className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label={isCellScope ? "Active Members" : "Total Members"}
          value={summary.activeMembers}
          icon={<Users className="h-3.5 w-3.5" />}
        />
      </div>

      {/* ── Chart ── */}
      <div className="rounded-xl p-5 mb-6" style={{ border: "1px solid var(--brand-border)", background: "#fff" }}>
        <p className="text-[13px] font-semibold mb-4" style={{ color: "var(--brand-text)" }}>
          {month === null
            ? `Monthly Trend — ${year}`
            : `Services — ${MONTH_NAMES[month - 1]} ${year}`}
        </p>

        {month === null ? (
          /* ── Full-year monthly averages ── */
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} barCategoryGap="30%" barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--brand-border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--brand-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--brand-muted)" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="square" iconSize={10}
                formatter={(val) => <span style={{ fontSize: 12, color: "var(--brand-muted)" }}>{val}</span>} />
              <Bar dataKey="lcLiveAvg" name="LC Live Avg" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry._active ? "var(--brand-navy)" : "rgba(0,43,91,0.25)"} />
                ))}
              </Bar>
              <Bar dataKey="mgsAvg" name="MGS Avg" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry._active ? "#1A8C6C" : "rgba(26,140,108,0.25)"} />
                ))}
              </Bar>
              <Bar dataKey="soulsWon" name="Souls Won" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry._active ? "#F5A623" : "rgba(245,166,35,0.25)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : data.services.length === 0 ? (
          /* ── Empty state for selected month ── */
          <div className="h-[260px] flex flex-col items-center justify-center gap-2">
            <ClipboardList className="h-8 w-8" style={{ color: "var(--brand-border)" }} />
            <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>
              No services recorded in {MONTH_NAMES[month - 1]} {year}
            </p>
          </div>
        ) : (
          /* ── Per-service bars for selected month ── */
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={data.services.map((svc) => ({
                label:   new Date(svc.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
                present: svc.presentCount,
                absent:  svc.totalMarked - svc.presentCount,
                type:    svc.type,
              }))}
              barCategoryGap="35%" barSize={32}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--brand-border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--brand-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--brand-muted)" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<ServiceTooltip />} />
              <Legend iconType="square" iconSize={10}
                formatter={(val) => <span style={{ fontSize: 12, color: "var(--brand-muted)" }}>{val}</span>} />
              {/* Present — coloured by service type */}
              <Bar dataKey="present" name="Present" stackId="a" radius={[0, 0, 0, 0]}>
                {data.services.map((svc, i) => (
                  <Cell key={i} fill={TYPE_COLOR[svc.type] ?? "var(--brand-navy)"} />
                ))}
              </Bar>
              {/* Absent — light grey on top */}
              <Bar dataKey="absent" name="Absent" stackId="a" radius={[3, 3, 0, 0]} fill="#E5E7EB" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Per-service list — shown when a specific month is selected ── */}
      {month !== null && (
        <div className="rounded-xl overflow-hidden mb-6" style={{ border: "1px solid var(--brand-border)" }}>
          {/* Header */}
          <div className="px-5 py-3 flex items-center gap-2"
               style={{ background: "var(--brand-navy)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <ClipboardList className="h-4 w-4 text-white opacity-70" />
            <span className="text-[13px] font-semibold text-white">
              Services in {MONTH_NAMES[month - 1]} {year}
            </span>
            <span className="ml-auto text-[12px]" style={{ color: "rgba(255,255,255,0.6)" }}>
              {data.services.length} service{data.services.length !== 1 ? "s" : ""}
            </span>
          </div>

          {data.services.length === 0 ? (
            <div className="px-5 py-10 flex flex-col items-center gap-2 text-center">
              <ClipboardList className="h-8 w-8" style={{ color: "var(--brand-muted)" }} />
              <p className="text-[14px]" style={{ color: "var(--brand-muted)" }}>
                No services recorded in {MONTH_NAMES[month - 1]} {year}.
              </p>
            </div>
          ) : (
            data.services.map((svc, i) => {
              const rate     = svc.totalMarked > 0 ? Math.round((svc.presentCount / svc.totalMarked) * 100) : 0;
              const absent   = svc.totalMarked - svc.presentCount;
              const color    = TYPE_COLOR[svc.type] ?? "var(--brand-navy)";
              const rateColor = rate >= 75 ? "var(--brand-success)" : rate >= 50 ? "#854F0B" : "var(--brand-danger)";
              const dateStr  = new Date(svc.date).toLocaleDateString("en-GB", {
                weekday: "short", day: "numeric", month: "short",
              });

              return (
                <div
                  key={svc.id}
                  className="px-5 py-4 flex flex-col gap-2"
                  style={{ borderBottom: i < data.services.length - 1 ? "1px solid var(--brand-border)" : "none" }}
                >
                  {/* Top row: type badge + date + cell name (buscentre scope) */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="rounded-pill text-[11px] font-semibold px-2.5 py-0.5 text-white shrink-0"
                          style={{ background: color }}>
                      {TYPE_LABEL[svc.type] ?? svc.type}
                    </span>
                    <span className="text-[14px] font-medium" style={{ color: "var(--brand-text)" }}>
                      {dateStr}
                    </span>
                    {svc.cellName && (
                      <span className="text-[12px] rounded-pill px-2 py-0.5"
                            style={{ background: "var(--brand-navy-light)", color: "var(--brand-navy)" }}>
                        {svc.cellName}
                      </span>
                    )}
                    {svc.mode === "ONLINE" && (
                      <span className="text-[11px] font-medium rounded-pill px-2 py-0.5"
                            style={{ background: "#FEF3DC", color: "#854F0B" }}>Online</span>
                    )}
                    {svc.speaker && (
                      <span className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
                        · {svc.speaker}
                      </span>
                    )}
                    {svc.notes && (
                      <span className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
                        · {svc.notes}
                      </span>
                    )}
                  </div>

                  {/* Bottom row: progress bar + counts */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 rounded-pill overflow-hidden" style={{ height: 6, background: "var(--brand-border)" }}>
                      <div className="h-full rounded-pill transition-all"
                           style={{ width: `${svc.totalMarked > 0 ? rate : 0}%`, background: color }} />
                    </div>
                    <span className="text-[13px] font-semibold tabular-nums shrink-0"
                          style={{ color: rateColor, minWidth: 40, textAlign: "right" }}>
                      {rate}%
                    </span>
                    <span className="text-[12px] tabular-nums shrink-0" style={{ color: "var(--brand-muted)", minWidth: 80 }}>
                      {svc.presentCount} present · {absent} absent
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Breakdown table ── */}
      {/* ── Admin: prompt to select an MC ── */}
      {(scope.type === "admin" || scope.type === "mc") && !filterMcId && activeRole !== "mc_pastor" && (
        <div className="rounded-xl p-10 text-center" style={{ border: "1px solid var(--brand-border)" }}>
          <BarChart2 style={{ width: 36, height: 36, color: "var(--brand-muted)", margin: "0 auto 10px" }} />
          <p className="text-[14px]" style={{ color: "var(--brand-muted)" }}>
            Select a MegaChurch above to view analysis data.
          </p>
        </div>
      )}

      {breakdown.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--brand-border)" }}>
          {/* Table title */}
          <div className="px-5 py-3 flex items-center gap-2"
               style={{ background: "var(--brand-navy)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <span className="text-[13px] font-semibold text-white">
              {isCellScope ? "Shepherd Breakdown" : "Cell Breakdown"}
            </span>
            <span className="text-[12px] ml-auto" style={{ color: "rgba(255,255,255,0.6)" }}>
              {periodLabel}
            </span>
          </div>

          <table className="w-full border-collapse">
            <thead>
              <tr style={{ background: "#F9FAFB", borderBottom: "1px solid var(--brand-border)" }}>
                {/* Buscentre column — only when viewing MC scope without a buscentre filter */}
                {!isCellScope && (scope.type === "mc") && !filterBuscentreId && (
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-[0.06em] hidden sm:table-cell"
                      style={{ color: "var(--brand-muted)" }}>
                    Buscentre
                  </th>
                )}
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-[0.06em]"
                    style={{ color: "var(--brand-muted)" }}>
                  {isCellScope ? "Shepherd" : "Cell"}
                </th>
                {!isCellScope && (
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-[0.06em] hidden sm:table-cell"
                      style={{ color: "var(--brand-muted)" }}>
                    Cell Shepherd
                  </th>
                )}
                <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-[0.06em]"
                    style={{ color: "var(--brand-muted)" }}>Members</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-[0.06em]"
                    style={{ color: "var(--brand-muted)" }}>LC Live</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-[0.06em]"
                    style={{ color: "var(--brand-muted)" }}>MGS</th>
                {!isCellScope && (
                  <>
                    <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-[0.06em] hidden md:table-cell"
                        style={{ color: "var(--brand-muted)" }}>1st Timers</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-[0.06em] hidden md:table-cell"
                        style={{ color: "var(--brand-muted)" }}>Retained</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-[0.06em] hidden lg:table-cell"
                        style={{ color: "var(--brand-muted)" }}>Souls</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {isCellScope
                ? (breakdown as ShepherdBreakdown[]).map((row, i) => (
                    <tr key={row.id}
                        style={{ borderBottom: i < breakdown.length - 1 ? "1px solid var(--brand-border)" : "none",
                                 background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex items-center justify-center rounded-lg shrink-0 text-[10px] font-bold"
                               style={{ width: 28, height: 28, background: "var(--brand-navy)", color: "#fff" }}>
                            {row.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-[14px] font-medium" style={{ color: "var(--brand-text)" }}>
                            {row.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[13px] font-medium rounded-pill px-2 py-0.5"
                              style={{ background: "var(--brand-navy-light)", color: "var(--brand-navy)" }}>
                          {row.memberCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[14px] font-semibold"
                              style={{ color: row.lcLiveAvg > 0 ? "#085041" : "var(--brand-muted)" }}>
                          {row.lcLiveAvg || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[14px] font-semibold"
                              style={{ color: row.mgsAvg > 0 ? "#085041" : "var(--brand-muted)" }}>
                          {row.mgsAvg || "—"}
                        </span>
                      </td>
                    </tr>
                  ))
                : (breakdown as CellBreakdown[]).map((row, i) => (
                    <tr key={row.id}
                        style={{ borderBottom: i < breakdown.length - 1 ? "1px solid var(--brand-border)" : "none",
                                 background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                      {/* Buscentre cell — MC scope only */}
                      {scope.type === "mc" && !filterBuscentreId && (
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-[12px] font-medium rounded-pill px-2 py-0.5"
                                style={{ background: "var(--brand-navy-light)", color: "var(--brand-navy)" }}>
                            {(row as CellBreakdown).buscentreName ?? "—"}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <span className="text-[14px] font-medium" style={{ color: "var(--brand-text)" }}>
                          {row.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-[13px]" style={{ color: "var(--brand-muted)" }}>
                          {row.cellShepherd ?? <em>Unassigned</em>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[13px] font-medium rounded-pill px-2 py-0.5"
                              style={{ background: "var(--brand-navy-light)", color: "var(--brand-navy)" }}>
                          {row.memberCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[14px] font-semibold"
                              style={{ color: row.lcLiveAvg > 0 ? "#085041" : "var(--brand-muted)" }}>
                          {row.lcLiveAvg || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[14px] font-semibold"
                              style={{ color: row.mgsAvg > 0 ? "#085041" : "var(--brand-muted)" }}>
                          {row.mgsAvg || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        <span className="text-[13px]" style={{ color: "var(--brand-text)" }}>
                          {row.firstTimers || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        <span className="text-[13px]"
                              style={{ color: row.retained > 0 ? "#085041" : "var(--brand-text)" }}>
                          {row.retained || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell">
                        <span className="text-[13px]"
                              style={{ color: row.soulsWon > 0 ? "#854F0B" : "var(--brand-text)" }}>
                          {row.soulsWon || "—"}
                        </span>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      )}

      </div>{/* end dimming wrapper */}
    </div>
  );
}
