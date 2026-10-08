"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, LabelList, type TooltipProps,
} from "recharts";
import {
  RefreshCw, AlertTriangle, ClipboardCheck, Sheet as SheetIcon, ArrowUpDown, ChevronLeft,
  ChevronRight, Search, X, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LegacyIntegritySheet } from "@/components/legacy-integrity-sheet";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody,
} from "@/components/ui/sheet";
import { useRoleGuard } from "@/hooks/use-role-guard";
import {
  formatDay, formatMonth, mean, median, monthKey, weekStart,
  type DuplicateGroup, type LegacyIssues, type LegacyReport, type PossibleDuplicate,
} from "@/lib/legacy-report";

// ─── Types & constants ────────────────────────────────────────────────────────

type SourceStatus = { name: string; url: string; tabName: string | null; ok: boolean; error?: string; count: number };

type ApiResponse =
  | { configured: false }
  | { configured: true; error: string }
  | {
      configured: true;
      label:     string | null;
      fetchedAt: string;
      sources:   SourceStatus[];
      reports:   LegacyReport[];
      issues:    LegacyIssues;
      church:    { tabName: string | null; count: number; error: string | null } | null;
      // "mc|cell" → leaders, from the church directory (or the sheet's own tab)
      leaders:   Record<string, { cellShepherd: string | null; seniorShepherd: string | null; mcPastor: string | null }>;
      mcPastors: Record<string, string | null>;
      // "mc|cell" → when a collapsed cell stopped (inferred = its last report; the directory gave no date)
      closures?: Record<string, { on: string; inferred: boolean }>;
      unlisted:  string[];  // cells the directory doesn't list — MC/bacenta fell back to the sheet/form
      ambiguous: string[];  // cell names listed more than once that couldn't be told apart
      duplicates: DuplicateGroup[];  // same cell/date/service submitted more than once
      possibleDuplicates?: PossibleDuplicate[];  // same cell/service on two dates in one week
    };

type ServiceFilter = "all" | "MGS" | "LC LIVE";

// Validated categorical slots — blue, orange, aqua; CSS vars switch to the
// dark-mode steps (validated against the dark surface) under .dark
const SERIES = { mgs: "var(--series-1)", lc: "var(--series-2)", third: "var(--series-3)" } as const;
const SERVICE_COLOR: Record<string, string> = { MGS: SERIES.mgs, "LC LIVE": SERIES.lc };
const AXIS_TICK = { fontSize: 11, fill: "var(--brand-muted)" };

const fmt = (n: number, digits = 0) =>
  n.toLocaleString("en-GB", { maximumFractionDigits: digits, minimumFractionDigits: 0 });

// "all" or a month key (YYYY-MM)
type Period = "all" | string;

// ─── Small pieces ─────────────────────────────────────────────────────────────

function Card({ title, subtitle, action, children }: {
  title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="bg-[var(--surface)] rounded-xl p-4 sm:p-5 flex flex-col gap-3 min-w-0"
             style={{ border: "1px solid var(--brand-border)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold" style={{ color: "var(--brand-text)" }}>{title}</h2>
          {subtitle && <p className="text-[12px] mt-0.5" style={{ color: "var(--brand-muted)" }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[var(--surface)] rounded-xl p-4 flex flex-col gap-2 min-w-0" style={{ border: "1px solid var(--brand-border)" }}>
      <span className="text-[11px] font-medium uppercase tracking-[0.04em] leading-tight" style={{ color: "var(--brand-muted)" }}>
        {label}
      </span>
      <span className="text-[28px] font-semibold leading-none" style={{ color: "var(--brand-text)" }}>{value}</span>
      {sub && <span className="text-[12px]" style={{ color: "var(--brand-muted)" }}>{sub}</span>}
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange, ariaLabel }: {
  value: T; options: { key: T; label: string }[]; onChange: (v: T) => void; ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-lg overflow-hidden shrink-0"
         style={{ border: "1px solid var(--brand-border)" }}>
      {options.map((o) => (
        <button key={o.key} role="radio" aria-checked={value === o.key} onClick={() => onChange(o.key)}
                className="px-3 h-9 text-[12px] font-medium transition-colors whitespace-nowrap"
                style={value === o.key
                  ? { background: "var(--brand-navy)", color: "#fff" }
                  : { background: "var(--surface)", color: "var(--brand-muted)" }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const selectStyle = { border: "1px solid var(--brand-border)", color: "var(--brand-text)", background: "var(--surface)" };

/** Legend that mirrors the mark: short line for lines, square for bars. */
function Legend({ items, mark }: { items: { label: string; color: string }[]; mark: "line" | "rect" }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--brand-muted)" }}>
          <span style={mark === "line"
            ? { width: 14, height: 2, borderRadius: 1, background: i.color }
            : { width: 10, height: 10, borderRadius: 2, background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Tooltip: value first (strong), series name second, keyed by a short line. */
function ChartTooltip({ active, payload, label, title }: TooltipProps<number, string> & { title?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 bg-[var(--surface)] shadow-md text-[12px]" style={{ border: "1px solid var(--brand-border)" }}>
      <p className="mb-1 font-medium" style={{ color: "var(--brand-text)" }}>{title ? title(String(label)) : label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2">
          <span style={{ width: 10, height: 2, background: p.color, borderRadius: 1 }} />
          <b style={{ color: "var(--brand-text)" }}>{p.value == null ? "—" : fmt(Number(p.value), 1)}</b>
          <span style={{ color: "var(--brand-muted)" }}>{p.name}</span>
        </p>
      ))}
    </div>
  );
}

/** Trend tooltip: value first, then which actual service dates sit behind it. */
function TrendTooltip({ active, payload, label, view }: TooltipProps<number, string> & { view: TrendView }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as TrendRow;
  const x = String(label);
  const title = view === "month" ? formatMonth(x, true)
    : view === "week" ? `Week of ${formatDay(x, { day: "numeric", month: "long" })}`
    : formatDay(x, { weekday: "long", day: "numeric", month: "long" });
  return (
    <div className="rounded-lg px-3 py-2 bg-[var(--surface)] shadow-md text-[12px]" style={{ border: "1px solid var(--brand-border)" }}>
      <p className="mb-1 font-medium" style={{ color: "var(--brand-text)" }}>{title}</p>
      {payload.map((p) => {
        const svc = String(p.dataKey);
        const detail = view === "week"
          ? (row.dates[svc] ?? []).map((d) => formatDay(d, { weekday: "short", day: "numeric", month: "short" })).join(", ")
          : view === "month" && row.n[svc]
          ? `median of ${row.n[svc]} service${row.n[svc] === 1 ? "" : "s"}`
          : "";
        return (
          <p key={svc} className="flex items-center gap-2">
            <span style={{ width: 10, height: 2, background: p.color, borderRadius: 1 }} />
            <b style={{ color: "var(--brand-text)" }}>{p.value == null ? "—" : fmt(Number(p.value))}</b>
            <span style={{ color: "var(--brand-muted)" }}>{p.name}{detail ? ` · ${detail}` : ""}</span>
          </p>
        );
      })}
    </div>
  );
}

/** Breakdown bar tooltip: median leads, average follows. */
function BreakdownTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as { name: string; median: number; avg: number; meta?: [string, string][] };
  return (
    <div className="rounded-lg px-3 py-2 bg-[var(--surface)] shadow-md text-[12px] max-w-[260px]" style={{ border: "1px solid var(--brand-border)" }}>
      <p className="mb-1 font-medium" style={{ color: "var(--brand-text)" }}>{d.name}</p>
      <p className="flex items-center gap-2">
        <span style={{ width: 10, height: 2, background: SERIES.mgs, borderRadius: 1 }} />
        <b style={{ color: "var(--brand-text)" }}>{fmt(d.median)}</b>
        <span style={{ color: "var(--brand-muted)" }}>median per service</span>
      </p>
      <p className="pl-[18px]" style={{ color: "var(--brand-muted)" }}>avg {fmt(d.avg, 1)}</p>
      {!!d.meta?.length && (
        <dl className="mt-2 pt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5" style={{ borderTop: "1px solid var(--brand-border)" }}>
          {d.meta.map(([k, v]) => (
            <div key={k} className="contents">
              <dt style={{ color: "var(--brand-muted)" }}>{k}</dt>
              <dd className="font-medium" style={{ color: "var(--brand-text)" }}>{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

// ─── Cell info panel ──────────────────────────────────────────────────────────

type CellInfo = {
  mc: string; bacenta: string; cellShepherd: string | null; seniorShepherd: string | null;
  mcPastor: string | null; inDirectory: boolean; since: string; latest: LegacyReport;
  closure: { on: string; inferred: boolean } | null;
  reports: number; gap: { expected: number; missing: number } | null;
  mgsMedian: number | null; lcMedian: number | null; firstTimers: number; soulsWon: number;
};

function InfoItem({ label, value, muted }: { label: string; value: React.ReactNode; muted?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-[0.04em]" style={{ color: "var(--brand-muted)" }}>{label}</dt>
      <dd className="text-[14px] truncate" style={{ color: muted ? "var(--brand-muted)" : "var(--brand-text)" }}>{value}</dd>
    </div>
  );
}

function CellInfoPanel({ cell, info }: { cell: string; info: CellInfo }) {
  const svc = (s: string) => (s === "MGS" ? "MGS" : s === "LC LIVE" ? "LC Live" : s);
  const rate = info.gap && info.gap.expected
    ? `${fmt(((info.gap.expected - info.gap.missing) / info.gap.expected) * 100)}% · ${info.gap.missing} missing`
    : "—";
  return (
    <div className="rounded-lg p-4 flex flex-col gap-4" style={{ background: "var(--brand-navy-light)" }}>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.07em] mb-2" style={{ color: "var(--brand-muted)" }}>Leadership</p>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
          <InfoItem label="Cell" value={cell} />
          <InfoItem label="Led by" value={info.cellShepherd ?? "—"} muted={!info.cellShepherd} />
          <InfoItem label="Bacenta" value={info.bacenta} />
          <InfoItem label="Bacenta head" value={info.seniorShepherd ?? "—"} muted={!info.seniorShepherd} />
          <InfoItem label="MC" value={info.mc} />
          <InfoItem label="MC pastor" value={info.mcPastor ?? "—"} muted={!info.mcPastor} />
          <InfoItem label="Status" value={info.closure
            ? `Collapsed · ${info.closure.inferred ? "last report" : "since"} ${formatDay(info.closure.on, { day: "numeric", month: "short", year: "numeric" })}`
            : "Active"} muted={!!info.closure} />
        </dl>
        {!info.inDirectory && (
          <p className="text-[12px] mt-2" style={{ color: "var(--brand-muted)" }}>
            This cell isn&apos;t in the church directory — add it there, or{" "}
            <Link href="/settings" className="underline">connect a directory in Settings</Link>, to fill these in.
          </p>
        )}
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.07em] mb-2" style={{ color: "var(--brand-muted)" }}>
          Reporting
        </p>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
          <InfoItem label="Reporting since" value={formatDay(info.since, { day: "numeric", month: "short", year: "numeric" })} />
          <InfoItem label="Last report"
                    value={`${formatDay(info.latest.date, { day: "numeric", month: "short", year: "numeric" })} · ${svc(info.latest.service)}`} />
          <InfoItem label="Reports received" value={`${info.reports} · ${rate}`} />
          <InfoItem label="Median MGS attendance" value={info.mgsMedian == null ? "—" : fmt(info.mgsMedian)} muted={info.mgsMedian == null} />
          <InfoItem label="Median LC Live attendance" value={info.lcMedian == null ? "—" : fmt(info.lcMedian)} muted={info.lcMedian == null} />
          <InfoItem label="First timers · souls won" value={`${info.firstTimers} · ${info.soulsWon}`} />
        </dl>
        <p className="text-[11px] mt-2" style={{ color: "var(--brand-muted)" }}>Reporting figures follow the period and service filters.</p>
      </div>
    </div>
  );
}

const fmtSubmitted = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Side-by-side submissions for one duplicate group. */
function DuplicateTable({ group }: { group: DuplicateGroup }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px] min-w-[460px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-[0.04em] text-left" style={{ color: "var(--brand-muted)" }}>
            <th className="px-2 py-1 font-medium">Submitted</th>
            <th className="px-2 py-1 font-medium text-right">In person</th>
            <th className="px-2 py-1 font-medium text-right">First timers</th>
            <th className="px-2 py-1 font-medium text-right">Souls won</th>
            <th className="px-2 py-1 font-medium text-right">Online</th>
            <th className="px-2 py-1 font-medium text-right">Dashboard</th>
          </tr>
        </thead>
        <tbody>
          {group.submissions.map((sub) => (
            <tr key={sub.submittedAt} style={{ borderTop: "1px solid var(--brand-border)", color: "var(--brand-text)" }}>
              <td className="px-2 py-1.5 whitespace-nowrap">{fmtSubmitted(sub.submittedAt)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{sub.attendance}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{sub.firstTimers}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{sub.soulsWon}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{sub.online}</td>
              <td className="px-2 py-1.5 text-right">
                {sub.counted ? (
                  <span className="rounded-pill text-[10px] font-semibold px-2 py-0.5" style={{ background: "var(--tint-ok-bg)", color: "var(--tint-ok-fg)" }}>
                    Counted
                  </span>
                ) : (
                  <span className="text-[11px]" style={{ color: "var(--brand-muted)" }}>Not counted</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Report detail sheet ──────────────────────────────────────────────────────

function ReportSheet({ report, duplicate, onClose }: {
  report: LegacyReport | null; duplicate?: DuplicateGroup; onClose: () => void;
}) {
  const rows: [string, string | number | null][] = report ? [
    ["Pastor",            report.pastor],
    ["Senior shepherd",   report.seniorShepherd],
    ["Shepherds",         report.shepherds],
    ["Cell shepherd",     report.cellShepherd],
    ["Members",           report.members],
    ["First timers",      report.firstTimers],
    ["Total in person",   report.attendance],
    ["Online",            report.online],
    ["Souls won",         report.soulsWon],
    ["First timers retained", report.retained],
    ["Teens (MGS)",       report.teens],
    ["Children (LC Live)", report.children],
  ] : [];
  return (
    <Sheet open={!!report} onOpenChange={(o) => !o && onClose()}>
      <SheetContent width={420}>
        <SheetHeader>
          <SheetTitle>{report?.cell} · {report?.service}</SheetTitle>
          <SheetDescription>
            {report && `${formatDay(report.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · ${report.bacenta} · ${report.mc}`}
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          <dl className="flex flex-col">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between py-2.5 text-[14px]"
                   style={{ borderBottom: "1px solid var(--brand-border)", fontWeight: k === "Total in person" ? 600 : 400 }}>
                <dt style={{ color: "var(--brand-muted)" }}>{k}</dt>
                <dd style={{ color: "var(--brand-text)" }}>{v ?? "—"}</dd>
              </div>
            ))}
          </dl>
          {report && (
            <p className="text-[12px] mt-3" style={{ color: "var(--brand-muted)" }}>
              Submitted {new Date(report.submittedAt).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })}
            </p>
          )}
          {duplicate && (
            <div className="mt-4 rounded-lg p-3 flex flex-col gap-2" style={{ background: "var(--tint-warn-bg)" }}>
              <p className="text-[12px] font-medium flex items-start gap-1.5" style={{ color: "var(--tint-warn-fg)" }}>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                Submitted {duplicate.submissions.length} times — only the latest is counted. Delete the wrong row in the
                sheet (or correct its date) to clear this.
              </p>
              <div className="bg-[var(--surface)] rounded-md"><DuplicateTable group={duplicate} /></div>
            </div>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type CellSortKey = "cell" | "mc" | "bacenta" | "reports" | "attendance" | "online" | "firstTimers" | "retained" | "soulsWon";
type GroupBy = "mc" | "bacenta" | "cell";
type TrendView = "day" | "week" | "month";

// Each service's weekday (0 = Sunday) — places a week's service on its actual date
const SERVICE_WEEKDAY: Record<string, number> = { MGS: 0, "LC LIVE": 3 };

type TrendRow = {
  x: string;                                   // date (day/week) or month key
  MGS?: number;
  "LC LIVE"?: number;
  dates: Partial<Record<string, string[]>>;    // week view: actual service dates behind the point
  n:     Partial<Record<string, number>>;      // month view: services the median covers
};

export default function LegacyPage() {
  const { isLoading: roleLoading } = useRoleGuard(["admin", "chief_shepherd"]);

  const [data,       setData]       = useState<ApiResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Filters — scope everything below them
  const [period,  setPeriod]  = useState<Period>("all");
  const [service, setService] = useState<ServiceFilter>("all");
  const [mc,      setMc]      = useState("");
  const [bacenta, setBacenta] = useState("");
  const [cell,    setCell]    = useState("");
  const [activeOnly, setActiveOnly] = useState(false); // hide collapsed cells and all their reports

  const [groupBy,    setGroupBy]    = useState<GroupBy | null>(null);
  const [trendView,  setTrendView]  = useState<TrendView>("week");
  const [cellSort,   setCellSort]   = useState<{ key: CellSortKey; dir: 1 | -1 }>({ key: "attendance", dir: -1 });
  const [query,      setQuery]      = useState("");
  const [page,       setPage]       = useState(0);
  const [dateAsc,    setDateAsc]    = useState(true); // oldest first, like the sheet
  const [showInfo,   setShowInfo]   = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showAllGaps, setShowAllGaps] = useState(false);
  const [selected,   setSelected]   = useState<LegacyReport | null>(null);

  const load = useCallback(async (fresh = false) => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/legacy/data${fresh ? "?fresh=1" : ""}`);
      setData(await res.json());
    } catch {
      setData({ configured: true, error: "Couldn't load the data." });
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const all = useMemo(() => (data && "reports" in data ? data.reports : []), [data]);

  // ── Filter options ──
  const mcs = useMemo(() => Array.from(new Set(all.map((r) => r.mc))).sort(), [all]);
  // Months with any report, oldest first; the year is shown only if the data spans several
  const months = useMemo(() => Array.from(new Set(all.map((r) => monthKey(r.date)))).sort(), [all]);
  const multiYear = new Set(months.map((m) => m.slice(0, 4))).size > 1;
  const monthLabel = (key: string) => new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC", month: "long", ...(multiYear ? { year: "numeric" } : {}),
  });
  const multiMc = mcs.length > 1;
  // Collapsed cells (from the directory's Status / Closed on columns)
  const closures = useMemo(() => (data && "closures" in data ? data.closures ?? {} : {}), [data]);
  const collapsedCount = Object.keys(closures).length;
  const hiddenCell = useCallback((r: { mc: string; cell: string }) => activeOnly && !!closures[`${r.mc}|${r.cell}`],
    [activeOnly, closures]);
  const bacentas = useMemo(
    () => Array.from(new Set(all.filter((r) => !mc || r.mc === mc).map((r) => r.bacenta))).sort(),
    [all, mc],
  );
  const cells = useMemo(
    () => Array.from(new Set(all.filter((r) => (!mc || r.mc === mc) && (!bacenta || r.bacenta === bacenta) && !hiddenCell(r))
      .map((r) => r.cell))).sort(),
    [all, mc, bacenta, hiddenCell],
  );
  // A selected cell that "Active cells only" hides is deselected
  useEffect(() => { if (cell && !cells.includes(cell)) setCell(""); }, [cell, cells]);
  const isCollapsed = (cellName: string) =>
    Object.keys(closures).some((k) => k.slice(k.indexOf("|") + 1) === cellName && (!mc || k.startsWith(`${mc}|`)));

  // Default grouping: by MC when there are several, else by bacenta
  const group: GroupBy = groupBy ?? (multiMc && !mc ? "mc" : "bacenta");
  const cellLabel = (r: { cell: string; mc: string }) => (multiMc && !mc ? `${r.cell} · ${r.mc}` : r.cell);

  // ── Filtered slice ──
  const inScope = useCallback((r: LegacyReport) =>
    (!mc || r.mc === mc) && (!bacenta || r.bacenta === bacenta) && (!cell || r.cell === cell) && !hiddenCell(r),
    [mc, bacenta, cell, hiddenCell]);
  const filtered = useMemo(() => all.filter((r) =>
    inScope(r) &&
    (service === "all" || r.service === service) &&
    (period === "all" || monthKey(r.date) === period)
  ), [all, inScope, service, period]);

  // Per (week, service) totals — misdated reports stay with their week's service
  const weekly = useMemo(() => {
    const m = new Map<string, { week: string; service: string; attendance: number; online: number; cells: Set<string> }>();
    for (const r of filtered) {
      const week = weekStart(r.date);
      const k = `${week}|${r.service}`;
      const e = m.get(k) ?? { week, service: r.service, attendance: 0, online: 0, cells: new Set<string>() };
      e.attendance += r.attendance; e.online += r.online; e.cells.add(`${r.mc}|${r.cell}`);
      m.set(k, e);
    }
    return Array.from(m.values());
  }, [filtered]);

  // ── Headline numbers ──
  const stats = useMemo(() => {
    const per = (svc: string) => weekly.filter((w) => w.service === svc).map((w) => w.attendance);
    const mgs = per("MGS"), lc = per("LC LIVE");
    const firstTimers = filtered.reduce((a, r) => a + r.firstTimers, 0);
    const retained    = filtered.reduce((a, r) => a + (r.retained ?? 0), 0);
    return {
      mgsAvg: mean(mgs), mgsMedian: median(mgs), mgsCount: mgs.length,
      lcAvg:  mean(lc),  lcMedian:  median(lc),  lcCount:  lc.length,
      onlineMedian: median(weekly.map((w) => w.online)),
      onlineAvg:    mean(weekly.map((w) => w.online)),
      firstTimers, retained,
      retentionPct: firstTimers ? (retained / firstTimers) * 100 : 0,
      soulsWon: filtered.reduce((a, r) => a + r.soulsWon, 0),
    };
  }, [weekly, filtered]);

  // ── Reporting gaps ──
  // A service counts as held for an MC when any of its cells reported it (in the
  // selected period/service). Each in-scope cell is expected at every service its
  // MC held from the week of its first-ever report onwards.
  const gaps = useMemo(() => {
    const held      = new Map<string, Set<string>>();  // mc → week|service
    const reported  = new Set<string>();               // mc|cell|week|service
    const firstSeen = new Map<string, string>();       // mc|cell → first week
    for (const r of all) {
      const week = weekStart(r.date);
      const cellKey = `${r.mc}|${r.cell}`;
      if (inScope(r) && (!firstSeen.has(cellKey) || week < firstSeen.get(cellKey)!)) firstSeen.set(cellKey, week);
      if ((service !== "all" && r.service !== service) || (period !== "all" && monthKey(r.date) !== period)) continue;
      const ws = `${week}|${r.service}`;
      if (!held.has(r.mc)) held.set(r.mc, new Set());
      held.get(r.mc)!.add(ws);
      reported.add(`${cellKey}|${ws}`);
    }

    const byService = new Map<string, string[]>();     // week|service → missing cell labels
    const byCell    = new Map<string, { expected: number; missing: number; missed: string[] }>();  // missed: week|service
    let expected = 0, missingCount = 0;
    for (const [cellKey, start] of Array.from(firstSeen)) {
      const sep = cellKey.indexOf("|");
      const m = cellKey.slice(0, sep), c = cellKey.slice(sep + 1);
      const stats = { expected: 0, missing: 0, missed: [] as string[] };
      const closed = closures[cellKey]?.on;
      for (const ws of Array.from(held.get(m) ?? [])) {
        if (ws.slice(0, 10) < start) continue;
        if (closed) {
          // The service's own date (Sunday / Wednesday of that week) — skip if after the cell collapsed
          const d = new Date(`${ws.slice(0, 10)}T00:00:00Z`);
          d.setUTCDate(d.getUTCDate() + (SERVICE_WEEKDAY[ws.slice(11)] ?? 0));
          if (d.toISOString().slice(0, 10) > closed) continue;
        }
        stats.expected++;
        if (!reported.has(`${cellKey}|${ws}`)) {
          stats.missing++;
          stats.missed.push(ws);
          byService.set(ws, [...(byService.get(ws) ?? []), cellLabel({ mc: m, cell: c })]);
        }
      }
      expected += stats.expected; missingCount += stats.missing;
      byCell.set(cellKey, stats);
    }

    const list = Array.from(byService, ([ws, missing]) => ({
      week: ws.slice(0, 10), service: ws.slice(11), missing: missing.sort(),
    })).sort((a, b) => b.week.localeCompare(a.week) || a.service.localeCompare(b.service));
    return { list, byCell, expected, missingCount, rate: expected ? ((expected - missingCount) / expected) * 100 : 100 };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, inScope, service, period, multiMc, mc, closures]);

  // ── Trend: a line per service, by service date, week or month ──
  const trend = useMemo(() => {
    const rows = new Map<string, TrendRow>();
    const row = (x: string) => {
      if (!rows.has(x)) rows.set(x, { x, dates: {}, n: {} });
      return rows.get(x)!;
    };
    const isService = (svc: string): svc is "MGS" | "LC LIVE" => svc === "MGS" || svc === "LC LIVE";

    if (trendView === "day") {
      // Each actual service date
      for (const r of filtered) {
        if (!isService(r.service)) continue;
        const e = row(r.date);
        e[r.service] = (e[r.service] ?? 0) + r.attendance;
      }
    } else if (trendView === "week") {
      // A week's MGS (Sun) and LC Live (Wed) share a point; misdated reports stay with their week
      for (const w of weekly) if (isService(w.service)) row(w.week)[w.service] = w.attendance;
      for (const r of filtered) {
        if (!isService(r.service)) continue;
        const e = row(weekStart(r.date));
        const ds = e.dates[r.service] ?? [];
        if (!ds.includes(r.date)) e.dates[r.service] = [...ds, r.date].sort();
      }
    } else {
      // Median service attendance in each month (by the service's own date)
      const per = new Map<string, number[]>();
      for (const w of weekly) {
        if (!isService(w.service)) continue;
        const d = new Date(`${w.week}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() + SERVICE_WEEKDAY[w.service]);
        const k = `${d.toISOString().slice(0, 7)}|${w.service}`;
        per.set(k, [...(per.get(k) ?? []), w.attendance]);
      }
      for (const [k, values] of Array.from(per)) {
        const [month, svc] = [k.slice(0, 7), k.slice(8) as "MGS" | "LC LIVE"];
        const e = row(month);
        e[svc] = median(values);
        e.n[svc] = values.length;
      }
    }
    return Array.from(rows.values()).sort((a, b) => a.x.localeCompare(b.x));
  }, [filtered, weekly, trendView]);
  const trendSeries = (["MGS", "LC LIVE"] as const).filter((s) => service === "all" || service === s);

  // ── Breakdown: median (and average) attendance per service, by MC / bacenta / cell ──
  const breakdown = useMemo(() => {
    const groups = new Map<string, Map<string, number>>(); // group → (week|service → attendance)
    const members = new Map<string, { cells: Set<string>; bacentas: Set<string>; mcs: Set<string> }>();
    for (const r of filtered) {
      const g = group === "mc" ? r.mc : group === "bacenta" ? r.bacenta : cellLabel(r);
      const k = `${weekStart(r.date)}|${r.service}`;
      const gm = groups.get(g) ?? new Map<string, number>();
      gm.set(k, (gm.get(k) ?? 0) + r.attendance);
      groups.set(g, gm);
      const m = members.get(g) ?? { cells: new Set<string>(), bacentas: new Set<string>(), mcs: new Set<string>() };
      m.cells.add(`${r.mc}|${r.cell}`); m.bacentas.add(r.bacenta); m.mcs.add(r.mc);
      members.set(g, m);
    }

    // Who leads each bar, from the church directory (shown in the hover card)
    const leaders = data && "leaders" in data ? data.leaders ?? {} : {};
    const pastors = data && "mcPastors" in data ? data.mcPastors ?? {} : {};
    const mostCommon = (xs: (string | null | undefined)[]) => {
      const n = new Map<string, number>();
      for (const x of xs) if (x) n.set(x, (n.get(x) ?? 0) + 1);
      return Array.from(n).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    };
    const metaFor = (name: string): [string, string][] => {
      const m = members.get(name)!;
      const cellKeys = Array.from(m.cells);
      const rows: [string, string | number | null][] =
        group === "mc" ? [
          ["MC pastor", pastors[name] ?? mostCommon(cellKeys.map((k) => leaders[k]?.mcPastor))],
          ["Bacentas", m.bacentas.size],
          ["Cells", m.cells.size],
        ] : group === "bacenta" ? [
          ["Bacenta head", mostCommon(cellKeys.map((k) => leaders[k]?.seniorShepherd))],
          ...(multiMc && !mc ? [["MC", Array.from(m.mcs).join(", ")] as [string, string]] : []),
          ["Cells", m.cells.size],
        ] : [
          ["Led by", leaders[cellKeys[0]]?.cellShepherd ?? null],
          ["Bacenta", Array.from(m.bacentas).join(", ")],
          ["Bacenta head", leaders[cellKeys[0]]?.seniorShepherd ?? null],
          ...(multiMc && !mc ? [["MC", Array.from(m.mcs).join(", ")] as [string, string]] : []),
        ];
      return rows.filter(([, v]) => v !== null && v !== "").map(([k, v]) => [k, String(v)]);
    };

    return Array.from(groups, ([name, gm]) => {
      const values = Array.from(gm.values());
      return { name, median: median(values), avg: Math.round(mean(values) * 10) / 10, meta: metaFor(name) };
    }).sort((a, b) => b.median - a.median || b.avg - a.avg);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, group, multiMc, mc, data]);

  // ── Monthly outreach ──
  const monthly = useMemo(() => {
    const m = new Map<string, { month: string; firstTimers: number; retained: number; soulsWon: number }>();
    for (const r of filtered) {
      const k = monthKey(r.date);
      const e = m.get(k) ?? { month: k, firstTimers: 0, retained: 0, soulsWon: 0 };
      e.firstTimers += r.firstTimers; e.retained += r.retained ?? 0; e.soulsWon += r.soulsWon;
      m.set(k, e);
    }
    return Array.from(m.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [filtered]);

  // ── Duplicate submissions in the current view (the counted report must be in scope) ──
  const dupById = useMemo(
    () => new Map((data && "duplicates" in data ? data.duplicates ?? [] : []).map((g) => [g.id, g])),
    [data],
  );
  const { visibleDupes, identicalDupes } = useMemo(() => {
    const ids = new Set(filtered.map((r) => r.id));
    const inView = Array.from(dupById.values()).filter((g) => ids.has(g.id));
    // Identical repeats are counted once and need no review; only differing ones are flagged
    return { visibleDupes: inView.filter((g) => !g.identical), identicalDupes: inView.filter((g) => g.identical).length };
  }, [dupById, filtered]);
  const flagged = (id: string) => { const g = dupById.get(id); return g && !g.identical ? g : undefined; };
  const [showAllDupes, setShowAllDupes] = useState(false);

  // Same cell + service on two dates in one week — both counted, shown for review
  const visiblePossible = useMemo(() => {
    const ids = new Set(filtered.map((r) => r.id));
    const list = data && "possibleDuplicates" in data ? data.possibleDuplicates ?? [] : [];
    return list.filter((g) => g.reports.some((r) => ids.has(r.id)));
  }, [data, filtered]);

  // ── Per-cell table ──
  const cellRows = useMemo(() => {
    const m = new Map<string, LegacyReport[]>();
    for (const r of filtered) { const k = `${r.mc}|${r.cell}`; m.set(k, [...(m.get(k) ?? []), r]); }
    const rows = Array.from(m, ([key, rs]) => ({
      key,
      cell: rs[0].cell,
      mc: rs[0].mc,
      bacenta: rs[0].bacenta,
      reports: rs.length,
      attendance:    median(rs.map((r) => r.attendance)),
      online:        median(rs.map((r) => r.online)),
      firstTimers: rs.reduce((a, r) => a + r.firstTimers, 0),
      retained: rs.reduce((a, r) => a + (r.retained ?? 0), 0),
      soulsWon: rs.reduce((a, r) => a + r.soulsWon, 0),
    }));
    const { key, dir } = cellSort;
    return rows.sort((a, b) => {
      const av = a[key], bv = b[key];
      return (typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number)) * dir;
    });
  }, [filtered, cellSort]);

  // ── Report list ──
  const PAGE = 20;
  const listed = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = q ? filtered.filter((r) => `${r.cell} ${r.bacenta} ${r.mc} ${r.service}`.toLowerCase().includes(q)) : filtered;
    // Date order (oldest first by default, like the sheet), then MC and cell
    return [...rows].sort((a, b) =>
      (a.date.localeCompare(b.date) || a.mc.localeCompare(b.mc) || a.cell.localeCompare(b.cell)) * (dateAsc ? 1 : -1));
  }, [filtered, query, dateAsc]);
  useEffect(() => { setPage(0); }, [query, filtered, dateAsc]);

  // ── Selected cell's info: leaders from the directory tab + facts from its reports ──
  const cellInfo = useMemo(() => {
    if (!cell || !data || !("reports" in data)) return null;
    const mine = all.filter((r) => r.cell === cell && (!mc || r.mc === mc) && (!bacenta || r.bacenta === bacenta));
    if (!mine.length) return null;
    const cellMc = mine[0].mc;
    const own = mine.filter((r) => r.mc === cellMc);
    const latest = own.reduce((a, b) => (a.date >= b.date ? a : b));
    const earliest = own.reduce((a, b) => (a.date <= b.date ? a : b));
    const inPeriod = filtered.filter((r) => r.mc === cellMc && r.cell === cell);
    const med = (svc: string) => {
      const v = inPeriod.filter((r) => r.service === svc).map((r) => r.attendance);
      return v.length ? median(v) : null;
    };
    const lead = data.leaders?.[`${cellMc}|${cell}`];
    return {
      mc:             cellMc,
      bacenta:        latest.bacenta,
      cellShepherd:   lead?.cellShepherd ?? null,
      seniorShepherd: lead?.seniorShepherd ?? null,
      mcPastor:       lead?.mcPastor ?? data.mcPastors?.[cellMc] ?? null,
      inDirectory:    !!lead,
      closure:        closures[`${cellMc}|${cell}`] ?? null,
      since:          earliest.date,
      latest,
      reports:        inPeriod.length,
      gap:            gaps.byCell.get(`${cellMc}|${cell}`) ?? null,
      mgsMedian:      med("MGS"),
      lcMedian:       med("LC LIVE"),
      firstTimers:    inPeriod.reduce((a, r) => a + r.firstTimers, 0),
      soulsWon:       inPeriod.reduce((a, r) => a + r.soulsWon, 0),
    };
  }, [cell, mc, bacenta, data, all, filtered, gaps, closures]);

  // ── Data integrity report for the current view ──
  const integrityInput = useMemo(() => {
    const ready = data && "reports" in data;
    const title = [
      mc || (multiMc ? "All MCs" : null),
      bacenta, cell,
      service === "all" ? null : service === "MGS" ? "MGS" : "LC Live",
      period === "all" ? "All time" : monthLabel(period),
    ].filter(Boolean).join(" · ");
    return {
      title,
      reports:    filtered,
      missed:     Array.from(gaps.byCell, ([key, st]) => {
        const sep = key.indexOf("|");
        return { mc: key.slice(0, sep), cell: key.slice(sep + 1), services: st.missed };
      }),
      duplicates: visibleDupes,
      possibleDuplicates: visiblePossible,
      unlisted:   ready ? data.unlisted ?? [] : [],
      ambiguous:  ready ? data.ambiguous ?? [] : [],
      leaders:    ready ? data.leaders ?? {} : {},
      multiMc,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, filtered, gaps, visibleDupes, visiblePossible, mc, bacenta, cell, service, period, multiMc]);
  const pageCount = Math.max(1, Math.ceil(listed.length / PAGE));

  function clearFilters() {
    setPeriod("all"); setService("all"); setMc(""); setBacenta(""); setCell(""); setActiveOnly(false);
  }
  const hasFilters = period !== "all" || service !== "all" || !!mc || !!bacenta || !!cell || activeOnly;

  // ── States ──
  if (roleLoading || !data) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1280px] mx-auto">
        <div className="skeleton h-8 w-48 mb-4 rounded-lg" />
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-4">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
        <div className="skeleton h-72 rounded-xl" />
      </div>
    );
  }

  const allFailed = data.configured && !("error" in data) && data.sources.every((s) => !s.ok);
  if (!data.configured || "error" in data || allFailed) {
    const message = !data.configured
      ? "No Google Sheets are connected yet."
      : "error" in data
      ? data.error
      : `None of the connected sheets could be read: ${data.sources.map((s) => `${s.name} — ${s.error}`).join(" · ")}`;
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[720px] mx-auto">
        <h1 className="text-[24px] font-semibold mb-4" style={{ color: "var(--brand-text)" }}>Legacy</h1>
        <div className="rounded-xl p-8 text-center flex flex-col items-center gap-3" style={{ border: "1px solid var(--brand-border)" }}>
          <SheetIcon style={{ width: 36, height: 36, color: "var(--brand-muted)" }} />
          <p className="text-[14px]" style={{ color: "var(--brand-text)" }}>{message}</p>
          <div className="flex gap-2">
            <Link href="/settings">
              <Button className="h-9 text-[13px]" style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}>
                Open Settings
              </Button>
            </Link>
            {data.configured && (
              <Button variant="outline" onClick={() => load(true)} className="h-9 text-[13px]" style={{ borderRadius: 8 }}>
                Try again
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const unlisted  = data.unlisted ?? [];
  const ambiguous = data.ambiguous ?? [];
  const issueNotes = [
    data.issues.duplicatesRemoved && `${data.issues.duplicatesRemoved} repeat submission${data.issues.duplicatesRemoved === 1 ? "" : "s"} not counted (identical repeats merged; differing ones listed under Duplicate submissions)`,
    data.issues.valuesCleaned && `${data.issues.valuesCleaned} non-numeric values read as numbers`,
    data.issues.datesFixed && `${data.issues.datesFixed} mistyped year${data.issues.datesFixed === 1 ? "" : "s"} corrected`,
    unlisted.length && `${unlisted.length} cell${unlisted.length === 1 ? " isn't" : "s aren't"} in the directory, so ${unlisted.length === 1 ? "its" : "their"} MC and bacenta come from the sheet and form (${unlisted.join(", ")})`,
    ambiguous.length && `${ambiguous.length} cell name${ambiguous.length === 1 ? " appears" : "s appear"} more than once in the directory — give ${ambiguous.length === 1 ? "it" : "them"} distinct names (${ambiguous.join(", ")})`,
  ].filter(Boolean) as string[];

  const failing: { name: string; error?: string }[] = [
    ...data.sources.filter((s) => !s.ok),
    ...(data.church?.error ? [{ name: "Church directory", error: data.church.error }] : []),
  ];

  const sortHeader = (key: CellSortKey, label: string, align: "left" | "right" = "right") => (
    <th className={`px-3 py-2 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      <button onClick={() => setCellSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "cell" || key === "bacenta" || key === "mc" ? 1 : -1 }))}
              className="inline-flex items-center gap-1 hover:underline">
        {label}
        <ArrowUpDown className="h-3 w-3" style={{ opacity: cellSort.key === key ? 1 : 0.35 }} />
      </button>
    </th>
  );

  const gapsShown = showAllGaps ? gaps.list : gaps.list.slice(0, 6);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1280px] mx-auto pb-20 lg:pb-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h1 className="text-[24px] font-semibold" style={{ color: "var(--brand-text)" }}>Legacy</h1>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--brand-muted)" }}>
            {data.label ?? "Cell service reports"} · {multiMc ? `${mcs.length} MCs · ` : ""}{fmt(all.length)} reports · updated{" "}
            {new Date(data.fetchedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowReport(true)} className="h-9 text-[13px]" style={{ borderRadius: 8 }}>
            <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" /> Integrity report
          </Button>
          <Link href="/settings">
            <Button variant="outline" className="h-9 text-[13px]" style={{ borderRadius: 8 }}>
              <SheetIcon className="h-3.5 w-3.5 mr-1.5" /> Sheets
            </Button>
          </Link>
          <Button variant="outline" onClick={() => load(true)} disabled={refreshing} className="h-9 text-[13px]" style={{ borderRadius: 8 }}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {failing.length > 0 && (
        <div className="rounded-lg px-3 py-2.5 mb-4 text-[12px] flex items-start gap-1.5"
             style={{ background: "var(--tint-warn-bg)", color: "var(--tint-warn-fg)" }}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            Couldn&apos;t read: {failing.map((s) => `${s.name} (${s.error})`).join(" · ")}.{" "}
            <Link href="/settings" className="underline">Check the sheets</Link>
          </span>
        </div>
      )}

      {/* ── Filters: one row, scoping everything below ── */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <select aria-label="Period" value={period} onChange={(e) => setPeriod(e.target.value)}
                className="h-9 px-3 text-[13px] rounded-lg" style={selectStyle}>
          <option value="all">All time</option>
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        <Segmented<ServiceFilter> ariaLabel="Service" value={service} onChange={setService}
          options={[{ key: "all", label: "All services" }, { key: "MGS", label: "MGS" }, { key: "LC LIVE", label: "LC Live" }]} />
        {multiMc && (
          <select aria-label="MC" value={mc} onChange={(e) => { setMc(e.target.value); setBacenta(""); setCell(""); }}
                  className="h-9 px-3 text-[13px] rounded-lg" style={selectStyle}>
            <option value="">All MCs</option>
            {mcs.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
        <select aria-label="Bacenta" value={bacenta} onChange={(e) => { setBacenta(e.target.value); setCell(""); }}
                className="h-9 px-3 text-[13px] rounded-lg" style={selectStyle}>
          <option value="">All bacentas</option>
          {bacentas.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select aria-label="Cell" value={cell} onChange={(e) => setCell(e.target.value)}
                className="h-9 px-3 text-[13px] rounded-lg" style={selectStyle}>
          <option value="">All cells</option>
          {cells.map((c) => <option key={c} value={c}>{c}{isCollapsed(c) ? " (collapsed)" : ""}</option>)}
        </select>
        {collapsedCount > 0 && (
          <label className="h-9 px-3 inline-flex items-center gap-2 rounded-lg text-[13px] cursor-pointer select-none"
                 style={{ border: "1px solid var(--brand-border)", background: "var(--surface)", color: "var(--brand-text)" }}
                 title="Hide collapsed cells and all their reports">
            <Switch checked={activeOnly} onCheckedChange={setActiveOnly} aria-label="Active cells only" />
            Active cells only
            {activeOnly && (
              <span className="text-[11px]" style={{ color: "var(--brand-muted)" }}>
                · {collapsedCount} collapsed hidden
              </span>
            )}
          </label>
        )}
        {hasFilters && (
          <button onClick={clearFilters} className="h-9 px-2 text-[12px] font-medium inline-flex items-center gap-1 hover:underline"
                  style={{ color: "var(--brand-link)" }}>
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4 transition-opacity" style={{ opacity: refreshing ? 0.6 : 1 }}>
        {filtered.length === 0 ? (
          <div className="rounded-xl p-10 text-center" style={{ border: "1px solid var(--brand-border)" }}>
            <p className="text-[14px]" style={{ color: "var(--brand-text)" }}>No reports match these filters.</p>
            <button onClick={clearFilters} className="text-[13px] mt-1 hover:underline" style={{ color: "var(--brand-link)" }}>
              Clear filters
            </button>
          </div>
        ) : (
          <>
            {/* ── Headline numbers ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              {service !== "LC LIVE" && (
                <Stat label="MGS attendance" value={fmt(stats.mgsMedian)}
                      sub={`median · avg ${fmt(stats.mgsAvg)} · ${stats.mgsCount} Sunday${stats.mgsCount === 1 ? "" : "s"}`} />
              )}
              {service !== "MGS" && (
                <Stat label="LC Live attendance" value={fmt(stats.lcMedian)}
                      sub={`median · avg ${fmt(stats.lcAvg)} · ${stats.lcCount} service${stats.lcCount === 1 ? "" : "s"}`} />
              )}
              <Stat label="Online per service" value={fmt(stats.onlineMedian)}
                    sub={`median · avg ${fmt(stats.onlineAvg, 1)}`} />
              <Stat label="First timers" value={fmt(stats.firstTimers)}
                    sub={`${fmt(stats.retained)} retained (${fmt(stats.retentionPct)}%)`} />
              <Stat label="Souls won" value={fmt(stats.soulsWon)} />
              <Stat label="Reports received" value={`${fmt(gaps.rate)}%`}
                    sub={gaps.missingCount ? `${fmt(gaps.missingCount)} missing` : "none missing"} />
            </div>

            {/* ── Attendance trend ── */}
            <Card title={`Attendance by ${trendView === "day" ? "service date" : trendView}`}
                  subtitle={trendView === "day"
                    ? "Total in-person attendance on each service date, across the selected cells"
                    : trendView === "week"
                    ? "Total in-person attendance per week — a week's MGS (Sun) and LC Live (Wed) share a point; hover for the dates"
                    : "Median in-person attendance per service, each month"}
                  action={
                    <div className="flex flex-col items-end gap-2">
                      <Segmented<TrendView> ariaLabel="Group the trend by" value={trendView} onChange={setTrendView}
                        options={[{ key: "day", label: "Day" }, { key: "week", label: "Week" }, { key: "month", label: "Month" }]} />
                      {trendSeries.length > 1 && (
                        <Legend mark="line" items={trendSeries.map((s) => ({ label: s === "MGS" ? "MGS" : "LC Live", color: SERVICE_COLOR[s] }))} />
                      )}
                    </div>
                  }>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                    <CartesianGrid stroke="var(--brand-border)" vertical={false} />
                    <XAxis dataKey="x" tickFormatter={(x) => (trendView === "month" ? formatMonth(x) : formatDay(x))} tick={AXIS_TICK}
                           tickLine={false} axisLine={{ stroke: "var(--brand-border)" }} minTickGap={24} />
                    <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip cursor={{ stroke: "var(--brand-muted)", strokeWidth: 1 }}
                             content={<TrendTooltip view={trendView} />} />
                    {trendSeries.map((s) => (
                      // Straight segments: smoothing would invent values between services.
                      // By date the two services never share a day, so each line bridges the other's dates.
                      <Line key={s} type="linear" dataKey={s} name={s === "MGS" ? "MGS" : "LC Live"}
                            stroke={SERVICE_COLOR[s]} strokeWidth={2}
                            dot={trendView === "week" ? false : { r: 2.5, strokeWidth: 0, fill: SERVICE_COLOR[s] }}
                            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
                            connectNulls={trendView === "day"} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* ── Breakdown ── */}
              <Card title={`Attendance by ${group === "mc" ? "MC" : group}`} subtitle="Median per service, in person · hover for the average · click a bar to filter"
                    action={!cell && (
                      <Segmented<GroupBy> ariaLabel="Group by" value={group} onChange={setGroupBy}
                        options={[
                          ...(multiMc && !mc ? [{ key: "mc" as const, label: "MC" }] : []),
                          { key: "bacenta", label: "Bacenta" },
                          { key: "cell", label: "Cell" },
                        ]} />
                    )}>
                <div style={{ height: Math.max(160, breakdown.length * 34 + 16) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={breakdown} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
                              barCategoryGap={6}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" width={group === "cell" && multiMc && !mc ? 130 : 92} tick={{ ...AXIS_TICK, fill: "var(--brand-text)" }}
                             tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: "var(--brand-navy-light)" }} content={<BreakdownTooltip />} />
                      <Bar dataKey="median" name="median per service" fill={SERIES.mgs} radius={[0, 4, 4, 0]} cursor="pointer"
                           onClick={(d: { name?: string }) => {
                             if (!d?.name) return;
                             if (group === "mc") { setMc(d.name); setBacenta(""); setCell(""); return; }
                             if (group === "bacenta") { setBacenta(d.name); setCell(""); return; }
                             const r = filtered.find((x) => cellLabel(x) === d.name);
                             if (r) { setMc(multiMc ? r.mc : ""); setBacenta(r.bacenta); setCell(r.cell); }
                           }}>
                        <LabelList dataKey="median" position="right" style={{ fontSize: 11, fill: "var(--brand-text)" }}
                                   formatter={(v: number) => fmt(v)} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* ── Monthly outreach ── */}
              <Card title="Outreach by month"
                    subtitle="Retained first timers are recorded after the last service of each month"
                    action={<Legend mark="rect" items={[
                      { label: "First timers", color: SERIES.mgs },
                      { label: "Retained", color: SERIES.lc },
                      { label: "Souls won", color: SERIES.third },
                    ]} />}>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthly} margin={{ top: 8, right: 4, bottom: 0, left: -16 }} barGap={2} barCategoryGap="22%">
                      <CartesianGrid stroke="var(--brand-border)" vertical={false} />
                      <XAxis dataKey="month" tickFormatter={(m) => formatMonth(m)} tick={AXIS_TICK} tickLine={false}
                             axisLine={{ stroke: "var(--brand-border)" }} />
                      <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip cursor={{ fill: "var(--brand-navy-light)" }} content={<ChartTooltip title={(m) => formatMonth(m, true)} />} />
                      <Bar dataKey="firstTimers" name="First timers" fill={SERIES.mgs} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="retained" name="Retained" fill={SERIES.lc} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="soulsWon" name="Souls won" fill={SERIES.third} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            {/* ── Missing reports ── */}
            <Card title="Missing reports"
                  subtitle={gaps.list.length
                    ? `${fmt(gaps.missingCount)} reports not submitted across ${gaps.list.length} services`
                    : "Every cell reported for every service in this period"}>
              {gaps.list.length > 0 && (
                <>
                  <ul className="flex flex-col">
                    {gapsShown.map((g) => (
                      <li key={`${g.week}|${g.service}`} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 py-2"
                          style={{ borderTop: "1px solid var(--brand-border)" }}>
                        <span className="text-[13px] w-[170px] shrink-0" style={{ color: "var(--brand-text)" }}>
                          <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: SERVICE_COLOR[g.service] ?? "var(--brand-muted)" }} />
                          {g.service === "MGS" ? "MGS" : "LC Live"} · wk of {formatDay(g.week)}
                        </span>
                        <span className="flex flex-wrap gap-1">
                          {g.missing.map((c) => (
                            <span key={c} className="rounded-pill text-[11px] font-medium px-2 py-0.5"
                                  style={{ background: "var(--tint-warn-bg)", color: "var(--tint-warn-fg)" }}>{c}</span>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {gaps.list.length > 6 && (
                    <button onClick={() => setShowAllGaps((v) => !v)} className="self-start text-[12px] font-medium hover:underline"
                            style={{ color: "var(--brand-link)" }}>
                      {showAllGaps ? "Show fewer" : `Show all ${gaps.list.length}`}
                    </button>
                  )}
                </>
              )}
            </Card>

            {/* ── Duplicate submissions: flagged for review ── */}
            {(visibleDupes.length > 0 || visiblePossible.length > 0) && (
              <Card title="Duplicate submissions"
                    subtitle={visibleDupes.length
                      ? `${visibleDupes.length} service${visibleDupes.length === 1 ? " was" : "s were"} reported more than once with different numbers. Only the latest submission is counted — delete the wrong row in the sheet (or correct its date) to clear the flag.${identicalDupes ? ` ${identicalDupes} identical repeat${identicalDupes === 1 ? " was" : "s were"} also found and counted once — nothing to review.` : ""}`
                      : "No exact duplicates — but see the possible ones below."}>
                <ul className="flex flex-col gap-3">
                  {(showAllDupes ? visibleDupes : visibleDupes.slice(0, 4)).map((g) => {
                    const counted = filtered.find((r) => r.id === g.id);
                    return (
                      <li key={g.id} className="rounded-lg p-3 flex flex-col gap-2" style={{ border: "1px solid var(--tint-warn-border)", background: "var(--tint-warn-soft)" }}>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <AlertTriangle className="h-3.5 w-3.5" style={{ color: "var(--tint-warn-fg)" }} />
                          <button onClick={() => counted && setSelected(counted)}
                                  className="text-[13px] font-medium hover:underline" style={{ color: "var(--brand-text)" }}>
                            {cellLabel({ cell: g.cell, mc: counted?.mc ?? g.source })} ·{" "}
                            {g.service === "MGS" ? "MGS" : g.service === "LC LIVE" ? "LC Live" : g.service} ·{" "}
                            {formatDay(g.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                          </button>
                          <span className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
                            {g.submissions.length} submissions · {g.source} sheet
                          </span>
                        </div>
                        <div className="bg-[var(--surface)] rounded-md"><DuplicateTable group={g} /></div>
                      </li>
                    );
                  })}
                </ul>
                {visibleDupes.length > 4 && (
                  <button onClick={() => setShowAllDupes((v) => !v)} className="self-start text-[12px] font-medium hover:underline"
                          style={{ color: "var(--brand-link)" }}>
                    {showAllDupes ? "Show fewer" : `Show all ${visibleDupes.length}`}
                  </button>
                )}

                {visiblePossible.length > 0 && (
                  <div className="flex flex-col gap-2 pt-3" style={{ borderTop: visibleDupes.length ? "1px solid var(--brand-border)" : "none" }}>
                    <div>
                      <p className="text-[13px] font-semibold" style={{ color: "var(--brand-text)" }}>
                        Possibly the same service ({visiblePossible.length})
                      </p>
                      <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
                        The same cell reported this service on two different dates in one week. <b>Both are counted.</b>{" "}
                        If one was given the wrong date, correct it in the sheet; if both were real services, nothing to do.
                      </p>
                    </div>
                    <ul className="flex flex-col">
                      {visiblePossible.map((g) => {
                        const svc = g.service === "MGS" ? "MGS" : g.service === "LC LIVE" ? "LC Live" : g.service;
                        const first = filtered.find((r) => r.id === g.reports[0].id);
                        return (
                          <li key={g.key} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-2"
                              style={{ borderTop: "1px solid var(--brand-border)" }}>
                            <span className="text-[13px] font-medium sm:w-[210px] shrink-0" style={{ color: "var(--brand-text)" }}>
                              {cellLabel({ cell: g.cell, mc: first?.mc ?? g.source })} · {svc}
                            </span>
                            <span className="flex flex-wrap gap-1.5">
                              {g.reports.map((r) => {
                                const report = filtered.find((x) => x.id === r.id);
                                return (
                                  <button key={r.id} onClick={() => report && setSelected(report)}
                                          className="rounded-pill text-[11px] font-medium px-2 py-0.5 hover:underline"
                                          style={{ background: "var(--tint-warn-bg)", color: "var(--tint-warn-fg)" }}>
                                    {formatDay(r.date, { weekday: "short", day: "numeric", month: "short" })} · {r.attendance} in person
                                  </button>
                                );
                              })}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </Card>
            )}

            {/* ── Per-cell table ── */}
            <Card title="Cells" subtitle="Median per report in the selected period">
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full text-[13px] min-w-[640px]">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-[0.04em]" style={{ color: "var(--brand-muted)" }}>
                      {sortHeader("cell", "Cell", "left")}
                      {multiMc && sortHeader("mc", "MC", "left")}
                      {sortHeader("bacenta", "Bacenta", "left")}
                      {sortHeader("reports", "Reports")}
                      {sortHeader("attendance", "Attendance")}
                      {sortHeader("online", "Online")}
                      {sortHeader("firstTimers", "First timers")}
                      {sortHeader("retained", "Retained")}
                      {sortHeader("soulsWon", "Souls won")}
                    </tr>
                  </thead>
                  <tbody>
                    {cellRows.map((c) => (
                      <tr key={c.key} onClick={() => { if (multiMc) setMc(c.mc); setBacenta(c.bacenta); setCell(c.cell); }}
                          className="cursor-pointer hover:bg-[var(--brand-navy-light)]"
                          style={{ borderTop: "1px solid var(--brand-border)", color: "var(--brand-text)" }}>
                        <td className="px-3 py-2 font-medium">
                          {c.cell}
                          {closures[`${c.mc}|${c.cell}`] && (
                            <span className="ml-1.5 rounded-pill text-[10px] font-semibold px-1.5 py-0.5 align-middle"
                                  title={`Collapsed ${closures[`${c.mc}|${c.cell}`].inferred ? "after its last report on" : "on"} ${formatDay(closures[`${c.mc}|${c.cell}`].on, { day: "numeric", month: "short", year: "numeric" })}`}
                                  style={{ background: "var(--gray-100)", color: "var(--brand-muted)" }}>
                              Collapsed
                            </span>
                          )}
                        </td>
                        {multiMc && <td className="px-3 py-2" style={{ color: "var(--brand-muted)" }}>{c.mc}</td>}
                        <td className="px-3 py-2" style={{ color: "var(--brand-muted)" }}>{c.bacenta}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{c.reports}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(c.attendance)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(c.online)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{c.firstTimers}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{c.retained}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{c.soulsWon}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* ── Cell breakdown: one row per report, the sheet's columns ── */}
            <Card title={cell ? `${cell} breakdown` : "Cell breakdown"}
                  subtitle={`${fmt(listed.length)} report${listed.length === 1 ? "" : "s"} in this period · click one for details`}
                  action={cell ? (
                    <Button variant="outline" onClick={() => setShowInfo((v) => !v)} aria-expanded={showInfo}
                            className="h-8 text-[12px] shrink-0" style={{ borderRadius: 8 }}>
                      <Info className="h-3.5 w-3.5 mr-1.5" /> {showInfo ? "Hide info" : "View info"}
                    </Button>
                  ) : (
                    <div className="relative w-[180px] sm:w-[220px]">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "var(--brand-muted)" }} />
                      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={multiMc ? "Search cell, bacenta or MC" : "Search cell or bacenta"}
                             aria-label="Search reports" className="h-8 pl-8 text-[13px]" style={{ borderColor: "var(--brand-border)" }} />
                    </div>
                  )}>
              {cell && showInfo && cellInfo && <CellInfoPanel cell={cell} info={cellInfo} />}
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className={`w-full text-[13px] ${cell ? "min-w-[860px]" : "min-w-[1080px]"}`}>
                  <thead>
                    <tr className="text-[11px] uppercase tracking-[0.04em] text-left align-bottom" style={{ color: "var(--brand-muted)" }}>
                      <th className="px-3 py-2 font-medium">
                        <button onClick={() => setDateAsc((v) => !v)} className="inline-flex items-center gap-1 hover:underline"
                                aria-label={`Date, ${dateAsc ? "oldest" : "newest"} first`}>
                          Date <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="px-3 py-2 font-medium">Service type</th>
                      {!cell && <th className="px-3 py-2 font-medium">Cell</th>}
                      {!cell && multiMc && <th className="px-3 py-2 font-medium">MC</th>}
                      {!cell && <th className="px-3 py-2 font-medium">Bacenta</th>}
                      <th className="px-3 py-2 font-medium text-right">Pastors</th>
                      <th className="px-3 py-2 font-medium text-right">Senior shepherds</th>
                      <th className="px-3 py-2 font-medium text-right">Cell shepherd</th>
                      <th className="px-3 py-2 font-medium text-right">Shepherds</th>
                      <th className="px-3 py-2 font-medium text-right">Members</th>
                      <th className="px-3 py-2 font-medium text-right">First timers</th>
                      <th className="px-3 py-2 font-medium text-right">First timers retained</th>
                      <th className="px-3 py-2 font-medium text-right">Total</th>
                      <th className="px-3 py-2 font-medium text-right">Souls won</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listed.slice(page * PAGE, page * PAGE + PAGE).map((r) => (
                      <tr key={r.id} onClick={() => setSelected(r)} tabIndex={0}
                          onKeyDown={(e) => { if (e.key === "Enter") setSelected(r); }}
                          className="cursor-pointer hover:bg-[var(--brand-navy-light)] focus:bg-[var(--brand-navy-light)] outline-none"
                          style={{ borderTop: "1px solid var(--brand-border)", color: "var(--brand-text)" }}>
                        <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                          {formatDay(r.date, { day: "numeric", month: "short", year: "numeric" })}
                          {flagged(r.id) && (
                            <span title={`Submitted ${flagged(r.id)!.submissions.length} times with different numbers — only the latest is counted`}
                                  className="ml-1.5 inline-flex items-center gap-0.5 rounded-pill text-[10px] font-semibold px-1.5 py-0.5 align-middle"
                                  style={{ background: "var(--tint-warn-bg)", color: "var(--tint-warn-fg)" }}>
                              <AlertTriangle className="h-2.5 w-2.5" /> ×{flagged(r.id)!.submissions.length}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: SERVICE_COLOR[r.service] ?? "var(--brand-muted)" }} />
                          {r.service === "MGS" ? "MGS" : r.service === "LC LIVE" ? "LC Live" : r.service}
                        </td>
                        {!cell && <td className="px-3 py-2 font-medium">{r.cell}</td>}
                        {!cell && multiMc && <td className="px-3 py-2" style={{ color: "var(--brand-muted)" }}>{r.mc}</td>}
                        {!cell && <td className="px-3 py-2" style={{ color: "var(--brand-muted)" }}>{r.bacenta}</td>}
                        <td className="px-3 py-2 text-right tabular-nums">{r.pastor}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.seniorShepherd}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.cellShepherd}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.shepherds}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.members}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.firstTimers}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.retained ?? ""}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">{r.attendance}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.soulsWon}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pageCount > 1 && (
                <div className="flex items-center justify-end gap-2 text-[12px]" style={{ color: "var(--brand-muted)" }}>
                  Page {page + 1} of {pageCount}
                  <button aria-label="Previous page" disabled={page === 0} onClick={() => setPage((p) => p - 1)}
                          className="p-1 rounded hover:bg-[var(--brand-navy-light)] disabled:opacity-30">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button aria-label="Next page" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}
                          className="p-1 rounded hover:bg-[var(--brand-navy-light)] disabled:opacity-30">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </Card>
          </>
        )}

        {/* ── Data notes ── */}
        {issueNotes.length > 0 && (
          <p className="text-[12px] flex items-start gap-1.5" style={{ color: "var(--brand-muted)" }}>
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            Cleaned from the sheet: {issueNotes.join(" · ")}.
          </p>
        )}
        {gaps.rate < 50 && filtered.length > 0 && (
          <p className="text-[12px] flex items-start gap-1.5" style={{ color: "var(--tint-warn-fg)" }}>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            Fewer than half the expected reports are in for this period, so these figures may be understated.
          </p>
        )}
      </div>

      <LegacyIntegritySheet open={showReport} onClose={() => setShowReport(false)} input={integrityInput} />
      <ReportSheet report={selected} duplicate={selected ? flagged(selected.id) : undefined} onClose={() => setSelected(null)} />
    </div>
  );
}
