"use client";

import { useEffect, useState } from "react";
import { ClipboardList, Users } from "lucide-react";

type Snapshot = {
  date:    string;
  present: number;
  absent:  number;
  excused: number;
  total:   number;
  rate:    number;
  firstTimers: number;
} | null;

type BreakdownRow = { id: string; name: string; lcLive: Snapshot; mgs: Snapshot };

type OverviewData = {
  scopeLevel:     string;
  scopeName:      string;
  breakdownLabel: string;
  lcLive:         Snapshot;
  mgs:            Snapshot;
  breakdown:      BreakdownRow[];
};

function rateColor(pct: number): string {
  if (pct >= 80) return "var(--brand-success)";
  if (pct >= 60) return "var(--brand-warning)";
  return "var(--brand-danger)";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function LatestCard({ label, snapshot }: { label: string; snapshot: Snapshot }) {
  return (
    <div className="rounded-xl px-5 py-4 flex flex-col gap-1"
         style={{ border: "1px solid var(--brand-border)", background: "#fff" }}>
      <p className="text-[11px] font-medium uppercase tracking-[0.06em]" style={{ color: "var(--brand-muted)" }}>
        {label}
      </p>

      {snapshot ? (
        <>
          <div className="flex items-end gap-2 mt-1">
            <span className="text-[28px] font-bold leading-none" style={{ color: rateColor(snapshot.rate) }}>
              {snapshot.rate}%
            </span>
            <span className="text-[12px] font-medium mb-0.5" style={{ color: "var(--brand-muted)" }}>
              {formatDate(snapshot.date)}
            </span>
          </div>
          <div className="mt-2 rounded-pill overflow-hidden" style={{ height: 5, background: "var(--brand-border)" }}>
            <div className="h-full rounded-pill transition-all duration-500"
                 style={{ width: `${Math.min(100, snapshot.rate)}%`, background: rateColor(snapshot.rate) }} />
          </div>
          <p className="text-[12px] mt-1.5" style={{ color: "var(--brand-muted)" }}>
            {snapshot.present} present · {snapshot.absent} absent
            {snapshot.excused > 0 ? ` · ${snapshot.excused} excused` : ""}
          </p>
          {snapshot.firstTimers > 0 && (
            <p className="text-[12px] font-medium" style={{ color: "var(--brand-navy)" }}>
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

function BreakdownRate({ snapshot }: { snapshot: Snapshot }) {
  if (!snapshot) {
    return <span className="text-[12px]" style={{ color: "var(--brand-muted)" }}>—</span>;
  }
  return (
    <div className="flex items-center gap-2">
      <div className="w-14 rounded-pill overflow-hidden" style={{ height: 5, background: "var(--brand-border)" }}>
        <div className="h-full rounded-pill" style={{ width: `${Math.min(100, snapshot.rate)}%`, background: rateColor(snapshot.rate) }} />
      </div>
      <span className="text-[12px] font-medium tabular-nums" style={{ color: rateColor(snapshot.rate), minWidth: 32 }}>
        {snapshot.rate}%
      </span>
    </div>
  );
}

export function AttendanceOverviewSection({
  endpoint,
  actingParam = "",
}: {
  endpoint:     string;
  actingParam?: string;
}) {
  const [data,    setData]    = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

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
        <div className="skeleton h-40 rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-[13px] text-center py-4 mb-6" style={{ color: "var(--brand-muted)" }}>
        Could not load attendance overview.
      </p>
    );
  }

  return (
    <div className="mb-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <ClipboardList style={{ width: 15, height: 15, color: "var(--brand-muted)" }} />
        <span className="text-[11px] font-medium uppercase tracking-[0.06em]" style={{ color: "var(--brand-muted)" }}>
          Attendance Overview · {data.scopeName}
        </span>
      </div>
      <div className="mb-3 h-px" style={{ background: "var(--brand-border)" }} />

      {/* Latest snapshots */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <LatestCard label="Latest LC Live (Wed)" snapshot={data.lcLive} />
        <LatestCard label="Latest MGS (Sun)"     snapshot={data.mgs} />
      </div>

      {/* Breakdown */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--brand-border)" }}>
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--brand-border)" }}>
          <Users className="h-3.5 w-3.5" style={{ color: "var(--brand-muted)" }} />
          <span className="text-[12px] font-semibold" style={{ color: "var(--brand-text)" }}>
            {data.breakdownLabel}
          </span>
        </div>

        {data.breakdown.length === 0 ? (
          <p className="text-[13px] text-center py-6" style={{ color: "var(--brand-muted)" }}>
            Nothing to show yet.
          </p>
        ) : (
          <div className="flex flex-col">
            {data.breakdown.map((row, i) => {
              const firstTimers = (row.lcLive?.firstTimers ?? 0) + (row.mgs?.firstTimers ?? 0);
              return (
              <div key={row.id} className="flex items-center gap-4 px-4 py-3"
                   style={{ borderTop: i === 0 ? "none" : "1px solid var(--brand-border)" }}>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="truncate text-[13px] font-medium" style={{ color: "var(--brand-text)" }}>
                    {row.name}
                  </span>
                  {firstTimers > 0 && (
                    <span className="rounded-pill text-[10px] font-semibold px-1.5 py-0.5 shrink-0"
                          style={{ background: "var(--brand-navy-light, #EEF2FF)", color: "var(--brand-navy)" }}>
                      +{firstTimers} 1st time{firstTimers !== 1 ? "rs" : "r"}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-5 shrink-0">
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] uppercase tracking-[0.04em]" style={{ color: "var(--brand-muted)" }}>
                      LC Live
                    </span>
                    <BreakdownRate snapshot={row.lcLive} />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] uppercase tracking-[0.04em]" style={{ color: "var(--brand-muted)" }}>
                      MGS
                    </span>
                    <BreakdownRate snapshot={row.mgs} />
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
