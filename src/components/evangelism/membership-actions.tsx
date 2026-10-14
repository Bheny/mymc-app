"use client";

import { useState } from "react";
import { api, inputCls, inputStyle, PrimaryButton } from "@/components/evangelism/shared";
import { CONVERSATION_LABEL } from "@/lib/radar";

// The two decisions about a guest who keeps coming:
//   · the buscentre head's conversation — do they want to stay?
//   · adding them to their cell as a member. This is open at any time: most wait for the
//     conversation, but some decide at the very first meeting.

const OUTCOMES = ["WANTS_TO_JOIN", "STILL_DECIDING", "NOT_STAYING"] as const;

export function MembershipActions({ contactId, canConverse, canAdd, hasSurname, hasCell, onChanged, compact }: {
  contactId: string;
  canConverse: boolean;       // buscentre head or above
  canAdd: boolean;            // cell shepherd or above
  hasSurname: boolean;
  hasCell: boolean;
  onChanged: () => void;
  compact?: boolean;
}) {
  const [mode, setMode] = useState<"" | "talk" | "add">("");
  const [outcome, setOutcome] = useState<(typeof OUTCOMES)[number]>("WANTS_TO_JOIN");
  const [note, setNote] = useState("");
  const [surname, setSurname] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function talk() {
    setBusy(true); setMsg("");
    const r = await api(`/api/evangelism/contacts/${contactId}/conversation`, "POST", { outcome, note: note || null });
    setBusy(false);
    if (!r.ok) return setMsg(r.data.error ?? "Couldn't save");
    setMode(""); setNote(""); onChanged();
  }

  async function add() {
    setBusy(true); setMsg("");
    const r = await api(`/api/evangelism/contacts/${contactId}/convert`, "POST", { lastName: surname || undefined });
    setBusy(false);
    if (!r.ok) return setMsg(r.data.error ?? "Couldn't add them");
    setMode(""); onChanged();
  }

  if (!canConverse && !canAdd) return null;

  return (
    <div className="flex flex-col gap-2.5">
      {mode === "" && (
        <div className="flex flex-wrap gap-2">
          {canConverse && (
            <button type="button" onClick={() => setMode("talk")} className="h-9 px-3 rounded-lg text-[13px] font-medium"
                    style={{ background: "var(--brand-navy)", color: "#fff" }}>Record conversation</button>
          )}
          {canAdd && (
            <button type="button" onClick={() => setMode("add")} className="h-9 px-3 rounded-lg text-[13px] font-medium"
                    style={{ border: "1px solid var(--brand-border)", color: "var(--brand-link)", background: "var(--surface)" }}>
              Add as member{compact ? "" : " to their cell"}
            </button>
          )}
        </div>
      )}

      {mode === "talk" && (
        <div className="rounded-lg p-3 flex flex-col gap-2.5" style={{ background: "var(--brand-navy-light)" }}>
          <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>How did the conversation go?</p>
          <div className="flex flex-wrap gap-2">
            {OUTCOMES.map((o) => (
              <button key={o} type="button" onClick={() => setOutcome(o)} className="text-[12px] px-3 py-1.5 rounded-full"
                      style={outcome === o ? { background: "var(--brand-navy)", color: "#fff" } : { background: "var(--surface)", color: "var(--brand-text)", border: "1px solid var(--brand-border)" }}>
                {CONVERSATION_LABEL[o]}
              </button>
            ))}
          </div>
          <textarea rows={2} className="w-full px-3 py-2 text-[13px] rounded-lg resize-none" style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder={outcome === "NOT_STAYING" ? "Why aren't they staying? (required)" : "Anything worth remembering (optional)"} />
          {outcome === "NOT_STAYING" && <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>This closes their outreach record. It can be reopened later.</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" className="h-9 px-3 text-[13px]" style={{ color: "var(--brand-muted)" }} onClick={() => { setMode(""); setMsg(""); }}>Cancel</button>
            <PrimaryButton busy={busy} onClick={talk}>Save</PrimaryButton>
          </div>
        </div>
      )}

      {mode === "add" && (
        <div className="rounded-lg p-3 flex flex-col gap-2.5" style={{ background: "var(--brand-navy-light)" }}>
          <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
            This adds them to their cell as a member. You can do this at any time, including after their very first visit.
          </p>
          {!hasCell && <p className="text-[12px]" style={{ color: "var(--brand-warning)" }}>They aren&apos;t assigned to a cell yet. Assign one on their page first.</p>}
          {!hasSurname && (
            <input className={inputCls} style={inputStyle} value={surname} onChange={(e) => setSurname(e.target.value)} placeholder="Surname (needed for the member record)" />
          )}
          <div className="flex gap-2 justify-end">
            <button type="button" className="h-9 px-3 text-[13px]" style={{ color: "var(--brand-muted)" }} onClick={() => { setMode(""); setMsg(""); }}>Cancel</button>
            <PrimaryButton busy={busy} disabled={!hasCell || (!hasSurname && !surname.trim())} onClick={add}>Add as member</PrimaryButton>
          </div>
        </div>
      )}

      {msg && <p className="text-[13px]" style={{ color: "var(--brand-danger)" }}>{msg}</p>}
    </div>
  );
}
