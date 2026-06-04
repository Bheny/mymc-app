"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Printer, TrendingUp, LayoutGrid, Users, UserPlus, BarChart2, FileText } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportEnvelope = {
  type:        string;
  generatedAt: string;
  scope:       { level: string; name: string };
  data:        Record<string, unknown>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const REPORT_LABELS: Record<string, string> = {
  "cells-ready-to-divide":  "Cells Ready to Divide",
  "consistent-absentees":   "Consistent Absentees",
  "shepherd-load":          "Shepherd Load",
  "first-timer-conversion": "First Timer Conversion",
  "highest-attendance":     "Highest Attendance",
  "monthly-summary":        "Monthly / Quarterly Summary",
};

const STATUS_COLORS: Record<string, string> = {
  ready:      "#DC2626",
  approaching:"#D97706",
  ok:         "#059669",
  overloaded: "#DC2626",
  "near-cap": "#D97706",
};

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function pct(n: number) { return `${n}%`; }

function RateBar({ rate, color = "#1A8C6C" }: { rate: number; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: "#E5E7EB", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, rate)}%`, height: "100%", background: color, borderRadius: 999 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color, minWidth: 36, textAlign: "right" }}>{pct(rate)}</span>
    </div>
  );
}

function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: bg, color, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9CA3AF", marginBottom: 12, marginTop: 28 }}>
      {children}
    </p>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th style={{ padding: "8px 12px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6B7280", textAlign: right ? "right" : "left", borderBottom: "1px solid #E5E7EB", background: "#F9FAFB" }}>
      {children}
    </th>
  );
}

function Td({ children, right, style }: { children: React.ReactNode; right?: boolean; style?: React.CSSProperties }) {
  return (
    <td style={{ padding: "10px 12px", fontSize: 13, color: "#1F2937", textAlign: right ? "right" : "left", borderBottom: "1px solid #F3F4F6", ...style }}>
      {children}
    </td>
  );
}

// ─── Report renderers ─────────────────────────────────────────────────────────

function CellsReadyToDivide({ data }: { data: Record<string, unknown> }) {
  const rows       = data.rows as { id: string; name: string; buscentre: string; cellShepherd: string | null; memberCount: number; overBy: number; status: string }[];
  const threshold  = data.threshold as number;
  const readyCount = data.readyCount as number;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Cells Checked",       value: rows.length },
          { label: "Ready to Divide",      value: readyCount,                                  color: readyCount > 0 ? "#DC2626" : "#059669" },
          { label: "Approaching Capacity", value: rows.filter((r) => r.status === "approaching").length, color: "#D97706" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ padding: "16px 20px", border: "1px solid #E5E7EB", borderRadius: 12, background: "#fff" }}>
            <p style={{ fontSize: 28, fontWeight: 700, color: color ?? "#1F2937" }}>{value}</p>
            <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{label}</p>
          </div>
        ))}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid #E5E7EB" }}>
        <thead>
          <tr><Th>Cell</Th><Th>Buscentre</Th><Th>Cell Shepherd</Th><Th right>Members</Th><Th right>Over Cap By</Th><Th>Status</Th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ background: r.status === "ready" ? "#FEF2F2" : r.status === "approaching" ? "#FFFBEB" : "#fff" }}>
              <Td><strong>{r.name}</strong></Td>
              <Td>{r.buscentre}</Td>
              <Td>{r.cellShepherd ?? <em style={{ color: "#9CA3AF" }}>Unassigned</em>}</Td>
              <Td right><strong>{r.memberCount}</strong> / {threshold}</Td>
              <Td right>{r.overBy > 0 ? <span style={{ color: "#DC2626", fontWeight: 600 }}>+{r.overBy}</span> : "—"}</Td>
              <Td><Pill label={r.status} color="#fff" bg={STATUS_COLORS[r.status] ?? "#6B7280"} /></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function ConsistentAbsentees({ data }: { data: Record<string, unknown> }) {
  const rows     = data.rows as { id: string; name: string; phone: string | null; cell: string; buscentre: string; shepherd: string; absentCount: number }[];
  const minAbs   = data.minAbsences as number;

  return (
    <>
      <div style={{ padding: "12px 16px", borderRadius: 10, background: "#FEF2F2", border: "1px solid #FECACA", marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: "#991B1B", fontWeight: 500 }}>
          {rows.length} member{rows.length !== 1 ? "s" : ""} absent {minAbs}+ times — follow up with their shepherd
        </p>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
        <thead>
          <tr><Th>Member</Th><Th>Phone</Th><Th>Shepherd</Th><Th>Cell</Th><Th right>Absences</Th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td><strong>{r.name}</strong></Td>
              <Td>{r.phone ?? "—"}</Td>
              <Td>{r.shepherd}</Td>
              <Td>{r.cell}</Td>
              <Td right><span style={{ color: "#DC2626", fontWeight: 700 }}>{r.absentCount}</span></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function ShepherdLoad({ data }: { data: Record<string, unknown> }) {
  const rows        = data.rows as { id: string; name: string | null; cell: string; buscentre: string; memberCount: number; capacity: number; overBy: number; status: string }[];
  const cap         = data.cap as number;
  const overloaded  = data.overloadedCount as number;
  const unassigned  = data.unassignedCount as number;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total Slots",     value: rows.length },
          { label: "Overloaded",      value: overloaded, color: overloaded > 0 ? "#DC2626" : "#059669" },
          { label: "Unfilled Slots",  value: unassigned, color: unassigned > 0 ? "#D97706" : "#059669" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ padding: "16px 20px", border: "1px solid #E5E7EB", borderRadius: 12, background: "#fff" }}>
            <p style={{ fontSize: 28, fontWeight: 700, color: color ?? "#1F2937" }}>{value}</p>
            <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{label}</p>
          </div>
        ))}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
        <thead>
          <tr><Th>Shepherd</Th><Th>Cell</Th><Th>Buscentre</Th><Th right>Members</Th><Th>Load</Th><Th>Status</Th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ background: r.status === "overloaded" ? "#FEF2F2" : r.status === "near-cap" ? "#FFFBEB" : "#fff" }}>
              <Td>{r.name ?? <em style={{ color: "#9CA3AF" }}>Unassigned</em>}</Td>
              <Td>{r.cell}</Td>
              <Td>{r.buscentre}</Td>
              <Td right><strong>{r.memberCount}</strong> / {cap}</Td>
              <Td><RateBar rate={Math.round((r.memberCount / cap) * 100)} color={STATUS_COLORS[r.status] ?? "#059669"} /></Td>
              <Td><Pill label={r.status} color="#fff" bg={STATUS_COLORS[r.status] ?? "#6B7280"} /></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function FirstTimerConversion({ data }: { data: Record<string, unknown> }) {
  const total     = data.total as number;
  const converted = data.converted as number;
  const rate      = data.rate as number;
  const wantsJoin = data.wantsJoin as number;
  const byCell    = data.byCell as { cell: string; buscentre: string; total: number; converted: number; rate: number }[];

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "First Timers",   value: total },
          { label: "Converted",      value: converted,  color: "#059669" },
          { label: "Conversion Rate",value: `${rate}%`, color: rate >= 50 ? "#059669" : "#D97706" },
          { label: "Wants to Join",  value: wantsJoin,  color: "#7C3AED" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ padding: "16px 20px", border: "1px solid #E5E7EB", borderRadius: 12, background: "#fff" }}>
            <p style={{ fontSize: 28, fontWeight: 700, color: color ?? "#1F2937" }}>{value}</p>
            <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{label}</p>
          </div>
        ))}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
        <thead>
          <tr><Th>Cell</Th><Th>Buscentre</Th><Th right>First Timers</Th><Th right>Converted</Th><Th>Rate</Th></tr>
        </thead>
        <tbody>
          {byCell.map((r, i) => (
            <tr key={i}>
              <Td><strong>{r.cell}</strong></Td>
              <Td>{r.buscentre}</Td>
              <Td right>{r.total}</Td>
              <Td right>{r.converted}</Td>
              <Td style={{ minWidth: 140 }}><RateBar rate={r.rate} color={r.rate >= 50 ? "#059669" : "#D97706"} /></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function HighestAttendance({ data }: { data: Record<string, unknown> }) {
  const rows  = data.rows as { id: string; type: string; date: string; cell: string; buscentre: string; presentCount: number; totalMarked: number; rate: number; speaker?: string | null; mode: string }[];
  const total = data.totalServices as number;

  const TYPE_LABEL: Record<string, string> = {
    LC_LIVE: "LC Live", MGS: "MGS", SHEPHERDS_MEETING: "Shepherds Mtg", SPECIAL_MEETING: "Special Mtg",
  };
  const TYPE_COLOR: Record<string, string> = {
    LC_LIVE: "#1E3A5F", MGS: "#065F46", SHEPHERDS_MEETING: "#5B21B6", SPECIAL_MEETING: "#92400E",
  };

  return (
    <>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>
        Top {rows.length} of {total} services in the selected period, ranked by attendance rate.
      </p>

      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
        <thead>
          <tr><Th>#</Th><Th>Service</Th><Th>Date</Th><Th>Cell</Th><Th>Buscentre</Th><Th right>Present</Th><Th>Rate</Th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} style={{ background: i === 0 ? "#F0FDF4" : "#fff" }}>
              <Td><span style={{ fontWeight: 700, color: i === 0 ? "#059669" : "#9CA3AF" }}>#{i + 1}</span></Td>
              <Td>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 999, background: TYPE_COLOR[r.type] ?? "#1E3A5F", color: "#fff" }}>
                  {TYPE_LABEL[r.type] ?? r.type}
                </span>
                {r.speaker && <span style={{ marginLeft: 6, fontSize: 12, color: "#6B7280" }}>{r.speaker}</span>}
              </Td>
              <Td>{fmt(r.date)}</Td>
              <Td>{r.cell}</Td>
              <Td>{r.buscentre}</Td>
              <Td right>{r.presentCount} / {r.totalMarked}</Td>
              <Td style={{ minWidth: 130 }}><RateBar rate={r.rate} color={r.rate >= 75 ? "#059669" : r.rate >= 50 ? "#D97706" : "#DC2626"} /></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function MonthlySummary({ data }: { data: Record<string, unknown> }) {
  const members    = data.members as { total: number; active: number; inactive: number; newInPeriod: number };
  const attendance = data.attendance as Record<string, { sessions: number; avgPresent: number; rate: number }>;
  const growth     = data.growth as { firstTimers: number; converted: number; conversionRate: number; soulsWon: number };

  const SVC_LABEL: Record<string, string> = { lcLive: "LC Live (Wed)", mgs: "MGS (Sun)", shepherdsMeeting: "Shepherds Mtg (Fri)", specialMeeting: "Special Meetings" };
  const SVC_COLOR: Record<string, string> = { lcLive: "#1E3A5F", mgs: "#065F46", shepherdsMeeting: "#5B21B6", specialMeeting: "#92400E" };

  return (
    <>
      {/* Members */}
      <SectionTitle>Members</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {[
          { label: "Total",      value: members.total },
          { label: "Active",     value: members.active,      color: "#059669" },
          { label: "Inactive",   value: members.inactive,    color: members.inactive > 0 ? "#DC2626" : "#6B7280" },
          { label: "New in Period", value: members.newInPeriod, color: "#7C3AED" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ padding: "14px 16px", border: "1px solid #E5E7EB", borderRadius: 10, background: "#fff" }}>
            <p style={{ fontSize: 24, fontWeight: 700, color: color ?? "#1F2937" }}>{value}</p>
            <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Attendance */}
      <SectionTitle>Attendance Averages</SectionTitle>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
        <thead><tr><Th>Service</Th><Th right>Sessions</Th><Th right>Avg Present</Th><Th>Rate</Th></tr></thead>
        <tbody>
          {Object.entries(attendance).filter(([, v]) => v.sessions > 0).map(([key, v]) => (
            <tr key={key}>
              <Td>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 999, background: SVC_COLOR[key] ?? "#1E3A5F", color: "#fff" }}>
                  {SVC_LABEL[key] ?? key}
                </span>
              </Td>
              <Td right>{v.sessions}</Td>
              <Td right>{v.avgPresent}</Td>
              <Td style={{ minWidth: 140 }}><RateBar rate={v.rate} color={v.rate >= 75 ? "#059669" : v.rate >= 50 ? "#D97706" : "#DC2626"} /></Td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Growth */}
      <SectionTitle>Growth & Outreach</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {[
          { label: "First Timers",      value: growth.firstTimers },
          { label: "Converted",         value: growth.converted,       color: "#059669" },
          { label: "Conversion Rate",   value: `${growth.conversionRate}%`, color: growth.conversionRate >= 50 ? "#059669" : "#D97706" },
          { label: "Souls Won",         value: growth.soulsWon,        color: "#7C3AED" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ padding: "14px 16px", border: "1px solid #E5E7EB", borderRadius: 10, background: "#fff" }}>
            <p style={{ fontSize: 24, fontWeight: 700, color: color ?? "#1F2937" }}>{value}</p>
            <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{label}</p>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Report icon map ──────────────────────────────────────────────────────────

const REPORT_ICONS: Record<string, React.ElementType> = {
  "cells-ready-to-divide":  LayoutGrid,
  "consistent-absentees":   Users,
  "shepherd-load":          Users,
  "first-timer-conversion": UserPlus,
  "highest-attendance":     BarChart2,
  "monthly-summary":        TrendingUp,
};

// ─── Main page ────────────────────────────────────────────────────────────────

function ReportContent() {
  const sp      = useSearchParams();
  const type    = sp.get("type") ?? "";
  const scope   = sp.get("scope");
  const scopeId = sp.get("scopeId");
  const from    = sp.get("from");
  const to      = sp.get("to");

  const [report,  setReport]  = useState<ReportEnvelope | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    const params = new URLSearchParams({ type });
    if (scope)   params.set("scope",   scope);
    if (scopeId) params.set("scopeId", scopeId);
    if (from)    params.set("from",    from);
    if (to)      params.set("to",      to);

    fetch(`/api/reports?${params}`)
      .then((r) => r.json())
      .then((d) => { setReport(d); setLoading(false); })
      .catch(() => { setError("Failed to load report."); setLoading(false); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const title   = REPORT_LABELS[type] ?? "Report";
  const Icon    = REPORT_ICONS[type]  ?? FileText;

  const dr = (report?.data as Record<string, unknown>)?.dateRange as { from: string; to: string } | undefined;
  const dateRangeStr = dr
    ? `${fmt(dr.from)} — ${fmt(dr.to)}`
    : from && to ? `${fmt(from)} — ${fmt(to)}` : null;

  const summary = (report?.data as Record<string, unknown>)?.summary as string | undefined;

  return (
    <div style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif", background: "#F9FAFB", minHeight: "100vh" }}>
      {/* Print / download bar */}
      <div className="no-print" style={{ background: "#1E3A5F", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon style={{ width: 18, height: 18, color: "rgba(255,255,255,0.8)" }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{title}</span>
          {report && (
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
              · {report.scope.name} · Generated {new Date(report.generatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
        <button
          onClick={() => window.print()}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 16px", background: "#fff", color: "#1E3A5F", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          <Printer style={{ width: 16, height: 16 }} /> Download / Print PDF
        </button>
      </div>

      {/* Report body */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 80px" }}>

        {/* Report header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon style={{ width: 22, height: 22, color: "#4338CA" }} />
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: "#111827", margin: 0 }}>{title}</h1>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 13, color: "#6B7280" }}>
            <span>Scope: <strong style={{ color: "#374151" }}>{report?.scope.name ?? "—"}</strong></span>
            {dateRangeStr && <span>Period: <strong style={{ color: "#374151" }}>{dateRangeStr}</strong></span>}
            {report && <span>Generated: <strong style={{ color: "#374151" }}>{new Date(report.generatedAt).toLocaleString("en-GB")}</strong></span>}
          </div>
          {summary && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: "#EEF2FF", borderRadius: 8, fontSize: 13, color: "#3730A3", fontWeight: 500 }}>
              {summary}
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#9CA3AF", fontSize: 14 }}>
            Generating report…
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#DC2626", fontSize: 14 }}>{error}</div>
        ) : report ? (
          <>
            {type === "cells-ready-to-divide"  && <CellsReadyToDivide  data={report.data} />}
            {type === "consistent-absentees"   && <ConsistentAbsentees data={report.data} />}
            {type === "shepherd-load"          && <ShepherdLoad         data={report.data} />}
            {type === "first-timer-conversion" && <FirstTimerConversion data={report.data} />}
            {type === "highest-attendance"     && <HighestAttendance    data={report.data} />}
            {type === "monthly-summary"        && <MonthlySummary       data={report.data} />}
          </>
        ) : null}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff; }
          @page { margin: 18mm 14mm; }
        }
      `}</style>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>Loading…</div>}>
      <ReportContent />
    </Suspense>
  );
}
