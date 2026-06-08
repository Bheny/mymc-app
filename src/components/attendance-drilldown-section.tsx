"use client";

import { useEffect, useState } from "react";
import { ClipboardList, CheckCircle2, XCircle, List, PieChart as PieChartIcon } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell as PieSlice, Tooltip, Legend } from "recharts";

const SUCCESS = "#1A8C6C";
const DANGER  = "#C0392B";

const PIE_COLORS = [
  "#1A8C6C", "#0F1F3D", "#B87015", "#7C3AED",
  "#2563EB", "#C0392B", "#0E9594", "#D97706",
  "#9333EA", "#16A34A",
];

type Snapshot = {
  date:    string;
  present: number;
  absent:  number;
  excused: number;
  total:   number;
  rate:    number;
  firstTimers: number;
} | null;

type LevelRow = { id: string; name: string; lcLive: Snapshot; mgs: Snapshot };
type Level    = { key: string; label: string; rows: LevelRow[] };

type DrilldownData = {
  scopeName: string;
  total:     { lcLive: Snapshot; mgs: Snapshot };
  levels:    Level[];
};

type ViewMode = "figures" | "charts";
type SnapKey  = "lcLive" | "mgs";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Totals ───────────────────────────────────────────────────────────────────

function TotalCard({ label, snapshot }: { label: string; snapshot: Snapshot }) {
  return (
    <div className="rounded-xl px-5 py-4 flex flex-col gap-1"
         style={{ border: "1px solid var(--brand-border)", background: "#fff" }}>
      <p className="text-[11px] font-medium uppercase tracking-[0.06em]" style={{ color: "var(--brand-muted)" }}>
        {label}
      </p>

      {snapshot ? (
        <>
          <div className="flex items-end gap-2 mt-1">
            <span className="text-[32px] font-bold leading-none" style={{ color: "var(--brand-text)" }}>
              {snapshot.present}
            </span>
            <span className="text-[13px] font-medium mb-0.5" style={{ color: "var(--brand-muted)" }}>
              present of {snapshot.total}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-[12px]" style={{ color: "var(--brand-danger)" }}>
              <XCircle className="h-3 w-3" /> {snapshot.absent} absent
            </span>
            {snapshot.excused > 0 && (
              <span className="text-[12px]" style={{ color: "var(--brand-warning)" }}>
                {snapshot.excused} excused
              </span>
            )}
            <span className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
              · {snapshot.rate}% · {formatDate(snapshot.date)}
            </span>
          </div>
          {snapshot.firstTimers > 0 && (
            <p className="text-[12px] font-medium mt-0.5" style={{ color: "var(--brand-navy)" }}>
              + {snapshot.firstTimers} first timer{snapshot.firstTimers !== 1 ? "s" : ""}
            </p>
          )}
        </>
      ) : (
        <div className="flex flex-col items-start gap-1 mt-2">
          <span className="text-[20px] font-bold leading-none" style={{ color: "var(--brand-muted)" }}>—</span>
          <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>No service recorded yet</p>
        </div>
      )}
    </div>
  );
}

// ─── Figures (per-level headcount table) ─────────────────────────────────────

function FiguresTable({ rows, snapKey, title }: { rows: LevelRow[]; snapKey: SnapKey; title: string }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--brand-border)" }}>
      <div className="px-4 py-2.5" style={{ borderBottom: "1px solid var(--brand-border)", background: "#FAFAFA" }}>
        <span className="text-[11px] font-semibold uppercase tracking-[0.05em]" style={{ color: "var(--brand-muted)" }}>
          {title}
        </span>
      </div>
      <div className="flex flex-col">
        {rows.map((row, i) => {
          const snap = row[snapKey];
          const firstTimers = (row.lcLive?.firstTimers ?? 0) + (row.mgs?.firstTimers ?? 0);
          return (
            <div key={row.id} className="flex items-center gap-3 px-4 py-2.5"
                 style={{ borderTop: i === 0 ? "none" : "1px solid var(--brand-border)" }}>
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className="truncate text-[13px] font-medium" style={{ color: "var(--brand-text)" }}>
                  {row.name}
                </span>
                {firstTimers > 0 && (
                  <span className="rounded-pill text-[10px] font-semibold px-1.5 py-0.5 shrink-0"
                        style={{ background: "var(--brand-navy-light)", color: "var(--brand-navy)" }}>
                    +{firstTimers} 1st time{firstTimers !== 1 ? "rs" : "r"}
                  </span>
                )}
              </div>
              {snap ? (
                <div className="flex items-center gap-3 shrink-0 tabular-nums">
                  <span className="flex items-center gap-1 text-[12px]" style={{ color: "var(--brand-success)" }}>
                    <CheckCircle2 className="h-3 w-3" /> {snap.present}
                  </span>
                  <span className="flex items-center gap-1 text-[12px]" style={{ color: "var(--brand-danger)" }}>
                    <XCircle className="h-3 w-3" /> {snap.absent}
                  </span>
                  <span className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
                    / {snap.total}
                  </span>
                </div>
              ) : (
                <span className="text-[12px] shrink-0" style={{ color: "var(--brand-muted)" }}>—</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Charts (stacked present/absent bars per level) ──────────────────────────

function LevelChart({ rows, snapKey, title }: { rows: LevelRow[]; snapKey: SnapKey; title: string }) {
  // Each slice = a unit's share of the level's total head count present
  const chartData = rows
    .map((r) => ({ name: r.name, value: r[snapKey]?.present ?? 0 }))
    .filter((d) => d.value > 0);

  const totalAbsent = rows.reduce((sum, r) => sum + (r[snapKey]?.absent ?? 0), 0);

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.05em] mb-2" style={{ color: "var(--brand-muted)" }}>
        {title}
      </p>
      {chartData.length === 0 ? (
        <p className="text-[12px] text-center py-10 rounded-xl" style={{ color: "var(--brand-muted)", border: "1px solid var(--brand-border)" }}>
          No attendance recorded yet
        </p>
      ) : (
        <>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={85}
                  paddingAngle={1}
                >
                  {chartData.map((_, i) => <PieSlice key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value: number, name: string) => [`${value} present`, name]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[12px] text-center mt-1" style={{ color: "var(--brand-muted)" }}>
            <span style={{ color: SUCCESS }}>● Present share by unit</span>
            {totalAbsent > 0 && <span style={{ color: DANGER }}> · {totalAbsent} absent across all units</span>}
          </p>
        </>
      )}
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function AttendanceDrilldownSection({
  endpoint,
  actingParam = "",
}: {
  endpoint:     string;
  actingParam?: string;
}) {
  const [data,    setData]    = useState<DrilldownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view,    setView]    = useState<ViewMode>("figures");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (actingParam) {
      const [key, val] = actingParam.split("=");
      params.set(key, val);
    }
    const qs = params.toString();
    fetch(`${endpoint}${qs ? `?${qs}` : ""}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [endpoint, actingParam]);

  if (loading) {
    return (
      <div className="mb-6 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map((i) => <div key={i} className="rounded-xl h-24 skeleton" />)}
        </div>
        <div className="skeleton h-48 rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-[13px] text-center py-4 mb-6" style={{ color: "var(--brand-muted)" }}>
        Could not load attendance drill-down.
      </p>
    );
  }

  return (
    <div className="mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList style={{ width: 15, height: 15, color: "var(--brand-muted)" }} />
          <span className="text-[11px] font-medium uppercase tracking-[0.06em]" style={{ color: "var(--brand-muted)" }}>
            Headcount Drill-down · {data.scopeName}
          </span>
        </div>

        {/* Figures / Charts toggle */}
        <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--brand-border)" }}>
          {([
            { key: "figures", label: "Figures", icon: List },
            { key: "charts",  label: "Charts",  icon: PieChartIcon },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium transition-colors"
              style={{
                background:  view === key ? "var(--brand-navy)" : "#fff",
                color:       view === key ? "#fff" : "var(--brand-muted)",
                borderRight: key === "figures" ? "1px solid var(--brand-border)" : "none",
              }}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-4 h-px" style={{ background: "var(--brand-border)" }} />

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <TotalCard label="Total · LC Live (Wed)" snapshot={data.total.lcLive} />
        <TotalCard label="Total · MGS (Sun)"     snapshot={data.total.mgs} />
      </div>

      {/* Per-level breakdown */}
      {data.levels.map((level) => (
        <div key={level.key} className="mb-5">
          <p className="text-[13px] font-semibold mb-2" style={{ color: "var(--brand-text)" }}>
            {level.label}
          </p>
          {level.rows.length === 0 ? (
            <p className="text-[13px] text-center py-4 rounded-xl" style={{ color: "var(--brand-muted)", border: "1px solid var(--brand-border)" }}>
              Nothing to show yet.
            </p>
          ) : view === "figures" ? (
            <div className="grid sm:grid-cols-2 gap-3">
              <FiguresTable rows={level.rows} snapKey="lcLive" title="LC Live (Wed)" />
              <FiguresTable rows={level.rows} snapKey="mgs"    title="MGS (Sun)" />
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              <LevelChart rows={level.rows} snapKey="lcLive" title="LC Live (Wed)" />
              <LevelChart rows={level.rows} snapKey="mgs"    title="MGS (Sun)" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
