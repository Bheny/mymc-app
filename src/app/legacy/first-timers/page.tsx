"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, ClipboardList, RefreshCw, Sheet as SheetIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadError, StaleNotice } from "@/components/load-error";
import { FirstTimersSection } from "@/components/legacy-first-timers";
import { WhatsAppReportSheet } from "@/components/whatsapp-report-sheet";
import { fetchJson } from "@/lib/fetch-json";
import { useRoleGuard } from "@/hooks/use-role-guard";
import {
  buildFirstTimerNotes, filterFirstTimers, summariseFirstTimers,
  type FirstTimerIssues, type FirstTimerRow,
} from "@/lib/legacy-first-timers";
import {
  buildFirstTimersReport, firstTimerReportCounts, FIRST_TIMER_REPORT_SECTIONS,
  type FirstTimerReportSection,
} from "@/lib/legacy-first-timers-report";

type PageData =
  | { configured: false }
  | { configured: true; connected: false }
  | {
      configured: true;
      connected:  true;
      label:      string | null;
      fetchedAt:  string;
      mcs:        string[];
      firstTimers: { tabName: string | null; rows: FirstTimerRow[]; issues: FirstTimerIssues; error: string | null };
      /** First timers the cells' own reports counted — "MC|YYYY-MM" → n */
      reportedFirstTimers: Record<string, number>;
    };

const selectStyle = { border: "1px solid var(--brand-border)", color: "var(--brand-text)", background: "var(--surface)" };
const NO_ISSUES: FirstTimerIssues = { skipped: 0, unrecognisedStatus: 0 };
const NO_ROWS: FirstTimerRow[] = [];

export default function FirstTimersPage() {
  const { isLoading: roleLoading } = useRoleGuard(["admin", "chief_shepherd"]);

  // Cached: reopening the page shows the last data at once and refreshes it quietly
  const { data, error: loadError, mutate } = useSWR<PageData>("/api/legacy/first-timers");
  const [refreshing, setRefreshing] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [period, setPeriod] = useState("all");
  const [mc, setMc] = useState("");

  const ready = !!data && data.configured && data.connected;
  const rows    = ready ? data.firstTimers.rows : NO_ROWS;
  const issues  = ready ? data.firstTimers.issues : NO_ISSUES;
  const reported = ready ? data.reportedFirstTimers : null;

  // ── Filter options ──
  const mcs = useMemo(
    () => Array.from(new Set([...(ready ? data.mcs : []), ...rows.map((r) => r.mc).filter((m): m is string => !!m)])).sort(),
    [ready, data, rows],
  );
  const months = useMemo(() => Array.from(new Set(rows.map((r) => r.date.slice(0, 7)))).sort(), [rows]);
  const multiYear = new Set(months.map((m) => m.slice(0, 4))).size > 1;
  const monthLabel = useCallback((key: string) => new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC", month: "long", ...(multiYear ? { year: "numeric" } : {}),
  }), [multiYear]);

  // ── What the filters leave ──
  const inView = useMemo(() => filterFirstTimers(rows, mc, period), [rows, mc, period]);
  const summary = useMemo(() => summariseFirstTimers(inView), [inView]);
  const notes = useMemo(() => buildFirstTimerNotes(summary, issues), [summary, issues]);

  // What the cells' reports counted over the same MC and month, to compare with registrations
  const reportedByCells = useMemo(() => {
    if (!reported) return 0;
    return Object.entries(reported).reduce((total, [key, n]) => {
      const sep = key.lastIndexOf("|");
      const [keyMc, keyMonth] = [key.slice(0, sep), key.slice(sep + 1)];
      return (!mc || keyMc === mc) && (period === "all" || keyMonth === period) ? total + n : total;
    }, 0);
  }, [reported, mc, period]);

  // ── WhatsApp report ──
  const reportTitle = [mc || "All MCs", period === "all" ? "All time" : monthLabel(period)].join(" · ");
  const sectionList = useMemo(() => {
    const counts = firstTimerReportCounts(summary, notes, period);
    return (Object.keys(FIRST_TIMER_REPORT_SECTIONS) as FirstTimerReportSection[]).map((key) => ({
      key, label: FIRST_TIMER_REPORT_SECTIONS[key], count: counts[key],
    }));
  }, [summary, notes, period]);
  const buildReport = useCallback((selected: Record<string, boolean>) => buildFirstTimersReport({
    title: reportTitle, summary, notes, reportedByCells, period, monthLabel,
    sections: selected as Record<FirstTimerReportSection, boolean>,
  }), [reportTitle, summary, notes, reportedByCells, period, monthLabel]);

  async function refresh() {
    setRefreshing(true);
    try {
      // Bypass the server's one-minute sheet cache
      await mutate(fetchJson<PageData>("/api/legacy/first-timers?fresh=1"), { revalidate: false });
    } catch { /* the notice below shows if there's still nothing */ }
    setRefreshing(false);
  }

  // ── States ──
  if (roleLoading || (!data && !loadError)) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1200px] mx-auto">
        <div className="skeleton h-8 w-48 mb-4 rounded-lg" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
        <div className="skeleton h-72 rounded-xl" />
      </div>
    );
  }
  if (!data) return <LoadError message={loadError?.message ?? "Couldn't load the first timers."} onRetry={() => mutate()} />;

  if (!data.configured || !data.connected) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[720px] mx-auto">
        <Link href="/legacy" className="inline-flex items-center gap-1.5 text-[13px] hover:underline mb-3" style={{ color: "var(--brand-muted)" }}>
          <ArrowLeft className="h-3.5 w-3.5" /> Legacy
        </Link>
        <h1 className="text-[24px] font-semibold mb-4" style={{ color: "var(--brand-text)" }}>First timers</h1>
        <div className="rounded-xl p-8 text-center flex flex-col items-center gap-3" style={{ border: "1px solid var(--brand-border)" }}>
          <SheetIcon style={{ width: 36, height: 36, color: "var(--brand-muted)" }} />
          <p className="text-[14px]" style={{ color: "var(--brand-text)" }}>
            {data.configured ? "No first timers tab is connected yet." : "No Google Sheets are connected yet."}
          </p>
          <Link href="/settings">
            <Button className="h-9 text-[13px]" style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}>
              Open Settings
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const hasFilters = mc !== "" || period !== "all";

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1200px] mx-auto pb-20 lg:pb-8">
      {loadError && <StaleNotice onRetry={() => mutate()} />}

      {/* ── Header ── */}
      <Link href="/legacy" className="inline-flex items-center gap-1.5 text-[13px] hover:underline mb-3" style={{ color: "var(--brand-muted)" }}>
        <ArrowLeft className="h-3.5 w-3.5" /> Legacy
      </Link>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h1 className="text-[24px] font-semibold" style={{ color: "var(--brand-text)" }}>First timers</h1>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--brand-muted)" }}>
            {data.label ?? "Registrations"} · {rows.length.toLocaleString("en-GB")} registered · updated{" "}
            {new Date(data.fetchedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => setShowReport(true)} className="h-9 text-[13px]"
                  style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}>
            <ClipboardList className="h-3.5 w-3.5 mr-1.5" /> Generate report
          </Button>
          <Button variant="outline" onClick={refresh} disabled={refreshing} className="h-9 text-[13px]" style={{ borderRadius: 8 }}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <select aria-label="Period" value={period} onChange={(e) => setPeriod(e.target.value)}
                className="h-9 px-3 text-[13px] rounded-lg" style={selectStyle}>
          <option value="all">All time</option>
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        {mcs.length > 1 && (
          <select aria-label="MC" value={mc} onChange={(e) => setMc(e.target.value)}
                  className="h-9 px-3 text-[13px] rounded-lg" style={selectStyle}>
            <option value="">All MCs</option>
            {mcs.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
        {hasFilters && (
          <button onClick={() => { setMc(""); setPeriod("all"); }}
                  className="h-9 px-2 text-[12px] font-medium inline-flex items-center gap-1 hover:underline" style={{ color: "var(--brand-link)" }}>
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      <div className="transition-opacity" style={{ opacity: refreshing ? 0.6 : 1 }}>
        <FirstTimersSection
          title="Summary"
          rows={rows}
          tabName={data.firstTimers.tabName}
          error={data.firstTimers.error}
          issues={issues}
          mc={mc}
          period={period}
          reportedByCells={reportedByCells}
          ignoredFilters={[]}
          monthLabel={monthLabel}
          onSelectMc={setMc}
        />
      </div>

      <WhatsAppReportSheet
        open={showReport}
        onClose={() => setShowReport(false)}
        title="First timers report"
        description={`${reportTitle} · formatted for WhatsApp`}
        sections={sectionList}
        build={buildReport}
      />
    </div>
  );
}
