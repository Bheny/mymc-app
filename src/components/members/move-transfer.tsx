"use client";

import { useEffect, useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { api, Field, inputCls, inputStyle, PrimaryButton } from "@/components/evangelism/shared";
import { Cascade, CapLine, useBoard, usePicker, type Level, type MoveResult } from "@/components/members/move-shared";

// Transfer: pick the shepherd to move people from, tick who goes, choose where.
// The destination previews its headcount (striped pips = people arriving).

const LEVELS: { key: Level; label: string }[] = [
  { key: "shepherd", label: "A shepherd" }, { key: "cell", label: "A cell (no shepherd)" },
  { key: "buscentre", label: "A buscentre" }, { key: "mc", label: "An MC" },
];

export function MoveTransfer() {
  const from = usePicker("shepherd");
  const [level, setLevel] = useState<Level>("shepherd");
  const to = usePicker(level);

  const fromBoard = useBoard(from.shepherdId ? `shepherdId=${from.shepherdId}` : null);
  const toBoard   = useBoard(level === "shepherd" && to.shepherdId ? `shepherdId=${to.shepherdId}` : null);

  const [pick, setPick] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<MoveResult | null>(null);

  const people = useMemo(() => fromBoard.data?.cells[0]?.shepherds[0]?.members ?? [], [fromBoard.data]);
  const destMembers = toBoard.data?.cells[0]?.shepherds[0]?.members ?? [];
  const max = fromBoard.data?.capacity.max ?? toBoard.data?.capacity.max ?? 5;
  const enforce = fromBoard.data?.capacity.enforce ?? toBoard.data?.capacity.enforce ?? false;
  const movable = people.filter((m) => !m.lock);
  const picked = people.filter((m) => pick.has(m.id));

  useEffect(() => { setPick(new Set()); }, [from.shepherdId]);

  const target = level === "shepherd" ? to.shepherdId : level === "cell" ? to.cellId : level === "buscentre" ? to.buscentreId : to.mcId;
  const same = level === "shepherd" && to.shepherdId === from.shepherdId;
  const after = destMembers.length + picked.length;
  const ready = picked.length > 0 && !!target && !same;

  async function go() {
    setBusy(true); setErr(""); setResult(null);
    const r = await api<MoveResult>("/api/members/move", "POST", {
      memberIds: picked.map((m) => m.id), level, reason: reason.trim() || null,
      shepherdId: to.shepherdId || null, cellId: to.cellId || null, buscentreId: to.buscentreId || null, mcId: to.mcId || null,
    });
    setBusy(false);
    if (!r.ok) return setErr(r.data.error ?? "Couldn't move them");
    setResult(r.data); setPick(new Set()); setReason("");
    fromBoard.reload(); toBoard.reload();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 items-start">
        {/* From */}
        <section className="rounded-xl p-4 flex flex-col gap-3 min-w-0" style={{ border: "1px solid var(--brand-border)", background: "var(--surface)" }}>
          <h3 className="text-[13px] font-semibold" style={{ color: "var(--brand-text)" }}>From</h3>
          <Cascade p={from} depth="shepherd" />
          {fromBoard.error && <p className="text-[13px]" style={{ color: "var(--brand-danger)" }}>{fromBoard.error}</p>}
          {from.shepherdId && !fromBoard.error && (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px]" style={{ color: "var(--brand-muted)" }}>{people.length} member{people.length === 1 ? "" : "s"}</span>
                {movable.length > 0 && (
                  <button type="button" className="text-[13px]" style={{ color: "var(--brand-link)" }}
                          onClick={() => setPick(picked.length === movable.length ? new Set() : new Set(movable.map((m) => m.id)))}>
                    {picked.length === movable.length ? "Clear" : "Select all movable"}
                  </button>
                )}
              </div>
              <div className="flex flex-col">
                {people.map((m) => (
                  <label key={m.id} className="flex items-center gap-3 py-2.5 border-t first:border-t-0"
                         style={{ borderColor: "var(--brand-border)", cursor: m.lock ? "not-allowed" : "pointer", color: m.lock ? "var(--brand-muted)" : "var(--brand-text)" }}>
                    <input type="checkbox" className="h-[18px] w-[18px]" disabled={!!m.lock} checked={pick.has(m.id)}
                           onChange={(e) => setPick((p) => { const n = new Set(p); e.target.checked ? n.add(m.id) : n.delete(m.id); return n; })} />
                    <span className="min-w-0 text-[14px]">
                      {m.name}{!m.isActive && <span className="text-[11px]"> · inactive</span>}
                      {m.lock && <span className="flex items-center gap-1 text-[11px]"><Lock className="h-3 w-3 shrink-0" />{m.lock}</span>}
                    </span>
                  </label>
                ))}
                {people.length === 0 && !fromBoard.loading && <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>No members under this shepherd.</p>}
              </div>
            </>
          )}
        </section>

        {/* To */}
        <section className="rounded-xl p-4 flex flex-col gap-3 min-w-0" style={{ border: "1px solid var(--brand-border)", background: "var(--surface)" }}>
          <h3 className="text-[13px] font-semibold" style={{ color: "var(--brand-text)" }}>To</h3>
          <div className="grid grid-cols-2 gap-2">
            {LEVELS.map((l) => (
              <button key={l.key} type="button" onClick={() => setLevel(l.key)} className="text-left px-3 py-2 rounded-lg text-[13px] font-medium"
                      style={level === l.key ? { background: "var(--brand-navy)", color: "#fff" } : { background: "var(--surface)", color: "var(--brand-text)", border: "1px solid var(--brand-border)" }}>
                {l.label}
              </button>
            ))}
          </div>
          <Cascade p={to} depth={level} />
          {same && <p className="text-[13px]" style={{ color: "var(--brand-warning)" }}>That is the shepherd they are already with.</p>}

          {level === "shepherd" && to.shepherdId && !same && (
            <>
              <CapLine n={destMembers.length} incoming={picked.length} max={max} />
              {after > max && (
                <span className="text-[12px] font-medium self-start px-2 py-0.5 rounded-full" style={{ background: "var(--tint-warn-bg)", color: "var(--tint-warn-fg)" }}>
                  {enforce ? `Would have ${after}; the limit is ${max} and it is enforced, so this will be refused` : `Would have ${after}, over the limit of ${max}. Allowed, but logged.`}
                </span>
              )}
              <div className="flex flex-col">
                {destMembers.map((m) => <p key={m.id} className="py-2 border-t first:border-t-0 text-[14px]" style={{ borderColor: "var(--brand-border)", color: "var(--brand-text)" }}>{m.name}</p>)}
                {picked.map((m) => (
                  <p key={m.id} className="py-2 px-2 rounded-md flex items-center justify-between text-[14px]" style={{ background: "var(--brand-navy-light)", color: "var(--brand-text)" }}>
                    {m.name}<span className="text-[11px]" style={{ color: "var(--brand-muted)" }}>arriving</span>
                  </p>
                ))}
              </div>
            </>
          )}

          <Field label="Reason (optional)">
            <input className={inputCls} style={inputStyle} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Relocated closer to this cell" />
          </Field>
          {err && <p className="text-[13px]" style={{ color: "var(--brand-danger)" }}>{err}</p>}
          <PrimaryButton busy={busy} disabled={!ready} onClick={go}>Move {picked.length || ""} member{picked.length === 1 ? "" : "s"}</PrimaryButton>
        </section>
      </div>

      {result && (
        <section className="rounded-xl p-4 flex flex-col gap-2" style={{ background: "var(--brand-navy-light)" }}>
          <p className="text-[14px] font-semibold" style={{ color: "var(--brand-text)" }}>Moved {result.moved} to {result.to}</p>
          {result.overCapacity && (
            <p className="text-[13px]" style={{ color: "var(--brand-warning)" }}>
              That shepherd now has {result.overCapacity.count} members, over the limit of {result.overCapacity.max}. It was logged as a capacity warning.
            </p>
          )}
          {result.skipped.map((s) => <p key={s.id} className="text-[13px]" style={{ color: "var(--brand-text)" }}>{s.name} wasn&apos;t moved — {s.reason}</p>)}
        </section>
      )}
    </div>
  );
}
