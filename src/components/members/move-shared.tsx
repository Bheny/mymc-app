"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { inputCls, inputStyle } from "@/components/evangelism/shared";

export type MoveMember = { id: string; name: string; isActive: boolean; lock: string | null };
export type BoardShepherd = { id: string; name: string; members: MoveMember[] };
export type BoardCell = { id: string; name: string; shepherds: BoardShepherd[]; unshepherded: MoveMember[] };
export type BoardData = {
  capacity: { max: number; enforce: boolean };
  buscentreId: string | null;
  cells: BoardCell[];
  direct: MoveMember[];
};
export type Level = "shepherd" | "cell" | "buscentre" | "mc";
export type MoveResult = { moved: number; skipped: { id: string; name: string; reason: string }[]; to: string; overCapacity?: { count: number; max: number } };

// Load a board / list from /api/org/move-board; null query = nothing selected yet
export function useBoard(query: string | null) {
  const [data, setData] = useState<BoardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!query) { setData(null); setError(""); return; }
    setLoading(true); setError("");
    try { setData(await fetchJson<BoardData>(`/api/org/move-board?${query}`)); }
    catch (e) { setData(null); setError(e instanceof Error ? e.message : "Couldn't load"); }
    setLoading(false);
  }, [query]);
  useEffect(() => { load(); }, [load]);
  return { data, error, loading, reload: load };
}

// ─── Capacity pips ────────────────────────────────────────────────────────────
// One pip per place. Striped = people about to arrive. Amber = over the limit.

export function Pips({ n, incoming = 0, max }: { n: number; incoming?: number; max: number }) {
  const total = Math.max(max, n + incoming);
  return (
    <div className="flex gap-[3px] flex-1 min-w-0" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => {
        const over = i >= max;
        const kind = i < n ? "on" : i < n + incoming ? "in" : "off";
        const color = over ? "var(--brand-warning)" : kind === "on" ? "var(--brand-navy)" : "var(--brand-link)";
        return (
          <span key={i} className="h-[6px] rounded-[3px] flex-1 max-w-[22px]"
                style={kind === "off"
                  ? { background: "var(--brand-border)" }
                  : kind === "on"
                    ? { background: color }
                    : { background: `repeating-linear-gradient(135deg, ${color} 0 3px, transparent 3px 6px)`, outline: `1px solid ${color}`, outlineOffset: -1 }} />
        );
      })}
    </div>
  );
}

export function CapLine({ n, incoming = 0, max }: { n: number; incoming?: number; max: number }) {
  const after = n + incoming;
  return (
    <div className="flex items-center gap-2">
      <Pips n={n} incoming={incoming} max={max} />
      <span className="text-[12px] whitespace-nowrap tabular-nums"
            style={{ color: after > max ? "var(--brand-warning)" : "var(--brand-muted)" }}>
        {incoming ? `${n} → ${after}/${max}` : `${n}/${max}`}
      </span>
    </div>
  );
}

// ─── MC → buscentre → cell → shepherd picker ──────────────────────────────────

type Opt  = { id: string; name: string };
type Slot = { id: string; user: { name: string } | null; person: { firstName: string; lastName: string } | null; _count: { members: number } };

export const slotName = (s: Slot) =>
  s.user?.name ?? (s.person ? `${s.person.firstName} ${s.person.lastName}` : "Unfilled slot");

export function usePicker(depth: Level) {
  const [mcs, setMcs]     = useState<Opt[]>([]);
  const [bcs, setBcs]     = useState<Opt[]>([]);
  const [cells, setCells] = useState<Opt[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [mcId, setMcId] = useState("");
  const [buscentreId, setBuscentreId] = useState("");
  const [cellId, setCellId] = useState("");
  const [shepherdId, setShepherdId] = useState("");

  const arr = <T,>(d: unknown): T[] => (Array.isArray(d) ? (d as T[]) : []);
  useEffect(() => { fetch("/api/org/mega-churches").then((r) => r.json()).then((d) => setMcs(arr(d))).catch(() => {}); }, []);
  useEffect(() => {
    setBcs([]); setBuscentreId(""); setCells([]); setCellId(""); setSlots([]); setShepherdId("");
    if (mcId) fetch(`/api/org/buscentres?mcId=${mcId}`).then((r) => r.json()).then((d) => setBcs(arr(d))).catch(() => {});
  }, [mcId]);
  useEffect(() => {
    setCells([]); setCellId(""); setSlots([]); setShepherdId("");
    if (buscentreId) fetch(`/api/org/cells?buscentreId=${buscentreId}`).then((r) => r.json()).then((d) => setCells(arr(d))).catch(() => {});
  }, [buscentreId]);
  useEffect(() => {
    setSlots([]); setShepherdId("");
    if (cellId && depth === "shepherd") fetch(`/api/org/shepherds?cellId=${cellId}`).then((r) => r.json()).then((d) => setSlots(arr(d))).catch(() => {});
  }, [cellId, depth]);

  return { mcs, bcs, cells, slots, mcId, setMcId, buscentreId, setBuscentreId, cellId, setCellId, shepherdId, setShepherdId };
}
export type Picker = ReturnType<typeof usePicker>;

export function Cascade({ p, depth }: { p: Picker; depth: Level }) {
  const sel = (value: string, set: (v: string) => void, ph: string, opts: { id: string; label: string }[], label: string) => (
    <select className={inputCls} style={inputStyle} aria-label={label} value={value} disabled={opts.length === 0} onChange={(e) => set(e.target.value)}>
      <option value="">{ph}</option>
      {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );
  return (
    <div className="flex flex-col gap-3">
      {sel(p.mcId, p.setMcId, "— MC —", p.mcs.map((o) => ({ id: o.id, label: o.name })), "MC")}
      {depth !== "mc" && sel(p.buscentreId, p.setBuscentreId, p.mcId ? "— Buscentre —" : "Choose an MC first", p.bcs.map((o) => ({ id: o.id, label: o.name })), "Buscentre")}
      {(depth === "cell" || depth === "shepherd") && sel(p.cellId, p.setCellId, p.buscentreId ? "— Cell —" : "Choose a buscentre first", p.cells.map((o) => ({ id: o.id, label: o.name })), "Cell")}
      {depth === "shepherd" && sel(p.shepherdId, p.setShepherdId, p.cellId ? "— Shepherd —" : "Choose a cell first", p.slots.map((s) => ({ id: s.id, label: `${slotName(s)} (${s._count.members})` })), "Shepherd")}
    </div>
  );
}
