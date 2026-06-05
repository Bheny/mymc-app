"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, Plus, ChevronRight, CheckCircle2, XCircle, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveRole } from "@/hooks/use-active-role";

type ServiceSummary = {
  id:        string;
  type:      "LC_LIVE" | "MGS";
  date:      string;
  mode:      "IN_PERSON" | "ONLINE";
  notes:     string | null;
  createdAt: string;
  stats: { total: number; present: number; absent: number; excused: number };
};

const TYPE_LABEL: Record<string, string> = {
  LC_LIVE:           "LC LIVE",
  MGS:               "MGS",
  SHEPHERDS_MEETING: "Shepherds Meeting",
  SPECIAL_MEETING:   "Special Meeting",
};
const TYPE_DAY: Record<string, string> = {
  LC_LIVE:           "Wednesday",
  MGS:               "Sunday",
  SHEPHERDS_MEETING: "Friday",
  SPECIAL_MEETING:   "Special",
};
const TYPE_COLOR: Record<string, string> = {
  LC_LIVE:           "var(--brand-navy)",
  MGS:               "#1A8C6C",
  SHEPHERDS_MEETING: "#7C3AED",
  SPECIAL_MEETING:   "#B45309",
};

function attendanceRate(stats: ServiceSummary["stats"]): number {
  return stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
}

function rateColor(pct: number): string {
  if (pct >= 80) return "var(--brand-success)";
  if (pct >= 60) return "var(--brand-warning)";
  return "var(--brand-danger)";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

type Gap = { date: string; type: string; label: string };

export default function AttendancePage() {
  const { ready, activeView } = useActiveRole();
  const actingCellId = activeView?.isActing && activeView.cellId ? activeView.cellId : null;

  const [services,      setServices]      = useState<ServiceSummary[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [gaps,          setGaps]          = useState<Gap[]>([]);
  const [cancellingGap, setCancellingGap] = useState<string | null>(null); // "date_type"

  useEffect(() => {
    if (!ready) return;
    const gapParams = actingCellId ? `?actingCellId=${actingCellId}` : "";
    Promise.all([
      fetch("/api/services?take=30").then((r) => r.json()),
      fetch(`/api/attendance/gaps${gapParams}`).then((r) => r.json()),
    ])
      .then(([svcs, gapData]) => {
        setServices(svcs);
        setGaps(gapData.gaps ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ready, actingCellId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function markCancelled(gap: Gap) {
    const key = `${gap.date}_${gap.type}`;
    setCancellingGap(key);
    await fetch("/api/services", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type:         gap.type,
        date:         gap.date,
        cancelled:    true,
        notes:        "Service cancelled",
        ...(actingCellId ? { actingCellId } : {}),
      }),
    });
    setGaps((prev) => prev.filter((g) => !(g.date === gap.date && g.type === gap.type)));
    setCancellingGap(null);
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1200px] mx-auto pb-20 lg:pb-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[24px] font-semibold" style={{ color: "var(--brand-text)" }}>
            Attendance
          </h1>
          <p className="mt-0.5 text-[14px]" style={{ color: "var(--brand-muted)" }}>
            LC LIVE (Wed) · MGS (Sun)
          </p>

        </div>
        <Link href="/attendance/new">
          <Button className="h-9 px-4 text-[14px] font-medium"
                  style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}>
            <Plus className="mr-2 h-4 w-4" /> Record attendance
          </Button>
        </Link>
      </div>

      {/* ── Missed services card ── */}
      {gaps.length > 0 && (
        <div className="rounded-xl overflow-hidden mb-6"
             style={{ border: "1px solid #FCD34D", background: "#FFFBEB" }}>
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3"
               style={{ borderBottom: "1px solid #FCD34D" }}>
            <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: "#D97706" }} />
            <span className="text-[13px] font-semibold" style={{ color: "#92400E" }}>
              {gaps.length} missed service{gaps.length !== 1 ? "s" : ""} — up to 4 weeks back
            </span>
            <span className="ml-auto text-[11px]" style={{ color: "#B45309" }}>
              Fill in or mark as cancelled
            </span>
          </div>

          {/* Gap rows */}
          {gaps.map((gap) => {
            const key    = `${gap.date}_${gap.type}`;
            const isBusy = cancellingGap === key;
            return (
              <div key={key} className="flex items-center gap-3 px-4 py-3"
                   style={{ borderBottom: "1px solid #FEF3DC" }}>
                {/* Type badge */}
                <span className="rounded-pill text-[11px] font-semibold px-2 py-0.5 text-white shrink-0"
                      style={{ background: TYPE_COLOR[gap.type] ?? "var(--brand-navy)" }}>
                  {TYPE_LABEL[gap.type] ?? gap.type}
                </span>
                {/* Date */}
                <span className="flex-1 text-[13px] font-medium" style={{ color: "#92400E" }}>
                  {gap.label}
                </span>
                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/attendance/new?date=${gap.date}&type=${gap.type}`}>
                    <button className="h-8 px-3 rounded-lg text-[12px] font-semibold transition-colors"
                            style={{ background: "var(--brand-navy)", color: "#fff" }}>
                      Fill in
                    </button>
                  </Link>
                  <button
                    onClick={() => markCancelled(gap)}
                    disabled={isBusy}
                    className="h-8 px-3 rounded-lg text-[12px] font-medium transition-colors disabled:opacity-50"
                    style={{ border: "1px solid #FCD34D", color: "#B45309", background: "#fff" }}
                  >
                    {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Cancelled"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : services.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ border: "1px solid var(--brand-border)" }}>
          <ClipboardList style={{ width: 40, height: 40, color: "var(--brand-muted)", margin: "0 auto 12px" }} />
          <p className="text-[14px] font-medium mb-1" style={{ color: "var(--brand-text)" }}>
            No attendance recorded yet
          </p>
          <p className="text-[13px] mb-4" style={{ color: "var(--brand-muted)" }}>
            Start by recording attendance for your next service.
          </p>
          <Link href="/attendance/new">
            <Button className="h-9 text-[13px]"
                    style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}>
              Record first service
            </Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {services.map((s) => {
            const rate = attendanceRate(s.stats);
            return (
              <Link key={s.id} href={`/attendance/${s.id}`}>
                <div
                  className="rounded-xl px-5 py-4 flex items-center gap-4 hover:bg-[var(--brand-navy-light)] transition-colors cursor-pointer"
                  style={{ border: "1px solid var(--brand-border)" }}
                >
                  {/* Type + date */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className="rounded-pill text-[11px] font-semibold px-2.5 py-0.5"
                        style={{
                          background: TYPE_COLOR[s.type] ?? "var(--brand-navy)",
                          color: "#fff",
                        }}
                      >
                        {TYPE_LABEL[s.type]}
                      </span>
                      {s.mode === "ONLINE" && (
                        <span className="rounded-pill text-[11px] font-medium px-2 py-0.5"
                              style={{ background: "#FEF3DC", color: "#854F0B" }}>
                          Online
                        </span>
                      )}
                      <span className="text-[13px] font-medium" style={{ color: "var(--brand-text)" }}>
                        {formatDate(s.date)}
                      </span>
                      <span className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
                        · {TYPE_DAY[s.type]}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex-1 rounded-pill overflow-hidden"
                           style={{ height: 6, background: "var(--brand-border)" }}>
                        <div className="h-full rounded-pill transition-all"
                             style={{ width: `${rate}%`, background: rateColor(rate) }} />
                      </div>
                      <span className="text-[12px] font-medium tabular-nums shrink-0"
                            style={{ color: rateColor(rate), minWidth: 36 }}>
                        {rate}%
                      </span>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 mt-1.5">
                      <span className="flex items-center gap-1 text-[12px]" style={{ color: "var(--brand-success)" }}>
                        <CheckCircle2 className="h-3 w-3" /> {s.stats.present} present
                      </span>
                      <span className="flex items-center gap-1 text-[12px]" style={{ color: "var(--brand-danger)" }}>
                        <XCircle className="h-3 w-3" /> {s.stats.absent} absent
                      </span>
                      {s.stats.excused > 0 && (
                        <span className="flex items-center gap-1 text-[12px]" style={{ color: "var(--brand-warning)" }}>
                          <Clock className="h-3 w-3" /> {s.stats.excused} excused
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--brand-muted)" }} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
