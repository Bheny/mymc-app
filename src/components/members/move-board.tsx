"use client";

import { useEffect, useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { LoadError } from "@/components/load-error";
import { api, inputCls, inputStyle, PrimaryButton } from "@/components/evangelism/shared";
import { CapLine, useBoard, type MoveMember, type MoveResult } from "@/components/members/move-shared";

// Board: shepherds are lanes, members are chips. Drag a member onto another
// lane (or tap the member, then the lane). Moves are staged and applied together.

type Lane = { key: string; title: string; hint: string; cap: boolean; members: MoveMember[] };
type Group = { id: string; name: string; lanes: Lane[] };

const dest = (key: string) => {
  const [t, id] = [key[0], key.slice(2)];
  return t === "s" ? { level: "shepherd", shepherdId: id } : t === "c" ? { level: "cell", cellId: id } : { level: "buscentre", buscentreId: id };
};

export function MoveBoard({ query }: { query: string }) {
  const { data, error, loading, reload } = useBoard(query);
  const [staged, setStaged]   = useState<Record<string, string>>({});   // memberId → lane key
  const [sel, setSel]         = useState<string | null>(null);
  const [over, setOver]       = useState<string | null>(null);
  const [review, setReview]   = useState(false);
  const [reason, setReason]   = useState("");
  const [busy, setBusy]       = useState(false);
  const [notes, setNotes]     = useState<string[]>([]);
  const [errs, setErrs]       = useState<string[]>([]);

  useEffect(() => { setStaged({}); setSel(null); setReview(false); setNotes([]); setErrs([]); }, [query]);

  // Where everyone is now, before any staged move
  const { groups, home, byId, names } = useMemo(() => {
    const home: Record<string, string> = {}; const byId: Record<string, MoveMember> = {}; const names: Record<string, string> = {};
    const groups: Group[] = [];
    for (const c of data?.cells ?? []) {
      const lanes: Lane[] = [];
      for (const s of c.shepherds) {
        s.members.forEach((m) => { home[m.id] = `s:${s.id}`; byId[m.id] = m; });
        names[`s:${s.id}`] = `${s.name} · ${c.name}`;
        lanes.push({ key: `s:${s.id}`, title: s.name, hint: "Shepherd", cap: true, members: s.members });
      }
      c.unshepherded.forEach((m) => { home[m.id] = `c:${c.id}`; byId[m.id] = m; });
      names[`c:${c.id}`] = `${c.name} (no shepherd)`;
      lanes.push({ key: `c:${c.id}`, title: "No shepherd", hint: "Held by the cell", cap: false, members: c.unshepherded });
      groups.push({ id: c.id, name: c.name, lanes });
    }
    if (data?.buscentreId) {
      data.direct.forEach((m) => { home[m.id] = `b:${data.buscentreId}`; byId[m.id] = m; });
      names[`b:${data.buscentreId}`] = "Held directly by the buscentre";
      groups.push({ id: "direct", name: "Buscentre", lanes: [{ key: `b:${data.buscentreId}`, title: "Held directly", hint: "No cell yet", cap: false, members: data.direct }] });
    }
    return { groups, home, byId, names };
  }, [data]);

  const keyOf = (id: string) => staged[id] ?? home[id];
  const max = data?.capacity.max ?? 5;
  const moves = Object.keys(staged);

  function put(id: string, key: string) {
    const m = byId[id]; setSel(null); setOver(null);
    if (!m) return;
    if (m.lock) { setErrs([`${m.name}: ${m.lock}.`]); return; }
    setErrs([]);
    setStaged((s) => {
      const n = { ...s };
      if (key === home[id]) delete n[id]; else n[id] = key;
      return n;
    });
  }

  async function apply() {
    setBusy(true); setErrs([]); setNotes([]);
    const byDest: Record<string, string[]> = {};
    moves.forEach((id) => (byDest[staged[id]] ??= []).push(id));
    const failed: string[] = []; const msgs: string[] = []; const kept: Record<string, string> = {};
    for (const [key, ids] of Object.entries(byDest)) {
      const r = await api<MoveResult>("/api/members/move", "POST", { memberIds: ids, reason: reason.trim() || null, ...dest(key) });
      if (!r.ok) { failed.push(`${names[key]}: ${r.data.error ?? "couldn't move"}`); ids.forEach((id) => (kept[id] = key)); continue; }
      msgs.push(`${r.data.moved} moved to ${r.data.to}`);
      r.data.skipped.forEach((s) => msgs.push(`${s.name} wasn't moved — ${s.reason}`));
      if (r.data.overCapacity) msgs.push(`${r.data.to} is now over its limit (${r.data.overCapacity.count}/${r.data.overCapacity.max}), logged as a capacity warning`);
    }
    setBusy(false); setErrs(failed); setNotes(msgs);
    setStaged(kept); if (Object.keys(kept).length === 0) { setReview(false); setReason(""); }
    reload();
  }

  if (error) return <LoadError compact message={error} onRetry={reload} />;
  if (!data) return <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>{loading ? "Loading…" : "Choose where to look."}</p>;

  return (
    <div className="flex flex-col gap-4 pb-28">
      <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>
        Drag a member onto another shepherd, or tap the member and then the shepherd. Nothing changes until you apply.
        {" "}Limit: {max} per shepherd{data.capacity.enforce ? " (enforced)" : " (going over is allowed, and flagged)"}.
      </p>

      {notes.map((n, i) => <p key={i} className="text-[13px] rounded-lg px-3 py-2" style={{ background: "var(--tint-ok-bg)", color: "var(--tint-ok-fg)" }}>{n}</p>)}
      {errs.map((n, i) => <p key={i} className="text-[13px] rounded-lg px-3 py-2" style={{ background: "var(--tint-danger-bg)", color: "var(--tint-danger-fg)" }}>{n}</p>)}

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {groups.map((g) => (
          <div key={g.id} className="flex flex-col gap-2 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--brand-muted)" }}>{g.name}</p>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              {g.lanes.map((lane) => {
                const members = Object.keys(byId).filter((id) => keyOf(id) === lane.key).map((id) => byId[id]);
                const n = members.length;
                const target = over === lane.key || (sel !== null && keyOf(sel) !== lane.key);
                return (
                  <div key={lane.key}
                       onDragOver={(e) => { e.preventDefault(); setOver(lane.key); }}
                       onDragLeave={() => setOver((o) => (o === lane.key ? null : o))}
                       onDrop={(e) => { e.preventDefault(); put(e.dataTransfer.getData("text/plain"), lane.key); }}
                       onClick={(e) => { if (sel && !(e.target as HTMLElement).closest("[data-chip]")) put(sel, lane.key); }}
                       className="rounded-xl p-3 flex flex-col gap-2.5 min-w-0 transition-colors"
                       style={{ border: `1px ${lane.cap && n > max ? "dashed" : "solid"} ${target ? "var(--brand-link)" : "var(--brand-border)"}`, background: over === lane.key ? "var(--brand-navy-light)" : "var(--surface)" }}>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="text-[13px] font-semibold truncate" style={{ color: "var(--brand-text)" }}>{lane.title}</h3>
                        <span className="text-[11px] shrink-0" style={{ color: "var(--brand-muted)" }}>{lane.hint}</span>
                      </div>
                      {lane.cap ? <CapLine n={n} max={max} /> : <span className="text-[12px]" style={{ color: "var(--brand-muted)" }}>{n} member{n === 1 ? "" : "s"}</span>}
                      {lane.cap && n > max && (
                        <span className="text-[11px] font-medium self-start px-2 py-0.5 rounded-full" style={{ background: "var(--tint-warn-bg)", color: "var(--tint-warn-fg)" }}>
                          {data.capacity.enforce ? "Over the limit — will be refused" : "Over the limit — will be logged"}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 min-h-[40px]">
                      {members.map((m) => {
                        const moved = staged[m.id] !== undefined;
                        return (
                          <div key={m.id} data-chip draggable={!m.lock} role="button" tabIndex={0}
                               onDragStart={(e) => { e.dataTransfer.setData("text/plain", m.id); e.dataTransfer.effectAllowed = "move"; }}
                               onClick={() => (m.lock ? setErrs([`${m.name}: ${m.lock}.`]) : setSel(sel === m.id ? null : m.id))}
                               onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!m.lock) setSel(sel === m.id ? null : m.id); } }}
                               className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-[13px]"
                               style={{
                                 border: `1px solid ${sel === m.id ? "var(--brand-link)" : moved ? "var(--brand-link)" : "var(--brand-border)"}`,
                                 boxShadow: sel === m.id ? "0 0 0 2px var(--brand-link)" : undefined,
                                 background: moved ? "var(--brand-navy-light)" : "var(--surface)",
                                 color: m.lock || !m.isActive ? "var(--brand-muted)" : "var(--brand-text)",
                                 cursor: m.lock ? "not-allowed" : "grab",
                               }}>
                            <span className="min-w-0">
                              <span className="block truncate">{m.name}</span>
                              {moved && <span className="block text-[11px]" style={{ color: "var(--brand-muted)" }}>from {names[home[m.id]]}</span>}
                              {!moved && m.lock && <span className="flex items-center gap-1 text-[11px]"><Lock className="h-3 w-3 shrink-0" /><span className="truncate">{m.lock}</span></span>}
                              {!moved && !m.lock && !m.isActive && <span className="block text-[11px]">Inactive</span>}
                            </span>
                            {moved && (
                              <button type="button" className="text-[12px] px-1" style={{ color: "var(--brand-link)" }}
                                      onClick={(e) => { e.stopPropagation(); put(m.id, home[m.id]); }}>Undo</button>
                            )}
                          </div>
                        );
                      })}
                      {n === 0 && <div className="text-[12px] text-center py-2.5 rounded-lg" style={{ border: "1px dashed var(--brand-border)", color: "var(--brand-muted)" }}>No members</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {moves.length > 0 && (
        <div className="fixed left-0 right-0 bottom-0 z-30 px-4 pt-3" style={{ background: "var(--surface)", borderTop: "1px solid var(--brand-border)", paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}>
          <div className="max-w-4xl mx-auto flex flex-col gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <strong className="text-[14px]" style={{ color: "var(--brand-text)" }}>{moves.length} move{moves.length > 1 ? "s" : ""} staged</strong>
              <button type="button" className="text-[13px]" style={{ color: "var(--brand-link)" }} onClick={() => setReview((r) => !r)}>{review ? "Hide" : "Review"}</button>
              <span className="flex-1" />
              <button type="button" className="h-10 px-4 text-[13px] rounded-lg" style={{ border: "1px solid var(--brand-border)" }} onClick={() => { setStaged({}); setReview(false); }}>Discard</button>
              <PrimaryButton busy={busy} onClick={apply}>Apply {moves.length} move{moves.length > 1 ? "s" : ""}</PrimaryButton>
            </div>
            {review && (
              <>
                <div className="max-h-[26vh] overflow-auto flex flex-col gap-1">
                  {moves.map((id) => (
                    <p key={id} className="text-[13px]" style={{ color: "var(--brand-text)" }}>
                      <b className="font-medium">{byId[id].name}</b>{" "}
                      <span style={{ color: "var(--brand-muted)" }}>{names[home[id]]} → {names[staged[id]]}</span>
                    </p>
                  ))}
                </div>
                <input className={inputCls} style={inputStyle} placeholder="Reason for all of these (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
