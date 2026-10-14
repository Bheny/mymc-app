"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, ReferenceLine,
} from "recharts";
import { ArrowUpDown, ClipboardList, X } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";
import { LoadError } from "@/components/load-error";
import {
  AXIS_TICK, Attention, BreakdownTooltip, Card, ChartTooltip, Delta, fmt, Legend, Segmented, selectStyle, SERIES, Stat, TargetCard, TrendTooltip,
} from "@/components/attendance/dash-ui";
import {
  againstTarget, attended, breakdown, breakdownByShepherd, countColor, firstTimerFollowUp, formatDay, formatMonth, headline, latestChange,
  missing, missingByCell, monthly, monthRange, monthsBetween, rate, sum, targetFor, TARGETS, TARGET_LEVEL_LABEL, trend, TYPE_LABEL, yesterday,
  type GroupBy, type History, type Metric, type SvcType, type TargetLevel, type TrendView,
} from "@/lib/attendance-dashboard";

// Attendance dashboard — the same layout as the Legacy dashboard (filters, headline numbers,
// trend, breakdown, outreach, missing services, cell table), drawn from the app's own records.

type ServiceFilter = "all" | SvcType;
type SortKey = "name" | "lc" | "mgs" | "firstTimers" | "missing";

export function AttendanceDashboard({ actingParam, canRecordFor = false }: { actingParam: string; canRecordFor?: boolean }) {
  const [h, setH]         = useState<History | null>(null);
  const [error, setError] = useState("");

  const [period, setPeriod]   = useState("all");
  const [service, setService] = useState<ServiceFilter>("all");
  const [mcId, setMcId]       = useState("");
  const [bcId, setBcId]       = useState("");
  const [cellId, setCellId]   = useState("");
  const [view, setView]       = useState<TrendView>("week");
  const [metric, setMetric]   = useState<Metric>("present");
  const [groupPick, setGroupPick] = useState<GroupBy>("cell");
  const [sort, setSort]       = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [showAllMissing, setShowAllMissing] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try { setH(await fetchJson<History>(`/api/attendance/history${actingParam ? `?${actingParam}` : ""}`)); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't load attendance"); }
  }, [actingParam]);
  useEffect(() => { load(); }, [load]);

  // ── Filter options ──
  const opts = useMemo(() => {
    const cells = h?.cells ?? [];
    const mcs = Array.from(new Map(cells.map((c) => [c.mcId, c.mc]))).map(([id, name]) => ({ id, name }));
    const inMc = cells.filter((c) => !mcId || c.mcId === mcId);
    const bcs = Array.from(new Map(inMc.map((c) => [c.buscentreId, c.buscentre]))).map(([id, name]) => ({ id, name }));
    const inBc = inMc.filter((c) => !bcId || c.buscentreId === bcId);
    return { mcs, bcs, cells: inBc };
  }, [h, mcId, bcId]);

  const visible = useMemo(() => (h?.cells ?? []).filter((c) =>
    (!mcId || c.mcId === mcId) && (!bcId || c.buscentreId === bcId) && (!cellId || c.id === cellId)), [h, mcId, bcId, cellId]);
  const cellSet = useMemo(() => new Set(visible.map((c) => c.id)), [visible]);

  const months = useMemo(() => (h ? monthsBetween(h.since, h.today) : []), [h]);
  const range  = useMemo(() => (h ? (period === "all" ? { from: h.since, to: h.today } : monthRange(period)) : { from: "", to: "" }), [h, period]);
  const inRange = (d: string) => d >= range.from && d <= range.to;

  // Services in view. `counted` excludes cancelled services (they have no attendance).
  const live    = useMemo(() => (h?.services ?? []).filter((s) => cellSet.has(s.cellId) && inRange(s.date) && (service === "all" || s.type === service)),
    [h, cellSet, range, service]); // eslint-disable-line react-hooks/exhaustive-deps
  const counted = useMemo(() => live.filter((s) => !s.cancelled), [live]);

  const mgs = useMemo(() => headline(counted.filter((s) => s.type === "MGS")), [counted]);
  const lc  = useMemo(() => headline(counted.filter((s) => s.type === "LC_LIVE")), [counted]);
  const mgsLast = useMemo(() => latestChange(counted.filter((s) => s.type === "MGS")), [counted]);
  const lcLast  = useMemo(() => latestChange(counted.filter((s) => s.type === "LC_LIVE")), [counted]);

  // First timers, and whether anyone has followed them up
  const ft = useMemo(() => firstTimerFollowUp((h?.firstTimerRows ?? []).filter((r) => cellSet.has(r.cellId) && inRange(r.date) && (service === "all" || r.type === service))),
    [h, cellSet, range, service]); // eslint-disable-line react-hooks/exhaustive-deps

  const gaps = useMemo(() => {
    if (!h) return { missing: [], expected: 0 };
    const recorded = h.services.filter((s) => cellSet.has(s.cellId));
    return missing(visible, recorded, range.from, range.to < yesterday(h.today) ? range.to : yesterday(h.today), service);
  }, [h, visible, cellSet, range, service]);

  const behind = useMemo(() => missingByCell(gaps.missing), [gaps]);

  const trendRows = useMemo(() => trend(counted, view, metric), [counted, view, metric]);
  const trendSeries = (["MGS", "LC_LIVE"] as SvcType[]).filter((t) => service === "all" || service === t);

  // Breakdown: coarsest level that still has more than one thing to compare
  const groupOptions: GroupBy[] = [
    ...(opts.mcs.length > 1 && !mcId ? ["mc" as const] : []),
    ...(opts.bcs.length > 1 && !bcId ? ["buscentre" as const] : []),
    ...(visible.length > 1 ? ["cell" as const] : []),
    "shepherd" as const,
  ];
  const group = groupOptions.includes(groupPick) ? groupPick : groupOptions[0];
  const bars = useMemo(() => {
    if (!h) return [];
    return group === "shepherd"
      ? breakdownByShepherd(counted, h.shepherds, h.cells, metric, visible.length > 1)
      : breakdown(counted, h.cells, group, metric);
  }, [counted, h, group, metric, visible.length]);
  const single = visible.length <= 1;

  // What this view is expected to reach per service: 13 a cell, 26 a buscentre, 52 an MC
  const level: TargetLevel = cellId ? "cell" : bcId ? "buscentre" : mcId ? "mc"
    : h?.scopeLevel === "cell" ? "cell" : h?.scopeLevel === "buscentre" ? "buscentre" : h?.scopeLevel === "mc" ? "mc" : "branch";
  const mcCount = new Set(visible.map((c) => c.mcId)).size;
  const target  = targetFor(level, mcCount);
  const mgsTarget = useMemo(() => againstTarget(counted.filter((s) => s.type === "MGS"), target), [counted, target]);
  const lcTarget  = useMemo(() => againstTarget(counted.filter((s) => s.type === "LC_LIVE"), target), [counted, target]);

  // Outreach by month always shows the full window, whatever the period filter says
  const outreach = useMemo(() => {
    if (!h) return [];
    const inCells = (id: string) => cellSet.has(id);
    return monthly(
      h.services.filter((s) => inCells(s.cellId) && !s.cancelled),
      h.joined.filter((j) => inCells(j.cellId)), h.souls.filter((s) => inCells(s.cellId)), months,
    );
  }, [h, cellSet, months]);

  // Per-cell table
  const rows = useMemo(() => visible.map((c) => {
    const mine = counted.filter((s) => s.cellId === c.id);
    const l = headline(mine.filter((s) => s.type === "LC_LIVE")), m = headline(mine.filter((s) => s.type === "MGS"));
    return { cell: c, lc: l, mgs: m, firstTimers: sum(mine).firstTimers, missing: gaps.missing.filter((g) => g.cellId === c.id).length };
  }), [visible, counted, gaps]);
  const sortedRows = useMemo(() => {
    const v = (r: (typeof rows)[number]) => sort.key === "name" ? r.cell.name.toLowerCase()
      : sort.key === "lc" ? (r.lc.services ? r.lc.median : -1) : sort.key === "mgs" ? (r.mgs.services ? r.mgs.median : -1)
      : sort.key === "firstTimers" ? r.firstTimers : r.missing;
    return [...rows].sort((a, b) => (v(a) < v(b) ? -1 : v(a) > v(b) ? 1 : 0) * sort.dir);
  }, [rows, sort]);

  const hasFilters = period !== "all" || service !== "all" || !!mcId || !!bcId || !!cellId;
  const clear = () => { setPeriod("all"); setService("all"); setMcId(""); setBcId(""); setCellId(""); };

  if (error) return <LoadError message={error} onRetry={load} />;
  if (!h) return <div className="flex flex-col gap-4">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-28 rounded-xl" />)}</div>;

  const yFmt = (v: number) => (metric === "rate" ? `${v}%` : String(v));
  const headSort = (key: SortKey, label: string, cls = "") => (
    <th className={`px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.04em] ${cls}`} style={{ color: "var(--brand-muted)" }}>
      <button className="inline-flex items-center gap-1 hover:underline" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : (key === "name" ? 1 : -1) }))}>
        {label}<ArrowUpDown className="h-3 w-3 opacity-60" />
      </button>
    </th>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.04em] pb-3" style={{ color: "var(--brand-muted)", borderBottom: "1px solid var(--brand-border)" }}>
        <ClipboardList className="h-3.5 w-3.5" /> Attendance · {h.scopeName}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Period" value={period} onChange={(e) => setPeriod(e.target.value)} className="h-9 px-3 text-[13px] rounded-lg" style={selectStyle}>
          <option value="all">{h.sinceLaunch ? `Since ${formatDay(h.since, { day: "numeric", month: "short", year: "numeric" })}` : `Last ${months.length} month${months.length === 1 ? "" : "s"}`}</option>
          {[...months].reverse().map((m) => <option key={m} value={m}>{formatMonth(m, true)}</option>)}
        </select>
        <Segmented<ServiceFilter> ariaLabel="Service" value={service} onChange={setService}
          options={[{ key: "all", label: "All services" }, { key: "MGS", label: "MGS" }, { key: "LC_LIVE", label: "LC Live" }]} />
        {opts.mcs.length > 1 && (
          <select aria-label="Mega church" value={mcId} onChange={(e) => { setMcId(e.target.value); setBcId(""); setCellId(""); }} className="h-9 px-3 text-[13px] rounded-lg" style={selectStyle}>
            <option value="">All MCs</option>{opts.mcs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        {opts.bcs.length > 1 && (
          <select aria-label="Buscentre" value={bcId} onChange={(e) => { setBcId(e.target.value); setCellId(""); }} className="h-9 px-3 text-[13px] rounded-lg" style={selectStyle}>
            <option value="">All buscentres</option>{opts.bcs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        {opts.cells.length > 1 && (
          <select aria-label="Cell" value={cellId} onChange={(e) => setCellId(e.target.value)} className="h-9 px-3 text-[13px] rounded-lg" style={selectStyle}>
            <option value="">All cells</option>{opts.cells.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        {hasFilters && (
          <button onClick={clear} className="h-9 px-2 text-[12px] font-medium inline-flex items-center gap-1 hover:underline" style={{ color: "var(--brand-link)" }}>
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ border: "1px solid var(--brand-border)" }}>
          <p className="text-[14px]" style={{ color: "var(--brand-text)" }}>No cells to show.</p>
        </div>
      ) : (
        <>
          {/* ── Headline numbers ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {service !== "LC_LIVE" && (
              <Stat label="MGS attendance" value={mgs.services ? fmt(mgs.median) : "—"}
                    sub={mgs.services ? (
                      <>
                        <span>median · avg {fmt(mgs.average, 1)} · {mgs.services} Sunday{mgs.services === 1 ? "" : "s"}</span>
                        {mgsLast && <span>Latest <b style={{ color: "var(--brand-text)" }}>{fmt(mgsLast.attended)}</b> on {formatDay(mgsLast.date)} {mgsLast.delta !== null && <Delta n={mgsLast.delta} />}</span>}
                      </>
                    ) : "No MGS recorded yet"} />
            )}
            {service !== "MGS" && (
              <Stat label="LC Live attendance" value={lc.services ? fmt(lc.median) : "—"}
                    sub={lc.services ? (
                      <>
                        <span>median · avg {fmt(lc.average, 1)} · {lc.services} service{lc.services === 1 ? "" : "s"}</span>
                        {lcLast && <span>Latest <b style={{ color: "var(--brand-text)" }}>{fmt(lcLast.attended)}</b> on {formatDay(lcLast.date)} {lcLast.delta !== null && <Delta n={lcLast.delta} />}</span>}
                      </>
                    ) : "No LC Live recorded yet"} />
            )}
            {service === "all" && (
              <Stat label="Services recorded" value={gaps.expected ? `${fmt(gaps.expected - gaps.missing.length)} of ${fmt(gaps.expected)}` : "—"}
                    color={gaps.missing.length ? "var(--brand-warning)" : undefined}
                    sub={gaps.missing.length ? (
                      <>
                        <Attention>{fmt(gaps.missing.length)} missing</Attention>
                        <span>{behind.slice(0, 2).map((c) => `${c.name} ${c.n}`).join(" · ")}{behind.length > 2 ? ` · +${behind.length - 2} more` : ""}</span>
                      </>
                    ) : "none missing"} />
            )}
            <Stat label="First timers" value={fmt(ft.total)}
                  sub={ft.total ? (
                    <>
                      <span>{ft.followedUp} followed up{ft.joined ? ` · ${ft.joined} became member${ft.joined === 1 ? "" : "s"}` : ""}</span>
                      {ft.toFollowUp > 0 ? <Attention>{ft.toFollowUp} still to follow up</Attention> : <span style={{ color: "var(--brand-success)" }}>All followed up</span>}
                    </>
                  ) : "None recorded yet"} />
          </div>

          {/* ── Are we reaching the target? ── */}
          {counted.length > 0 && (
            <Card title="Attendance target"
                  subtitle={`${target} people per service for ${level === "branch" ? `the branch (${mcCount} MC${mcCount === 1 ? "" : "s"} × ${TARGETS.mc})` : `a ${TARGET_LEVEL_LABEL[level]}`} · counts people marked present, not first timers`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {service !== "LC_LIVE" && <TargetCard label="MGS" unit="Sunday" r={mgsTarget} />}
                {service !== "MGS" && <TargetCard label="LC Live" unit="service" r={lcTarget} />}
              </div>
            </Card>
          )}

          {counted.length === 0 ? (
            <div className="rounded-xl p-10 text-center" style={{ border: "1px solid var(--brand-border)" }}>
              <p className="text-[14px]" style={{ color: "var(--brand-text)" }}>No attendance recorded for these filters.</p>
              {hasFilters && <button onClick={clear} className="text-[13px] mt-1 hover:underline" style={{ color: "var(--brand-link)" }}>Clear filters</button>}
            </div>
          ) : (
            <>
              {/* ── Trend ── */}
              <Card title={`Attendance by ${view === "day" ? "service date" : view}`}
                    subtitle={metric === "rate"
                      ? "Share of members marked present — total present divided by total marked"
                      : view === "month" ? `Median attending per service, each month · dashed line is the target of ${target}` : `Total attending (members present and first timers) · dashed line is the target of ${target}`}
                    action={
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Segmented<Metric> ariaLabel="Measure" value={metric} onChange={setMetric} options={[{ key: "present", label: "People" }, { key: "rate", label: "Rate" }]} />
                          <Segmented<TrendView> ariaLabel="Group the trend by" value={view} onChange={setView} options={[{ key: "day", label: "Day" }, { key: "week", label: "Week" }, { key: "month", label: "Month" }]} />
                        </div>
                        {trendSeries.length > 1 && <Legend mark="line" items={trendSeries.map((t) => ({ label: TYPE_LABEL[t], color: SERIES[t] }))} />}
                      </div>
                    }>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendRows} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                      <CartesianGrid stroke="var(--brand-border)" vertical={false} />
                      <XAxis dataKey="x" tickFormatter={(x) => (view === "month" ? formatMonth(x) : formatDay(x))} tick={AXIS_TICK} tickLine={false}
                             axisLine={{ stroke: "var(--brand-border)" }} minTickGap={24} />
                      <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={yFmt}
                             domain={metric === "rate" ? [0, 100] : [0, (max: number) => Math.max(max, target)]} />
                      {metric === "present" && (
                        <ReferenceLine y={target} stroke="var(--brand-muted)" strokeDasharray="5 4"
                                       label={{ value: `Target ${target}`, position: "insideTopRight", fontSize: 11, fill: "var(--brand-muted)" }} />
                      )}
                      <Tooltip cursor={{ stroke: "var(--brand-muted)", strokeWidth: 1 }} content={<TrendTooltip view={view} metric={metric} />} />
                      {trendSeries.map((t) => (
                        // Straight segments: smoothing would invent values between services
                        <Line key={t} type="linear" dataKey={t} name={TYPE_LABEL[t]} stroke={SERIES[t]} strokeWidth={2}
                              dot={view === "week" ? false : { r: 2.5, strokeWidth: 0, fill: SERIES[t] }}
                              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} connectNulls={view === "day"} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* ── Breakdown by MC / buscentre / cell / shepherd ── */}
                  <Card title={`Attendance by ${group === "mc" ? "MC" : group}`}
                        subtitle={group === "shepherd"
                          ? `${metric === "rate" ? "Share of each shepherd's members present" : "Median members present per service under each shepherd"} · first timers aren't assigned to a shepherd`
                          : `${metric === "rate" ? "Share of members present" : `Median attending per service · dashed line is the ${TARGET_LEVEL_LABEL[group]} target of ${TARGETS[group]}`} · click a bar to filter`}
                        action={groupOptions.length > 1 ? (
                          <Segmented<GroupBy> ariaLabel="Group by" value={group} onChange={setGroupPick}
                            options={groupOptions.map((g) => ({ key: g, label: g === "mc" ? "MC" : g === "buscentre" ? "Buscentre" : g === "cell" ? "Cell" : "Shepherd" }))} />
                        ) : undefined}>
                    <div style={{ height: Math.max(160, bars.length * 34 + 16) }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={bars} layout="vertical" margin={{ top: 0, right: 44, bottom: 0, left: 0 }} barCategoryGap={6}>
                          <XAxis type="number" hide domain={metric === "rate" ? [0, 100] : group === "shepherd" ? [0, "auto"] : [0, (max: number) => Math.max(max, TARGETS[group])]} />
                          {metric === "present" && group !== "shepherd" && <ReferenceLine x={TARGETS[group]} stroke="var(--brand-muted)" strokeDasharray="5 4" />}
                          <YAxis type="category" dataKey="name" width={group === "shepherd" ? 150 : 110} tick={{ ...AXIS_TICK, fill: "var(--brand-text)" }} tickLine={false} axisLine={false} />
                          <Tooltip cursor={{ fill: "var(--brand-navy-light)" }} content={<BreakdownTooltip metric={metric} />} />
                          <Bar dataKey="value" name={metric === "rate" ? "rate" : "median attending"} fill={SERIES.MGS} radius={[0, 4, 4, 0]} cursor={group === "shepherd" ? "default" : "pointer"}
                               onClick={(d: { id?: string }) => {
                                 if (!d?.id) return;
                                 if (group === "mc") { setMcId(d.id); setBcId(""); setCellId(""); }
                                 else if (group === "buscentre") { setBcId(d.id); setCellId(""); }
                                 else if (group === "cell") setCellId(d.id);
                               }}>
                            <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: "var(--brand-text)" }} formatter={(v: number) => (metric === "rate" ? `${v}%` : fmt(v))} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                {/* ── Outreach by month ── */}
                <Card title="Outreach by month" subtitle="First timers by service date; members and souls by the day they happened"
                      action={<Legend mark="rect" items={[
                        { label: "First timers", color: SERIES.MGS }, { label: "Became members", color: SERIES.LC_LIVE }, { label: "Souls won", color: SERIES.third },
                      ]} />}>
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={outreach} margin={{ top: 8, right: 4, bottom: 0, left: -16 }} barGap={2} barCategoryGap="22%">
                        <CartesianGrid stroke="var(--brand-border)" vertical={false} />
                        <XAxis dataKey="month" tickFormatter={(m) => formatMonth(m)} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--brand-border)" }} />
                        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip cursor={{ fill: "var(--brand-navy-light)" }} content={<ChartTooltip />} />
                        <Bar dataKey="firstTimers" name="First timers" fill={SERIES.MGS} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="joined" name="Became members" fill={SERIES.LC_LIVE} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="souls" name="Souls won" fill={SERIES.third} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              {single && (
                <Card title="Recent services" subtitle={`The latest services recorded for this cell, against the target of ${TARGETS.cell}`}>
                  <ul className="flex flex-col">
                    {[...counted].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map((s) => {
                      const here = attended(s), pct = Math.min(100, rate(here, TARGETS.cell));
                      return (
                        <li key={`${s.type}|${s.date}`} className="flex items-center gap-3 py-2.5 border-t first:border-t-0" style={{ borderColor: "var(--brand-border)" }}>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium" style={{ color: "var(--brand-text)" }}>
                              {TYPE_LABEL[s.type]} <span className="font-normal" style={{ color: "var(--brand-muted)" }}>· {formatDay(s.date, { weekday: "short", day: "numeric", month: "short" })}{s.online ? " · online" : ""}</span>
                            </p>
                            <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
                              {s.present} members present{s.firstTimers ? ` + ${s.firstTimers} first timer${s.firstTimers === 1 ? "" : "s"}` : ""}{s.guests ? ` + ${s.guests} returning guest${s.guests === 1 ? "" : "s"}` : ""} · {s.absent} absent{s.excused ? ` · ${s.excused} excused` : ""}
                            </p>
                          </div>
                          <div className="w-24 shrink-0">
                            <p className="text-[13px] font-semibold text-right tabular-nums" style={{ color: countColor(here, TARGETS.cell) }}>
                              {here}<span className="font-normal" style={{ color: "var(--brand-muted)" }}> / {TARGETS.cell}</span>
                            </p>
                            <div className="mt-1 rounded-full overflow-hidden" style={{ height: 4, background: "var(--brand-border)" }}>
                              <div className="h-full" style={{ width: `${pct}%`, background: countColor(here, TARGETS.cell) }} />
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              )}
            </>
          )}

          {/* ── Missing services ── */}
          <Card title="Missing services"
                subtitle={gaps.missing.length
                  ? `${fmt(gaps.missing.length)} of ${fmt(gaps.expected)} expected services weren't recorded (Wednesdays and Sundays, up to yesterday)`
                  : "Every expected service has been recorded in this period"}>
            {gaps.missing.length > 0 && (
              <>
                <ul className="flex flex-col">
                  {(showAllMissing ? gaps.missing : gaps.missing.slice(0, 8)).map((g) => (
                    <li key={`${g.cellId}|${g.type}|${g.date}`} className="flex items-center justify-between gap-3 py-2 border-t first:border-t-0 text-[13px]" style={{ borderColor: "var(--brand-border)" }}>
                      <span style={{ color: "var(--brand-text)" }}>{g.cellName}</span>
                      <span className="flex items-center gap-3" style={{ color: "var(--brand-muted)" }}>
                        {TYPE_LABEL[g.type]} · {formatDay(g.date, { weekday: "short", day: "numeric", month: "short" })}
                        {canRecordFor && (
                          <Link href={`/attendance/new?cell=${g.cellId}&date=${g.date}&type=${g.type}`} className="font-medium hover:underline" style={{ color: "var(--brand-link)" }}>Record</Link>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                {gaps.missing.length > 8 && (
                  <button className="text-[13px] self-start hover:underline" style={{ color: "var(--brand-link)" }} onClick={() => setShowAllMissing((v) => !v)}>
                    {showAllMissing ? "Show fewer" : `Show all ${gaps.missing.length}`}
                  </button>
                )}
              </>
            )}
          </Card>

          {/* ── Cells ── */}
          {!single && (
            <Card title="Cells" subtitle={`Median present per service in the period, against the cell target of ${TARGETS.cell} · click a cell to focus on it`}>
              <div className="overflow-x-auto -mx-4 sm:-mx-5">
                <table className="w-full text-[13px] min-w-[560px]">
                  <thead>
                    <tr className="text-left">
                      {headSort("name", "Cell", "text-left")}{headSort("lc", "LC Live", "text-right")}{headSort("mgs", "MGS", "text-right")}
                      {headSort("firstTimers", "First timers", "text-right")}{headSort("missing", "Missing", "text-right")}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((r) => (
                      <tr key={r.cell.id} onClick={() => setCellId(r.cell.id)} className="cursor-pointer hover:bg-[var(--brand-navy-light)]" style={{ borderTop: "1px solid var(--brand-border)" }}>
                        <td className="px-4 py-2.5">
                          <p className="font-medium" style={{ color: "var(--brand-text)" }}>{r.cell.name}</p>
                          <p className="text-[11px]" style={{ color: "var(--brand-muted)" }}>{r.cell.buscentre}{opts.mcs.length > 1 ? ` · ${r.cell.mc}` : ""}</p>
                        </td>
                        {[r.lc, r.mgs].map((x, i) => (
                          <td key={i} className="px-4 py-2.5 text-right tabular-nums">
                            {x.services ? <span className="font-semibold" style={{ color: countColor(x.median, TARGETS.cell) }}>{fmt(x.median)}</span> : <span style={{ color: "var(--brand-muted)" }}>—</span>}
                          </td>
                        ))}
                        <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: "var(--brand-text)" }}>{r.firstTimers}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: r.missing ? "var(--brand-warning)" : "var(--brand-muted)" }}>{r.missing || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
