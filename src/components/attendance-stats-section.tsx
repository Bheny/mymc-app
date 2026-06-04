"use client";

import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";

type Period = "month" | "year";

type ServiceStats = {
  avgPresent:     number;
  attendanceRate: number;
  serviceCount:   number;
};

type AttendanceData = {
  period:           Period;
  activeMembers:    number;
  lcLive:           ServiceStats;
  mgs:              ServiceStats;
  shepherdsMeeting: ServiceStats;
  specialMeeting:   ServiceStats;
};

function StatCard({
  label, stats, activeMembers,
}: {
  label:         string;
  stats:         ServiceStats;
  activeMembers: number;
}) {
  const hasData = stats.serviceCount > 0;

  const rateColor =
    stats.attendanceRate >= 75 ? "var(--brand-success)" :
    stats.attendanceRate >= 50 ? "#854F0B" :
    "var(--brand-danger)";

  return (
    <div
      className="rounded-xl px-5 py-4 flex flex-col gap-1"
      style={{ border: "1px solid var(--brand-border)", background: "#fff" }}
    >
      {/* Service type label */}
      <p className="text-[11px] font-medium uppercase tracking-[0.06em]"
         style={{ color: "var(--brand-muted)" }}>
        {label}
      </p>

      {hasData ? (
        <>
          {/* Rate — the headline number */}
          <div className="flex items-end gap-2 mt-1">
            <span className="text-[32px] font-bold leading-none" style={{ color: rateColor }}>
              {stats.attendanceRate}%
            </span>
            <span className="text-[14px] font-medium mb-0.5" style={{ color: "var(--brand-muted)" }}>
              avg
            </span>
          </div>

          {/* Progress bar */}
          <div className="mt-2 rounded-pill overflow-hidden" style={{ height: 5, background: "var(--brand-border)" }}>
            <div
              className="h-full rounded-pill transition-all duration-500"
              style={{ width: `${Math.min(100, stats.attendanceRate)}%`, background: rateColor }}
            />
          </div>

          {/* Subtitle */}
          <p className="text-[12px] mt-1.5" style={{ color: "var(--brand-muted)" }}>
            ~{stats.avgPresent} / {activeMembers} present · {stats.serviceCount} service{stats.serviceCount !== 1 ? "s" : ""}
          </p>
        </>
      ) : (
        <div className="flex flex-col items-start gap-1 mt-2">
          <span className="text-[22px] font-bold leading-none" style={{ color: "var(--brand-muted)" }}>
            —
          </span>
          <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
            No services recorded yet
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function AttendanceStatsSection({
  endpoint,
  actingParam = "",
}: {
  endpoint:    string;   // e.g. "/api/cell/attendance-stats"
  actingParam?: string;  // e.g. "actingCellId=xxx"
}) {
  const [period,  setPeriod]  = useState<Period>("year");
  const [data,    setData]    = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ period });
    if (actingParam) {
      const [key, val] = actingParam.split("=");
      params.set(key, val);
    }
    fetch(`${endpoint}?${params}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [period, endpoint, actingParam]);

  return (
    <div className="mb-6">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ClipboardList style={{ width: 15, height: 15, color: "var(--brand-muted)" }} />
          <span className="text-[11px] font-medium uppercase tracking-[0.06em]"
                style={{ color: "var(--brand-muted)" }}>
            Attendance Averages
          </span>
        </div>

        {/* Period toggle */}
        <div className="flex rounded-lg overflow-hidden"
             style={{ border: "1px solid var(--brand-border)" }}>
          {(["month", "year"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-3 py-1 text-[12px] font-medium transition-colors"
              style={{
                background: period === p ? "var(--brand-navy)" : "#fff",
                color:      period === p ? "#fff" : "var(--brand-muted)",
                borderRight: p === "month" ? "1px solid var(--brand-border)" : "none",
              }}
            >
              {p === "month" ? "This Month" : "This Year"}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="mb-3 h-px" style={{ background: "var(--brand-border)" }} />

      {/* Cards */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl h-24 skeleton" />
          ))}
        </div>
      ) : !data ? (
        <p className="text-[13px] text-center py-4" style={{ color: "var(--brand-muted)" }}>
          Could not load attendance data.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="LC Live (Wed)"        stats={data.lcLive}           activeMembers={data.activeMembers} />
          <StatCard label="MGS (Sun)"            stats={data.mgs}              activeMembers={data.activeMembers} />
          <StatCard label="Shepherds Mtg (Fri)"  stats={data.shepherdsMeeting} activeMembers={data.activeMembers} />
          <StatCard label="Special Meetings"     stats={data.specialMeeting}   activeMembers={data.activeMembers} />
        </div>
      )}
    </div>
  );
}
