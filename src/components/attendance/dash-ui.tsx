"use client";

import type { TooltipProps } from "recharts";
import { formatDay, formatMonth, targetColor, TYPE_LABEL, type Metric, type SvcType, type TargetResult, type TrendRow, type TrendView, type BreakdownRow } from "@/lib/attendance-dashboard";

// Presentation pieces for the attendance dashboard — the same look as the Legacy dashboard.

// Colour slots (CSS vars switch to the validated dark-mode steps under .dark)
export const SERIES = { MGS: "var(--series-1)", LC_LIVE: "var(--series-2)", third: "var(--series-3)" } as const;
export const AXIS_TICK = { fontSize: 11, fill: "var(--brand-muted)" };
export const selectStyle = { border: "1px solid var(--brand-border)", color: "var(--brand-text)", background: "var(--surface)" };

export const fmt = (n: number, digits = 0) =>
  n.toLocaleString("en-GB", { maximumFractionDigits: digits, minimumFractionDigits: 0 });

export function Card({ title, subtitle, action, children }: {
  title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="bg-[var(--surface)] rounded-xl p-4 sm:p-5 flex flex-col gap-3 min-w-0" style={{ border: "1px solid var(--brand-border)" }}>
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

export function Stat({ label, value, sub, color }: { label: string; value: string; sub?: React.ReactNode; color?: string }) {
  return (
    <div className="bg-[var(--surface)] rounded-xl p-4 flex flex-col gap-2 min-w-0" style={{ border: "1px solid var(--brand-border)" }}>
      <span className="text-[11px] font-medium uppercase tracking-[0.04em] leading-tight" style={{ color: "var(--brand-muted)" }}>{label}</span>
      <span className="text-[28px] font-semibold leading-none" style={{ color: color ?? "var(--brand-text)" }}>{value}</span>
      {sub && <div className="text-[12px] flex flex-col gap-0.5" style={{ color: "var(--brand-muted)" }}>{sub}</div>}
    </div>
  );
}

/** Up / down against the previous service */
export function Delta({ n }: { n: number }) {
  if (n === 0) return <span style={{ color: "var(--brand-muted)" }}>no change</span>;
  return <span className="font-medium" style={{ color: n > 0 ? "var(--brand-success)" : "var(--brand-danger)" }}>{n > 0 ? "▲" : "▼"} {Math.abs(n)}</span>;
}

/** A line in a tile that needs attention */
export function Attention({ children }: { children: React.ReactNode }) {
  return <span className="font-medium" style={{ color: "var(--brand-warning)" }}>{children}</span>;
}

export function Segmented<T extends string>({ value, options, onChange, ariaLabel }: {
  value: T; options: { key: T; label: string }[]; onChange: (v: T) => void; ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-lg overflow-hidden shrink-0" style={{ border: "1px solid var(--brand-border)" }}>
      {options.map((o) => (
        <button key={o.key} role="radio" aria-checked={value === o.key} onClick={() => onChange(o.key)}
                className="px-3 h-9 text-[12px] font-medium transition-colors whitespace-nowrap"
                style={value === o.key ? { background: "var(--brand-navy)", color: "#fff" } : { background: "var(--surface)", color: "var(--brand-muted)" }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Legend that mirrors the mark: short line for lines, square for bars. */
export function Legend({ items, mark }: { items: { label: string; color: string }[]; mark: "line" | "rect" }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--brand-muted)" }}>
          <span style={mark === "line" ? { width: 14, height: 2, borderRadius: 1, background: i.color } : { width: 10, height: 10, borderRadius: 2, background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

const tipBox = "rounded-lg px-3 py-2 bg-[var(--surface)] shadow-md text-[12px]";
const tipStyle = { border: "1px solid var(--brand-border)" };
const show = (v: unknown, metric: Metric) => (v == null ? "—" : metric === "rate" ? `${fmt(Number(v))}%` : fmt(Number(v)));

/** Value first, then which actual service dates sit behind it. */
export function TrendTooltip({ active, payload, label, view, metric }: TooltipProps<number, string> & { view: TrendView; metric: Metric }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as TrendRow;
  const x = String(label);
  const title = view === "month" ? formatMonth(x, true)
    : view === "week" ? `Week of ${formatDay(x, { day: "numeric", month: "long" })}`
    : formatDay(x, { weekday: "long", day: "numeric", month: "long" });
  return (
    <div className={tipBox} style={tipStyle}>
      <p className="mb-1 font-medium" style={{ color: "var(--brand-text)" }}>{title}</p>
      {payload.map((p) => {
        const svc = String(p.dataKey) as SvcType;
        const detail = view === "week"
          ? (row.dates[svc] ?? []).map((d) => formatDay(d, { weekday: "short", day: "numeric", month: "short" })).join(", ")
          : view === "month" && row.n[svc] ? `${metric === "present" ? "median of " : ""}${row.n[svc]} service${row.n[svc] === 1 ? "" : "s"}` : "";
        return (
          <p key={svc} className="flex items-center gap-2">
            <span style={{ width: 10, height: 2, background: p.color, borderRadius: 1 }} />
            <b style={{ color: "var(--brand-text)" }}>{show(p.value, metric)}</b>
            <span style={{ color: "var(--brand-muted)" }}>{TYPE_LABEL[svc]}{detail ? ` · ${detail}` : ""}</span>
          </p>
        );
      })}
    </div>
  );
}

export function BreakdownTooltip({ active, payload, metric }: TooltipProps<number, string> & { metric: Metric }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as BreakdownRow;
  return (
    <div className={`${tipBox} max-w-[260px]`} style={tipStyle}>
      <p className="mb-1 font-medium" style={{ color: "var(--brand-text)" }}>{d.name}</p>
      <p className="flex items-center gap-2">
        <span style={{ width: 10, height: 2, background: SERIES.MGS, borderRadius: 1 }} />
        <b style={{ color: "var(--brand-text)" }}>{show(d.value, metric)}</b>
        <span style={{ color: "var(--brand-muted)" }}>
          {metric === "rate" ? "of members present" : d.roster ? "median members present" : "median attending per service"}
        </span>
      </p>
      {d.roster ? (
        <p className="pl-[18px]" style={{ color: "var(--brand-muted)" }}>
          {metric === "rate" ? `median ${fmt(d.median)} present` : `${d.rate}% of members present`} · {d.roster.present} of {d.roster.marked} marked · {d.services} service{d.services === 1 ? "" : "s"}
        </p>
      ) : (
        <p className="pl-[18px]" style={{ color: "var(--brand-muted)" }}>
          {metric === "rate" ? `median ${fmt(d.median)} attending` : `${d.rate}% of members present`} · {d.services} service{d.services === 1 ? "" : "s"}
          {d.cells > 1 ? ` · ${d.cells} cells` : ""} · {d.firstTimers} first timer{d.firstTimers === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}

export function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className={tipBox} style={tipStyle}>
      <p className="mb-1 font-medium" style={{ color: "var(--brand-text)" }}>{formatMonth(String(label), true)}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2">
          <span style={{ width: 10, height: 2, background: p.color, borderRadius: 1 }} />
          <b style={{ color: "var(--brand-text)" }}>{p.value == null ? "—" : fmt(Number(p.value))}</b>
          <span style={{ color: "var(--brand-muted)" }}>{p.name}</span>
        </p>
      ))}
    </div>
  );
}

/** One service type measured against its target: median vs target, how often it was met, and the latest result. */
export function TargetCard({ label, unit, r }: { label: string; unit: string; r: TargetResult }) {
  const color = targetColor(r.status);
  const pct = r.target ? Math.min(100, Math.round((r.median / r.target) * 100)) : 0;
  const gap = r.median - r.target;
  const pill = r.status === "met" ? "On target" : r.status === "close" ? "Close" : r.status === "below" ? "Below target" : "No data";
  return (
    <div className="flex flex-col gap-2.5 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold" style={{ color: "var(--brand-text)" }}>{label}</h3>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: "var(--brand-navy-light)", color }}>{pill}</span>
      </div>
      {r.status === "none" ? (
        <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>Nothing recorded yet.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-[28px] font-semibold leading-none tabular-nums" style={{ color }}>{fmt(r.median)}</span>
            <span className="text-[13px]" style={{ color: "var(--brand-muted)" }}>median of {r.target} target</span>
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: 8, background: "var(--brand-border)" }} role="img"
               aria-label={`${label}: median ${r.median} against a target of ${r.target}`}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
          </div>
          <p className="text-[12px]" style={{ color: "var(--brand-text)" }}>
            {gap >= 0 ? (gap === 0 ? "Exactly on target" : `${fmt(gap)} above target`) : `${fmt(-gap)} short of target`}
            <span style={{ color: "var(--brand-muted)" }}> · average {fmt(r.average, 1)}</span>
          </p>
          <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
            Target met in {r.met} of {r.services} {unit}{r.services === 1 ? "" : "s"}
            {r.latest ? ` · latest ${fmt(r.latest.attended)} on ${formatDay(r.latest.date)}` : ""}
          </p>
        </>
      )}
    </div>
  );
}
