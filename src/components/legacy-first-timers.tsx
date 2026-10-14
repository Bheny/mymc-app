"use client";

import { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { AlertTriangle, Info } from "lucide-react";
import { Card, Stat } from "@/components/legacy-ui";
import {
  buildFirstTimerNotes, filterFirstTimers, summariseFirstTimers,
  type FirstTimerIssues, type FirstTimerRow, type Tally,
} from "@/lib/legacy-first-timers";

const fmt = (n: number) => n.toLocaleString("en-GB");
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
const AXIS_TICK = { fontSize: 11, fill: "var(--brand-muted)" };

// Follow-up status colours (reserved status colours; every use also has a label or number)
const STATUS_FILL = {
  established: "var(--brand-success)",
  working:     "var(--amber-600)",
  cannot:      "var(--brand-danger)",
  none:        "var(--gray-400)",
} as const;

/** A thin stacked bar: how a group's first timers split by follow-up status. */
function StatusBar({ established, working, cannot, none }: { established: number; working: number; cannot: number; none: number }) {
  const total = established + working + cannot + none;
  if (!total) return null;
  const seg = (n: number, color: string, label: string) =>
    n > 0 && <span key={label} title={`${label}: ${n}`} style={{ width: `${(n / total) * 100}%`, background: color }} />;
  return (
    <span className="flex h-2 rounded-pill overflow-hidden w-full min-w-[80px]" style={{ background: "var(--brand-border)" }} role="img"
          aria-label={`${established} established, ${working} being worked on, ${cannot} cannot work with, ${none} not recorded`}>
      {seg(established, STATUS_FILL.established, "Established")}
      {seg(working, STATUS_FILL.working, "Working on")}
      {seg(cannot, STATUS_FILL.cannot, "Cannot work with")}
      {seg(none, STATUS_FILL.none, "Not recorded")}
    </span>
  );
}

/** Ranked list with a proportional bar behind each row — lighter than a chart for long labels. */
function BarList({ items, limit = 8 }: { items: Tally[]; limit?: number }) {
  const shown = items.slice(0, limit);
  const max = Math.max(1, ...shown.map((i) => i.count));
  if (!shown.length) return <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>Nothing recorded.</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {shown.map((i) => (
        <li key={i.name} className="flex items-center gap-3 text-[13px]">
          <span className="w-[42%] sm:w-[190px] truncate shrink-0" title={i.name} style={{ color: "var(--brand-text)" }}>{i.name}</span>
          <span className="flex-1 h-2 rounded-pill overflow-hidden" style={{ background: "var(--brand-border)" }}>
            <span className="block h-full rounded-pill" style={{ width: `${(i.count / max) * 100}%`, background: "var(--series-1)" }} />
          </span>
          <span className="w-8 text-right tabular-nums" style={{ color: "var(--brand-text)" }}>{i.count}</span>
        </li>
      ))}
      {items.length > limit && (
        <li className="text-[11px]" style={{ color: "var(--brand-muted)" }}>+ {items.length - limit} more</li>
      )}
    </ul>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {([["Established", STATUS_FILL.established], ["Working on", STATUS_FILL.working],
         ["Cannot work with", STATUS_FILL.cannot], ["Not recorded", STATUS_FILL.none]] as const).map(([label, color]) => (
        <span key={label} className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--brand-muted)" }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: color }} /> {label}
        </span>
      ))}
    </div>
  );
}

/**
 * Summary of the First Timers registration tab. Follows the page's month and MC
 * filters (the form has no service, bacenta or cell).
 */
export function FirstTimersSection({
  title = "First timers", rows, tabName, error, issues, mc, period, reportedByCells, ignoredFilters, monthLabel, onSelectMc,
}: {
  title?:          string;
  rows:            FirstTimerRow[];
  tabName:         string | null;
  error:           string | null;
  issues:          FirstTimerIssues;
  mc:              string;
  period:          string;              // "all" or YYYY-MM
  reportedByCells: number;              // first timers the cells' own reports counted, same MC and period
  ignoredFilters:  string[];            // active filters that can't apply here, e.g. ["bacenta", "cell"]
  monthLabel:      (key: string) => string;
  onSelectMc:      (mc: string) => void;
}) {
  const inView = useMemo(() => filterFirstTimers(rows, mc, period), [rows, mc, period]);
  const s = useMemo(() => summariseFirstTimers(inView), [inView]);

  if (error) {
    return (
      <Card title={title} subtitle={tabName ? `From the “${tabName}” tab` : undefined}>
        <p className="text-[13px] flex items-start gap-2 rounded-lg px-3 py-2.5"
           style={{ background: "var(--tint-warn-bg)", color: "var(--tint-warn-fg)" }}>
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
        </p>
      </Card>
    );
  }

  if (!s.total) {
    return (
      <Card title={title} subtitle={tabName ? `From the “${tabName}” tab` : undefined}>
        <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>
          No first timers registered{mc ? ` for ${mc}` : ""}{period !== "all" ? ` in ${monthLabel(period)}` : ""}.
        </p>
      </Card>
    );
  }

  const recorded = s.total - s.status.NONE;
  const notes = buildFirstTimerNotes(s, issues);

  const showMcTable = !mc && s.byMc.length > 1;

  return (
    <Card
      title={title}
      subtitle={`Registrations from the first timers form${tabName ? ` · “${tabName}” tab` : ""}${mc ? ` · ${mc}` : ""}${period !== "all" ? ` · ${monthLabel(period)}` : ""}`}
    >
      {ignoredFilters.length > 0 && (
        <p className="text-[12px] flex items-start gap-1.5" style={{ color: "var(--brand-muted)" }}>
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          The {ignoredFilters.join(", ")} filter{ignoredFilters.length === 1 ? " doesn't" : "s don't"} apply here — registrations only record an MC.
        </p>
      )}

      {/* ── Headline numbers ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Registered" value={fmt(s.total)}
              sub={reportedByCells > 0 ? `cells reported ${fmt(reportedByCells)} · ${pct(s.total, reportedByCells)}% registered` : undefined} />
        <Stat label="Want to join" value={fmt(s.intent.JOIN)}
              sub={`${pct(s.intent.JOIN, s.total)}% · ${fmt(s.intent.UNSURE)} unsure · ${fmt(s.intent.VISITING)} visiting`} />
        <Stat label="Follow-up recorded" value={`${pct(recorded, s.total)}%`} sub={`${fmt(recorded)} of ${fmt(s.total)}`} />
        <Stat label="Established" value={fmt(s.status.ESTABLISHED)}
              sub={recorded ? `${pct(s.status.ESTABLISHED, recorded)}% of those followed up` : "none recorded yet"} />
        <Stat label="Being worked on" value={fmt(s.status.WORKING)} sub={`${fmt(s.status.CANNOT)} cannot work with`} />
      </div>

      {/* ── Intake by month ── */}
      {period === "all" && s.byMonth.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[12px] font-medium" style={{ color: "var(--brand-text)" }}>Registered per month</p>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.byMonth} margin={{ top: 8, right: 4, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="var(--brand-border)" vertical={false} />
                <XAxis dataKey="month" tickFormatter={(m: string) => monthLabel(m).slice(0, 3)} tick={AXIS_TICK} tickLine={false}
                       axisLine={{ stroke: "var(--brand-border)" }} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: "var(--brand-navy-light)" }}
                         formatter={(v) => [fmt(Number(v)), "registered"]}
                         labelFormatter={(m) => monthLabel(String(m))}
                         contentStyle={{ background: "var(--surface)", border: "1px solid var(--brand-border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="var(--series-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Follow-up by MC ── */}
      {showMcTable && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] font-medium" style={{ color: "var(--brand-text)" }}>Follow-up by MC <span className="font-normal" style={{ color: "var(--brand-muted)" }}>· click one to filter</span></p>
            <Legend />
          </div>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-[13px] min-w-[560px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.04em] text-left" style={{ color: "var(--brand-muted)" }}>
                  <th className="px-3 py-2 font-medium">MC</th>
                  <th className="px-3 py-2 font-medium text-right">Registered</th>
                  <th className="px-3 py-2 font-medium text-right">Established</th>
                  <th className="px-3 py-2 font-medium text-right">Working on</th>
                  <th className="px-3 py-2 font-medium text-right">Cannot</th>
                  <th className="px-3 py-2 font-medium text-right">Recorded</th>
                  <th className="px-3 py-2 font-medium w-[22%]">Split</th>
                </tr>
              </thead>
              <tbody>
                {s.byMc.map((m) => (
                  <tr key={m.mc} onClick={() => m.mc !== "Not assigned" && onSelectMc(m.mc)}
                      className={m.mc === "Not assigned" ? "" : "cursor-pointer hover:bg-[var(--brand-navy-light)]"}
                      style={{ borderTop: "1px solid var(--brand-border)", color: "var(--brand-text)" }}>
                    <td className="px-3 py-2 font-medium">{m.mc}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(m.total)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.established}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.working}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.cannot}</td>
                    <td className="px-3 py-2 text-right tabular-nums"
                        style={{ color: pct(m.total - m.none, m.total) < 50 ? "var(--tint-warn-fg)" : undefined }}>
                      {pct(m.total - m.none, m.total)}%
                    </td>
                    <td className="px-3 py-2"><StatusBar {...m} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!showMcTable && (
        <div className="flex flex-col gap-2">
          <Legend />
          <StatusBar established={s.status.ESTABLISHED} working={s.status.WORKING} cannot={s.status.CANNOT} none={s.status.NONE} />
        </div>
      )}

      {/* ── Where they're from · what they want to join ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-[12px] font-medium" style={{ color: "var(--brand-text)" }}>Campus / area</p>
          <BarList items={s.byArea} />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[12px] font-medium" style={{ color: "var(--brand-text)" }}>
            Departments they&apos;d like to join <span className="font-normal" style={{ color: "var(--brand-muted)" }}>· can pick several</span>
          </p>
          <BarList items={s.byDepartment} />
        </div>
      </div>

      {/* ── Who's following up ── */}
      {s.byHandler.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[12px] font-medium" style={{ color: "var(--brand-text)" }}>
            Who&apos;s following up <span className="font-normal" style={{ color: "var(--brand-muted)" }}>· {fmt(s.withHandler)} of {fmt(s.total)} have a handler recorded</span>
          </p>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-[13px] min-w-[420px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.04em] text-left" style={{ color: "var(--brand-muted)" }}>
                  <th className="px-3 py-2 font-medium">Handler</th>
                  <th className="px-3 py-2 font-medium text-right">Handling</th>
                  <th className="px-3 py-2 font-medium text-right">Established</th>
                  <th className="px-3 py-2 font-medium text-right">Working on</th>
                  <th className="px-3 py-2 font-medium text-right">Cannot</th>
                </tr>
              </thead>
              <tbody>
                {s.byHandler.map((h) => (
                  <tr key={h.name} style={{ borderTop: "1px solid var(--brand-border)", color: "var(--brand-text)" }}>
                    <td className="px-3 py-2 font-medium">{h.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{h.total}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{h.established}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{h.working}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{h.cannot}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Data notes ── */}
      {notes.length > 0 && (
        <ul className="rounded-lg px-3 py-2.5 flex flex-col gap-1 text-[12px]"
            style={{ background: "var(--tint-warn-bg)", color: "var(--tint-warn-fg)" }}>
          {notes.map((n) => (
            <li key={n} className="flex items-start gap-1.5"><AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {n}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}
