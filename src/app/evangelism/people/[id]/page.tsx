"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Phone, MapPin, MessageCircle, Footprints, Mail, StickyNote, Megaphone, ArrowRightLeft } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";
import { LoadError } from "@/components/load-error";
import { MembershipActions } from "@/components/evangelism/membership-actions";
import { CONVERSATION_LABEL, radarStatus } from "@/lib/radar";
import {
  api, Field, fmtDate, fmtDateTime, fullName, inputCls, inputStyle, PrimaryButton,
  RESPONSE_LABELS, SERVICE_LABELS, StageBadge, STAGE_LABELS,
} from "@/components/evangelism/shared";

type Person = { id: string; firstName: string; lastName: string };
type Detail = {
  id: string; firstName: string; lastName: string | null; phone: string | null; homeArea: string | null;
  ageRange: string | null; gender: string | null; stage: string; doNotContact: boolean; notes: string | null;
  firstMetAt: string; cellId: string | null;
  cell: { id: string; name: string } | null; buscentre: { name: string } | null;
  followUpOwner: Person | null; convertedMember: Person | null;
  conversationAt: string | null; conversationOutcome: string | null; conversationNote: string | null;
  access: { canConverse: boolean; canAdd: boolean };
  firstTimer: { service: { id: string; date: string; type: string } } | null;
  guestVisits: { service: { id: string; date: string; type: string } }[];
  encounters: { id: string; metAt: string; response: string; metLocation: string | null; notes: string | null;
    outreach: { id: string; title: string } | null; metBy: Person | null }[];
  activities: { id: string; type: string; outcome: string | null; note: string | null; createdAt: string;
    invitedServiceDate: string | null; invitedServiceType: string | null; by: { name: string | null } }[];
};

const ACTIVITY_ICON: Record<string, React.ElementType> = {
  CALL: Phone, WHATSAPP: MessageCircle, VISIT: Footprints, INVITED: Mail, NOTE: StickyNote, REASSIGNED: ArrowRightLeft, STAGE_CHANGE: ArrowRightLeft,
};
const SIDE = ["NOT_INTERESTED", "UNREACHABLE", "OUT_OF_AREA", "DO_NOT_CONTACT"];

export default function ContactPage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD]         = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [cells, setCells] = useState<{ id: string; name: string }[]>([]);
  const [owners, setOwners] = useState<Person[]>([]);

  const [type, setType]   = useState("CALL");
  const [note, setNote]   = useState("");
  const [inviteDate, setInviteDate] = useState("");
  const [inviteType, setInviteType] = useState("MGS");
  const [msg, setMsg]     = useState("");
  const [busy, setBusy]   = useState(false);
  const [sideNote, setSideNote] = useState("");

  const load = useCallback(async () => {
    setError("");
    try { setD(await fetchJson<Detail>(`/api/evangelism/contacts/${id}`)); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't load"); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetchJson<{ id: string; name: string }[]>("/api/cells").then(setCells).catch(() => setCells([])); }, []);
  useEffect(() => {
    if (!d?.cellId) { setOwners([]); return; }
    fetchJson<Person[]>(`/api/members?cellId=${d.cellId}&isActive=true`).then(setOwners).catch(() => setOwners([]));
  }, [d?.cellId]);

  // One chronological journey out of meetings and follow-ups
  const journey = useMemo(() => {
    if (!d) return [];
    return [
      ...d.encounters.map((e) => ({ at: e.metAt, kind: "met" as const, e })),
      ...d.activities.map((a) => ({ at: a.createdAt, kind: "act" as const, a })),
    ].sort((x, y) => +new Date(y.at) - +new Date(x.at));
  }, [d]);

  async function patch(body: Record<string, unknown>) {
    setMsg("");
    const r = await api(`/api/evangelism/contacts/${id}`, "PATCH", body);
    if (!r.ok) return setMsg(r.data.error ?? "Couldn't update");
    setSideNote(""); load();
  }

  async function log() {
    setBusy(true); setMsg("");
    const r = await api(`/api/evangelism/contacts/${id}/activities`, "POST", {
      type, note: note || null,
      ...(type === "INVITED" ? { invitedServiceDate: inviteDate, invitedServiceType: inviteType } : {}),
    });
    setBusy(false);
    if (!r.ok) return setMsg(r.data.error ?? "Couldn't save");
    setNote(""); setInviteDate(""); load();
  }

  if (error) return <div className="p-6"><LoadError message={error} onRetry={load} /></div>;
  if (!d)    return <p className="p-6 text-[13px]" style={{ color: "var(--brand-muted)" }}>Loading…</p>;

  const locked  = d.stage === "ATTENDED" || d.stage === "CONVERTED";
  const blocked = d.doNotContact;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto flex flex-col gap-6">
      <Link href="/evangelism" className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: "var(--brand-muted)" }}>
        <ArrowLeft className="h-4 w-4" /> Evangelism
      </Link>

      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-[20px] font-semibold" style={{ color: "var(--brand-text)" }}>{fullName(d)}</h1>
          <StageBadge stage={d.stage} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]" style={{ color: "var(--brand-muted)" }}>
          {d.phone && <a href={`tel:${d.phone}`} className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{d.phone}</a>}
          {d.homeArea && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{d.homeArea}</span>}
          <span>First met {fmtDate(d.firstMetAt)}</span>
          {(d.ageRange === "CHILD" || d.ageRange === "TEEN") && <span style={{ color: "var(--brand-warning)" }}>Minor</span>}
        </div>
        {blocked && <p className="text-[13px] px-3 py-2 rounded-lg" style={{ background: "var(--tint-danger-bg)", color: "var(--tint-danger-fg)" }}>This person asked not to be contacted. Phone is hidden and follow-ups are disabled.</p>}
        {d.convertedMember && <p className="text-[13px]" style={{ color: "var(--brand-success)" }}>Now a member: <Link className="underline" href={`/members/${d.convertedMember.id}`}>{fullName(d.convertedMember)}</Link></p>}
      </div>

      {/* Assignment */}
      <section className="rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ border: "1px solid var(--brand-border)", background: "var(--surface)" }}>
        <Field label="Cell responsible">
          <select className={inputCls} style={inputStyle} value={d.cellId ?? ""} onChange={(e) => e.target.value && patch({ cellId: e.target.value })}>
            <option value="">{d.buscentre ? `Not yet — held at ${d.buscentre.name}` : "Not yet assigned"}</option>
            {cells.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Follow-up by">
          <select className={inputCls} style={inputStyle} value={d.followUpOwner?.id ?? ""} disabled={!d.cellId}
                  onChange={(e) => patch({ followUpOwnerId: e.target.value || null })}>
            <option value="">{d.cellId ? "Nobody yet" : "Assign a cell first"}</option>
            {owners.map((m) => <option key={m.id} value={m.id}>{fullName(m)}</option>)}
          </select>
        </Field>
      </section>

      {/* Membership — the guest's visits, the buscentre head's conversation, and adding them to their cell */}
      {d.stage === "ATTENDED" && (() => {
        const byService = new Map<string, string>();
        if (d.firstTimer) byService.set(d.firstTimer.service.id, d.firstTimer.service.date.slice(0, 10));
        d.guestVisits.forEach((g) => byService.set(g.service.id, g.service.date.slice(0, 10)));
        const dates = Array.from(byService.values()).sort();
        const today = new Date().toISOString().slice(0, 10);
        const status = radarStatus(dates, d.conversationAt, today);
        const thisMonth = dates.filter((x) => x.startsWith(today.slice(0, 7)));
        return (
          <section className="rounded-xl p-4 flex flex-col gap-3" style={{ border: "1px solid var(--brand-border)", background: "var(--surface)" }}>
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--brand-text)" }}>Membership</h2>
            <p className="text-[13px]" style={{ color: "var(--brand-text)" }}>
              Has come to {dates.length} service{dates.length === 1 ? "" : "s"}{thisMonth.length ? ` · ${thisMonth.length} this month` : ""}
              {dates.length ? <span style={{ color: "var(--brand-muted)" }}> ({dates.map((x) => fmtDate(x).replace(/ \d{4}$/, "")).join(", ")})</span> : null}
            </p>
            {status.state === "radar" && (
              <p className="text-[12px] px-3 py-2 rounded-lg" style={{ background: "var(--tint-warn-bg)", color: "var(--tint-warn-fg)" }}>
                On the buscentre head&apos;s radar — {status.visits} services this month. Time to ask whether they would love to stay.
              </p>
            )}
            {status.state === "nearly" && <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>One more service this month puts them on the buscentre head&apos;s radar.</p>}
            {d.conversationAt && (
              <p className="text-[12px] rounded-lg px-3 py-2" style={{ background: "var(--brand-navy-light)", color: "var(--brand-text)" }}>
                Conversation on {fmtDate(d.conversationAt)}: <b>{CONVERSATION_LABEL[d.conversationOutcome ?? ""] ?? "recorded"}</b>{d.conversationNote ? ` — ${d.conversationNote}` : ""}
              </p>
            )}
            <MembershipActions contactId={d.id} canConverse={d.access.canConverse} canAdd={d.access.canAdd}
                               hasSurname={!!d.lastName} hasCell={!!d.cellId} onChanged={load} />
          </section>
        );
      })()}

      {/* Log follow-up */}
      {!blocked && (
        <section className="rounded-xl p-4 flex flex-col gap-3" style={{ border: "1px solid var(--brand-border)", background: "var(--surface)" }}>
          <h2 className="text-[15px] font-semibold" style={{ color: "var(--brand-text)" }}>Log follow-up</h2>
          <div className="flex flex-wrap gap-2">
            {["CALL", "WHATSAPP", "VISIT", "INVITED", "NOTE"].map((t) => (
              <button key={t} onClick={() => setType(t)} className="text-[12px] px-3 py-1.5 rounded-full"
                      style={{ background: type === t ? "var(--brand-navy)" : "var(--brand-navy-light)", color: type === t ? "#fff" : "var(--brand-text)" }}>
                {t === "INVITED" ? "Invited to service" : t.charAt(0) + t.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          {type === "INVITED" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Service date *"><input type="date" className={inputCls} style={inputStyle} value={inviteDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setInviteDate(e.target.value)} /></Field>
              <Field label="Service">
                <select className={inputCls} style={inputStyle} value={inviteType} onChange={(e) => setInviteType(e.target.value)}>
                  {Object.entries(SERVICE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
            </div>
          )}
          <textarea rows={2} className="w-full px-3 py-2.5 text-[14px] rounded-lg resize-none" style={inputStyle} value={note}
                    onChange={(e) => setNote(e.target.value)} placeholder={type === "NOTE" ? "Note *" : "How did it go? (optional)"} />
          <PrimaryButton busy={busy} disabled={(type === "INVITED" && !inviteDate) || (type === "NOTE" && !note.trim())} onClick={log}>Save</PrimaryButton>
        </section>
      )}

      {/* Stage */}
      {!locked && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[15px] font-semibold" style={{ color: "var(--brand-text)" }}>
            {SIDE.includes(d.stage) ? "Reopen" : "Close out"}
          </h2>
          {SIDE.includes(d.stage) ? (
            <div className="flex gap-2">
              <button className="text-[13px] px-3 py-2 rounded-lg" style={{ background: "var(--brand-navy-light)" }} onClick={() => patch({ stage: "CONTACTED" })}>Reopen as contacted</button>
              <button className="text-[13px] px-3 py-2 rounded-lg" style={{ background: "var(--brand-navy-light)" }} onClick={() => patch({ stage: "NEW" })}>Reopen as new</button>
            </div>
          ) : (
            <>
              <input className={inputCls} style={inputStyle} placeholder="Why? (required)" value={sideNote} onChange={(e) => setSideNote(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                {SIDE.map((s) => (
                  <button key={s} disabled={!sideNote.trim()} onClick={() => patch({ stage: s, stageNote: sideNote })}
                          className="text-[12px] px-3 py-1.5 rounded-full disabled:opacity-40" style={{ background: "var(--tint-danger-bg)", color: "var(--tint-danger-fg)" }}>
                    {STAGE_LABELS[s]}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {msg && <p className="text-[13px]" style={{ color: "var(--brand-danger)" }}>{msg}</p>}

      {/* Journey */}
      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--brand-text)" }}>Journey</h2>
        {journey.map((j) => {
          if (j.kind === "met") {
            const e = j.e;
            return (
              <div key={`e${e.id}`} className="flex gap-3">
                <Megaphone className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--brand-link)" }} />
                <div>
                  <p className="text-[13px]" style={{ color: "var(--brand-text)" }}>
                    Met{e.outreach ? <> on <Link className="underline" href={`/evangelism/${e.outreach.id}`}>{e.outreach.title}</Link></> : " (personal evangelism)"}
                    {e.metLocation ? ` — ${e.metLocation}` : ""} · {RESPONSE_LABELS[e.response]}
                  </p>
                  <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>{fmtDateTime(e.metAt)}{e.metBy ? ` · by ${fullName(e.metBy)}` : ""}{e.notes ? ` · ${e.notes}` : ""}</p>
                </div>
              </div>
            );
          }
          const a = j.a; const Icon = ACTIVITY_ICON[a.type] ?? StickyNote;
          return (
            <div key={`a${a.id}`} className="flex gap-3">
              <Icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--brand-muted)" }} />
              <div>
                <p className="text-[13px]" style={{ color: "var(--brand-text)" }}>
                  {a.type === "INVITED" && a.invitedServiceDate
                    ? `Invited to ${SERVICE_LABELS[a.invitedServiceType ?? ""] ?? "service"} on ${fmtDate(a.invitedServiceDate)}`
                    : a.type.charAt(0) + a.type.slice(1).toLowerCase().replace("_", " ")}
                  {a.note ? ` — ${a.note}` : ""}
                </p>
                <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>{fmtDateTime(a.createdAt)}{a.by.name ? ` · ${a.by.name}` : ""}</p>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
