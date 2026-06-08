"use client";

import { useEffect, useState } from "react";
import { Filter, Sparkles, Trophy, ArrowUpDown, CheckCircle2 } from "lucide-react";

type CellRow = {
  id:               string;
  name:             string;
  buscentreName:    string;
  mcName:           string;
  present:          number;
  total:            number;
  date:             string | null;
  metNetRevelation: boolean;
  metNet2:          boolean;
};

type OrgOption = { id: string; name: string };

type ServiceType = "LC_LIVE" | "MGS" | "SPECIAL_MEETING";
type CtaMode     = "all" | "netRevelation" | "net2";
type SortDir     = "asc" | "desc";

const SERVICE_TYPE_LABEL: Record<ServiceType, string> = {
  LC_LIVE:         "LC Live (Wed)",
  MGS:             "MGS (Sun)",
  SPECIAL_MEETING: "Special Meeting",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export type ReviewScope = {
  branchId?:    string | null;
  mcId?:        string | null;
  buscentreId?: string | null;
  cellId?:      string | null;
};

export function AttendanceReviewSection({
  role,
  scope = {},
}: {
  role?:  string;
  scope?: ReviewScope;
}) {
  const showMcFilter        = role === "chief_shepherd" || role === "admin";
  const showBuscentreFilter = showMcFilter || role === "mc_pastor";
  const showCellFilter      = showBuscentreFilter || role === "buscentre_head";

  const [mcOptions,        setMcOptions]        = useState<OrgOption[]>([]);
  const [buscentreOptions, setBuscentreOptions] = useState<OrgOption[]>([]);
  const [cellOptions,      setCellOptions]      = useState<OrgOption[]>([]);

  const [mcId,        setMcId]        = useState("");
  const [buscentreId, setBuscentreId] = useState("");
  const [cellId,      setCellId]      = useState("");

  const [serviceType, setServiceType] = useState<ServiceType>("LC_LIVE");
  const [cta,         setCta]         = useState<CtaMode>("all");
  const [sortDir,     setSortDir]     = useState<SortDir>("desc");

  const [rows,    setRows]    = useState<CellRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Top-level filter options, scoped to what this role is allowed to browse.
  useEffect(() => {
    if (showMcFilter) {
      const qs = role === "chief_shepherd" && scope.branchId ? `?branchId=${scope.branchId}` : "";
      fetch(`/api/org/mega-churches${qs}`).then((r) => r.json()).then((d) => setMcOptions(Array.isArray(d) ? d : [])).catch(() => {});
    } else if (role === "mc_pastor" && scope.mcId) {
      fetch(`/api/org/buscentres?mcId=${scope.mcId}`).then((r) => r.json()).then((d) => setBuscentreOptions(Array.isArray(d) ? d : [])).catch(() => {});
    } else if (role === "buscentre_head" && scope.buscentreId) {
      fetch(`/api/org/cells?buscentreId=${scope.buscentreId}`).then((r) => r.json()).then((d) => setCellOptions(Array.isArray(d) ? d : [])).catch(() => {});
    }
  }, [role, showMcFilter, scope.branchId, scope.mcId, scope.buscentreId]); // eslint-disable-line react-hooks/exhaustive-deps

  // MC selected → load its buscentres
  useEffect(() => {
    setBuscentreId(""); setCellId("");
    setBuscentreOptions([]); setCellOptions([]);
    if (showMcFilter && mcId) {
      fetch(`/api/org/buscentres?mcId=${mcId}`).then((r) => r.json()).then((d) => setBuscentreOptions(Array.isArray(d) ? d : [])).catch(() => {});
    }
  }, [mcId, showMcFilter]);

  // Buscentre selected → load its cells
  useEffect(() => {
    setCellId("");
    setCellOptions([]);
    if (showBuscentreFilter && buscentreId) {
      fetch(`/api/org/cells?buscentreId=${buscentreId}`).then((r) => r.json()).then((d) => setCellOptions(Array.isArray(d) ? d : [])).catch(() => {});
    } else if (role === "buscentre_head" && scope.buscentreId) {
      fetch(`/api/org/cells?buscentreId=${scope.buscentreId}`).then((r) => r.json()).then((d) => setCellOptions(Array.isArray(d) ? d : [])).catch(() => {});
    }
  }, [buscentreId, showBuscentreFilter, role, scope.buscentreId]);

  // Fetch the review data whenever filters or service type change
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ serviceType });
    if (cellId)           params.set("cellId", cellId);
    else if (buscentreId) params.set("buscentreId", buscentreId);
    else if (mcId)        params.set("mcId", mcId);

    fetch(`/api/attendance/review?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => { setRows(Array.isArray(d.cells) ? d.cells : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [serviceType, mcId, buscentreId, cellId]);

  function selectCta(mode: CtaMode) {
    setCta(mode);
    if (mode === "net2") setServiceType("SPECIAL_MEETING");
  }

  const filtered = cta === "netRevelation" ? rows.filter((r) => r.metNetRevelation)
                 : cta === "net2"          ? rows.filter((r) => r.metNet2)
                 : rows;
  const sorted = [...filtered].sort((a, b) => sortDir === "asc" ? a.present - b.present : b.present - a.present);

  return (
    <div className="mb-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Filter style={{ width: 15, height: 15, color: "var(--brand-muted)" }} />
        <span className="text-[11px] font-medium uppercase tracking-[0.06em]" style={{ color: "var(--brand-muted)" }}>
          Review Cells
        </span>
      </div>
      <div className="mb-3 h-px" style={{ background: "var(--brand-border)" }} />

      {/* Cascading filters */}
      {(showMcFilter || showBuscentreFilter || showCellFilter) && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {showMcFilter && (
            <select value={mcId} onChange={(e) => setMcId(e.target.value)}
                    className="h-9 px-3 rounded-lg text-[13px]" style={{ border: "1px solid var(--brand-border)", color: "var(--brand-text)" }}>
              <option value="">All mega churches</option>
              {mcOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
          {showBuscentreFilter && (
            <select value={buscentreId} onChange={(e) => setBuscentreId(e.target.value)}
                    disabled={showMcFilter && !mcId && mcOptions.length > 0 && buscentreOptions.length === 0}
                    className="h-9 px-3 rounded-lg text-[13px] disabled:opacity-50" style={{ border: "1px solid var(--brand-border)", color: "var(--brand-text)" }}>
              <option value="">All buscentres</option>
              {buscentreOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
          {showCellFilter && (
            <select value={cellId} onChange={(e) => setCellId(e.target.value)}
                    className="h-9 px-3 rounded-lg text-[13px]" style={{ border: "1px solid var(--brand-border)", color: "var(--brand-text)" }}>
              <option value="">All cells</option>
              {cellOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}

          <select value={serviceType} onChange={(e) => setServiceType(e.target.value as ServiceType)}
                  className="h-9 px-3 rounded-lg text-[13px] ml-auto" style={{ border: "1px solid var(--brand-border)", color: "var(--brand-text)" }}>
            {(Object.keys(SERVICE_TYPE_LABEL) as ServiceType[]).map((t) => (
              <option key={t} value={t}>{SERVICE_TYPE_LABEL[t]}</option>
            ))}
          </select>
        </div>
      )}

      {/* CTAs + sort */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button onClick={() => selectCta("all")}
                className="h-9 px-3 rounded-lg text-[12px] font-medium transition-colors"
                style={{ background: cta === "all" ? "var(--brand-navy)" : "#fff", color: cta === "all" ? "#fff" : "var(--brand-muted)", border: "1px solid var(--brand-border)" }}>
          All cells
        </button>
        <button onClick={() => selectCta("netRevelation")}
                className="h-9 px-3 rounded-lg text-[12px] font-medium transition-colors flex items-center gap-1.5"
                style={{ background: cta === "netRevelation" ? "var(--brand-success)" : "#fff", color: cta === "netRevelation" ? "#fff" : "var(--brand-success)", border: "1px solid var(--brand-success)" }}>
          <Sparkles className="h-3.5 w-3.5" /> Net Revelation (≥13)
        </button>
        <button onClick={() => selectCta("net2")}
                className="h-9 px-3 rounded-lg text-[12px] font-medium transition-colors flex items-center gap-1.5"
                style={{ background: cta === "net2" ? "var(--brand-navy)" : "#fff", color: cta === "net2" ? "#fff" : "var(--brand-navy)", border: "1px solid var(--brand-navy)" }}>
          <Trophy className="h-3.5 w-3.5" /> Net2 (≥26)
        </button>

        <button onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                className="h-9 px-3 rounded-lg text-[12px] font-medium transition-colors flex items-center gap-1.5 ml-auto"
                style={{ border: "1px solid var(--brand-border)", color: "var(--brand-text)" }}>
          <ArrowUpDown className="h-3.5 w-3.5" />
          Present {sortDir === "asc" ? "↑" : "↓"}
        </button>
      </div>

      {/* Results table */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--brand-border)" }}>
        <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--brand-border)", background: "#FAFAFA" }}>
          <span className="text-[11px] font-semibold uppercase tracking-[0.05em]" style={{ color: "var(--brand-muted)" }}>
            {SERVICE_TYPE_LABEL[serviceType]} · {sorted.length} cell{sorted.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col gap-px p-3">
            {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-[13px] text-center py-6" style={{ color: "var(--brand-muted)" }}>
            Nothing matches these filters yet.
          </p>
        ) : (
          <div className="flex flex-col">
            {sorted.map((row, i) => (
              <div key={row.id} className="flex items-center gap-3 px-4 py-2.5"
                   style={{ borderTop: i === 0 ? "none" : "1px solid var(--brand-border)" }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium" style={{ color: "var(--brand-text)" }}>
                      {row.name}
                    </span>
                    {row.metNetRevelation && (
                      <span className="rounded-pill text-[10px] font-semibold px-1.5 py-0.5 shrink-0"
                            style={{ background: "var(--brand-success)", color: "#fff" }}>
                        Net Revelation
                      </span>
                    )}
                    {row.metNet2 && (
                      <span className="rounded-pill text-[10px] font-semibold px-1.5 py-0.5 shrink-0"
                            style={{ background: "var(--brand-navy)", color: "#fff" }}>
                        Net2
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[12px] mt-0.5" style={{ color: "var(--brand-muted)" }}>
                    {row.buscentreName} · {row.mcName}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0 tabular-nums">
                  <span className="flex items-center gap-1 text-[13px] font-semibold" style={{ color: "var(--brand-text)" }}>
                    <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "var(--brand-success)" }} />
                    {row.present} <span className="font-normal text-[12px]" style={{ color: "var(--brand-muted)" }}>/ {row.total}</span>
                  </span>
                  <span className="text-[11px]" style={{ color: "var(--brand-muted)" }}>
                    {formatDate(row.date)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
