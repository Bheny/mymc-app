"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Award, Loader2, Lock, RefreshCw, Snowflake } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";
import { LoadError } from "@/components/load-error";
import {
  METRICS, METRIC_LABELS, ROLE_FILTERS,
  type Metric, type Mode, type RankedRow, type RecognitionResponse, type Subject,
} from "@/lib/recognition-meta";

const SUBJECTS: { key: Subject; label: string }[] = [
  { key: "members",   label: "Members" },
  { key: "cell",      label: "Cells" },
  { key: "buscentre", label: "Buscentres" },
  { key: "mc",        label: "MCs" },
];

const MEDAL: Record<number, { bg: string; color: string; label: string }> = {
  1: { bg: "var(--amber-200)",    color: "var(--amber-900)",  label: "1st" },
  2: { bg: "var(--brand-border)", color: "var(--gray-700)",   label: "2nd" },
  3: { bg: "var(--orange-200)",   color: "var(--orange-800)", label: "3rd" },
};

type Kind = "month" | "quarter" | "year";
const thisMonth = () => new Date().toISOString().slice(0, 7);

function Segmented<T extends string>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T; onChange: (k: T) => void }) {
  return (
    <div className="flex rounded-lg overflow-hidden w-fit max-w-full overflow-x-auto" style={{ border: "1px solid var(--brand-border)" }}>
      {options.map(({ key, label }, i) => (
        <button
          key={key} onClick={() => onChange(key)}
          className="px-3.5 py-1.5 text-[12.5px] font-medium whitespace-nowrap transition-colors"
          style={{
            background:  value === key ? "var(--brand-navy)" : "var(--surface)",
            color:       value === key ? "#fff" : "var(--brand-muted)",
            borderRight: i < options.length - 1 ? "1px solid var(--brand-border)" : "none",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const fieldStyle = { border: "1px solid var(--brand-border)", background: "var(--surface)", outline: "none", color: "var(--brand-text)" };

export default function RecognitionPage() {
  const [subject, setSubject] = useState<Subject>("members");
  const [metric,  setMetric]  = useState<Metric>("souls");
  const [mode,    setMode]    = useState<Mode>("raw");
  const [role,    setRole]    = useState("");

  const [kind,    setKind]    = useState<Kind>("month");
  const [month,   setMonth]   = useState(thisMonth());
  const [year,    setYear]    = useState(new Date().getUTCFullYear());
  const [quarter, setQuarter] = useState(Math.floor(new Date().getUTCMonth() / 3) + 1);

  const [data,    setData]    = useState<RecognitionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [freezing, setFreezing] = useState(false);
  const seq = useRef(0);

  const periodKey = kind === "month" ? month : kind === "quarter" ? `${year}-Q${quarter}` : String(year);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true); setError("");
    const p = new URLSearchParams({ period: periodKey, metric, subject, mode });
    if (subject === "members" && role) p.set("role", role);
    try {
      const d = await fetchJson<RecognitionResponse>(`/api/recognition?${p}`);
      if (mine === seq.current) setData(d);
    } catch (e) {
      if (mine === seq.current) setError((e as Error).message);
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [periodKey, metric, subject, mode, role]);

  useEffect(() => { load(); }, [load]);

  async function freeze() {
    if (!confirm(`Freeze ${data?.period.label} as it stands now? This replaces any earlier frozen result.`)) return;
    setFreezing(true);
    const res = await fetch("/api/recognition/snapshot", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ period: month }),
    });
    setFreezing(false);
    if (res.ok) load();
    else setError((await res.json().catch(() => ({}))).error ?? "Couldn't freeze this month.");
  }

  const groups  = subject !== "members";
  const perCap  = groups && mode === "perCapita";
  const rows    = data?.rows ?? [];
  const podium  = rows.filter((r) => r.rank <= 3).slice(0, 6);
  const rest    = rows.filter((r) => !podium.includes(r));
  const unit    = data?.metric.unit ?? METRIC_LABELS[metric].unit;

  const display = (r: RankedRow) => perCap ? r.value.toFixed(2) : String(r.count);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[900px] mx-auto pb-20 lg:pb-8">
      <h1 className="text-[24px] font-semibold flex items-center gap-2 mb-1" style={{ color: "var(--brand-text)" }}>
        <Award className="h-6 w-6" style={{ color: "var(--amber-600)" }} /> Recognition
      </h1>
      <p className="text-[14px] mb-5" style={{ color: "var(--brand-muted)" }}>
        Celebrating the people and groups bearing fruit — {METRIC_LABELS[metric].blurb.toLowerCase()}
      </p>

      {/* Controls */}
      <div className="flex flex-col gap-3 mb-5">
        <Segmented options={SUBJECTS} value={subject} onChange={(s) => { setSubject(s); if (s === "members") setMode("raw"); }} />
        <Segmented options={METRICS.map((m) => ({ key: m, label: METRIC_LABELS[m].title }))} value={metric} onChange={setMetric} />

        <div className="flex flex-wrap items-center gap-2">
          <Segmented<Kind> options={[{ key: "month", label: "Month" }, { key: "quarter", label: "Quarter" }, { key: "year", label: "Year" }]} value={kind} onChange={setKind} />
          {kind === "month" && (
            <input type="month" value={month} max={thisMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)}
                   className="h-9 px-3 text-[13px] rounded-lg" style={fieldStyle} />
          )}
          {kind === "quarter" && (
            <select value={quarter} onChange={(e) => setQuarter(+e.target.value)} className="h-9 px-3 text-[13px] rounded-lg" style={fieldStyle}>
              {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}
            </select>
          )}
          {kind !== "month" && (
            <input type="number" value={year} min={2020} max={new Date().getUTCFullYear()} onChange={(e) => setYear(+e.target.value || year)}
                   className="h-9 w-24 px-3 text-[13px] rounded-lg" style={fieldStyle} />
          )}

          {subject === "members" && (
            <select value={role} onChange={(e) => setRole(e.target.value)} className="h-9 px-3 text-[13px] rounded-lg" style={fieldStyle}>
              <option value="">Everyone</option>
              {ROLE_FILTERS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          )}
          {groups && (
            <Segmented<Mode> options={[{ key: "raw", label: "Total" }, { key: "perCapita", label: "Per member" }]} value={mode} onChange={setMode} />
          )}
        </div>
      </div>

      {/* Status line */}
      {data && !loading && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4 text-[12.5px]" style={{ color: "var(--brand-muted)" }}>
          {data.frozen ? (
            <span className="inline-flex items-center gap-1.5">
              <Snowflake className="h-3.5 w-3.5" />
              {data.period.label} · frozen {data.generatedAt ? new Date(data.generatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""}
            </span>
          ) : (
            <span>{data.period.label} · live, updates as records come in</span>
          )}
          {data.canRegenerate && kind === "month" && month < thisMonth() && (
            <button onClick={freeze} disabled={freezing} className="inline-flex items-center gap-1 underline disabled:opacity-50">
              {freezing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              {data.frozen ? "Re-freeze with today's records" : "Freeze now"}
            </button>
          )}
        </div>
      )}

      {perCap && data && (
        <p className="text-[12px] mb-4" style={{ color: "var(--brand-muted)" }}>
          Per member = {unit} ÷ active members. Groups with fewer than {data.minGroupSize} active members aren&apos;t ranked
          {data.tooSmall > 0 ? ` (${data.tooSmall} left out)` : ""}.
        </p>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
      ) : error ? (
        <LoadError compact message={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ border: "1px solid var(--brand-border)" }}>
          <Award style={{ width: 40, height: 40, color: "var(--brand-muted)", margin: "0 auto 12px" }} />
          <p className="text-[14px] font-medium" style={{ color: "var(--brand-text)" }}>Nothing to celebrate yet for {data?.period.label ?? "this period"}</p>
          <p className="text-[13px] mt-1" style={{ color: "var(--brand-muted)" }}>
            {metric === "souls" || metric === "firstTimers"
              ? "Results appear once souls and first timers are recorded with who won or brought them."
              : "Results appear as records come in."}
          </p>
        </div>
      ) : (
        <>
          {/* Top three */}
          <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            {podium.map((r) => {
              const medal = MEDAL[r.rank];
              return (
                <div key={r.id} className="rounded-xl p-4 flex flex-col gap-1"
                     style={{ border: `1px solid ${r.isYours ? "var(--brand-navy)" : "var(--brand-border)"}`, background: "var(--surface)" }}>
                  <span className="rounded-pill text-[11px] font-semibold px-2 py-0.5 w-fit" style={{ background: medal.bg, color: medal.color }}>{medal.label}</span>
                  <p className="text-[16px] font-semibold truncate" style={{ color: "var(--brand-text)" }}>{r.name}</p>
                  <p className="text-[12px] truncate" style={{ color: "var(--brand-muted)" }}>{r.place || " "}</p>
                  <p className="text-[22px] font-semibold tabular-nums mt-1" style={{ color: "var(--brand-text)" }}>
                    {display(r)} <span className="text-[12px] font-normal" style={{ color: "var(--brand-muted)" }}>{perCap ? `${unit} per member` : unit}</span>
                  </p>
                  {perCap && <p className="text-[11px]" style={{ color: "var(--brand-muted)" }}>{r.count} from {r.headcount} members</p>}
                </div>
              );
            })}
          </div>

          {rest.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--brand-border)" }}>
              {rest.map((r, i) => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3"
                     style={{ borderTop: i === 0 ? "none" : "1px solid var(--brand-border)", background: r.isYours ? "var(--brand-navy-light)" : undefined }}>
                  <div className="flex items-center justify-center rounded-full text-[13px] font-semibold shrink-0"
                       style={{ width: 32, height: 32, background: "var(--gray-100)", color: "var(--brand-muted)" }}>{r.rank}</div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-[13.5px] font-medium" style={{ color: "var(--brand-text)" }}>{r.name}{r.isYours ? " · you" : ""}</p>
                    {r.place && <p className="truncate text-[12px]" style={{ color: "var(--brand-muted)" }}>{r.place}</p>}
                  </div>
                  <div className="text-right tabular-nums shrink-0">
                    <p className="text-[14px] font-semibold" style={{ color: "var(--brand-text)" }}>{display(r)}</p>
                    {perCap && <p className="text-[11px]" style={{ color: "var(--brand-muted)" }}>{r.count} / {r.headcount}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <p className="flex items-center gap-1.5 text-[11.5px] mt-6" style={{ color: "var(--brand-muted)" }}>
        <Lock className="h-3 w-3" /> Visible to people with system access, within their own part of the church.
      </p>
    </div>
  );
}
