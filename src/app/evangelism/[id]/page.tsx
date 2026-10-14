"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, MapPin, Calendar, X, Search, Star } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";
import { LoadError } from "@/components/load-error";
import {
  api, Field, fmtDateTime, fullName, inputCls, inputStyle, OUTREACH_TYPES, PrimaryButton,
  RESPONSE_LABELS, StageBadge, StatusBadge,
} from "@/components/evangelism/shared";

type Person = { id: string; firstName: string; lastName: string };
type Detail = {
  id: string; title: string; type: string; status: string; startsAt: string; endsAt: string | null;
  locationName: string; area: string | null; notes: string | null; summary: string | null;
  peopleSpokenTo: number | null; decisionsForChrist: number | null; targetCount: number | null;
  cancelledReason: string | null; leadMemberId: string | null;
  team: { id: string; isLead: boolean; member: Person }[];
  encounters: {
    id: string; metAt: string; response: string; metLocation: string | null; notes: string | null;
    contact: { id: string; firstName: string; lastName: string | null; phone: string | null; stage: string };
    metBy: Person | null;
  }[];
  funnel: { met: number; withPhone: number; decisions: number; invited: number; attended: number; converted: number };
};

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg px-3 py-2 text-center" style={{ background: "var(--brand-navy-light)" }}>
      <p className="text-[18px] font-semibold" style={{ color: "var(--brand-text)" }}>{value}</p>
      <p className="text-[11px]" style={{ color: "var(--brand-muted)" }}>{label}</p>
    </div>
  );
}

// ─── Team ─────────────────────────────────────────────────────────────────────

function TeamEditor({ d, onChange }: { d: Detail; onChange: () => void }) {
  const [q, setQ]           = useState("");
  const [results, setRes]   = useState<Person[]>([]);
  const [err, setErr]       = useState("");
  const editable = d.status === "PLANNED" || d.status === "ONGOING";

  useEffect(() => {
    if (q.trim().length < 2) { setRes([]); return; }
    const t = setTimeout(async () => {
      try { setRes((await fetchJson<Person[]>(`/api/members?q=${encodeURIComponent(q.trim())}&isActive=true`)).slice(0, 6)); } catch { setRes([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function save(teamMemberIds: string[], leadMemberId: string | null) {
    setErr("");
    const r = await api(`/api/evangelism/outreaches/${d.id}`, "PATCH", { teamMemberIds, leadMemberId });
    if (!r.ok) return setErr(r.data.error ?? "Couldn't update the team");
    setQ(""); setRes([]); onChange();
  }
  const ids = d.team.map((t) => t.member.id);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[15px] font-semibold" style={{ color: "var(--brand-text)" }}>Team</h2>
      <div className="flex flex-wrap gap-2">
        {d.team.length === 0 && <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>No one yet.</p>}
        {d.team.map((t) => (
          <span key={t.id} className="inline-flex items-center gap-1.5 text-[13px] pl-3 pr-1.5 py-1 rounded-full"
                style={{ background: "var(--brand-navy-light)", color: "var(--brand-text)" }}>
            {fullName(t.member)}
            {editable && (
              <>
                <button title="Make lead" onClick={() => save(ids, t.isLead ? null : t.member.id)}>
                  <Star className="h-3.5 w-3.5" fill={t.isLead ? "currentColor" : "none"} style={{ color: t.isLead ? "var(--brand-warning)" : "var(--brand-muted)" }} />
                </button>
                <button title="Remove" onClick={() => save(ids.filter((i) => i !== t.member.id), t.isLead ? null : d.leadMemberId)}>
                  <X className="h-3.5 w-3.5" style={{ color: "var(--brand-muted)" }} />
                </button>
              </>
            )}
            {!editable && t.isLead && <Star className="h-3.5 w-3.5" fill="currentColor" style={{ color: "var(--brand-warning)" }} />}
          </span>
        ))}
      </div>
      {editable && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--brand-muted)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add a member to the team" className={`${inputCls} pl-9`} style={inputStyle} />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-lg overflow-hidden shadow-lg" style={{ background: "var(--surface)", border: "1px solid var(--brand-border)" }}>
              {results.filter((m) => !ids.includes(m.id)).map((m) => (
                <button key={m.id} className="block w-full text-left px-3 py-2 text-[14px] hover:bg-[var(--brand-navy-light)]"
                        onClick={() => save([...ids, m.id], d.leadMemberId)}>{fullName(m)}</button>
              ))}
            </div>
          )}
        </div>
      )}
      {err && <p className="text-[13px]" style={{ color: "var(--brand-danger)" }}>{err}</p>}
    </section>
  );
}

// ─── Record someone ───────────────────────────────────────────────────────────

const BLANK = { firstName: "", lastName: "", phone: "", ageRange: "", gender: "", homeArea: "", metLocation: "", response: "NEUTRAL", notes: "", metByMemberId: "" };

function RecordForm({ d, onSaved }: { d: Detail; onSaved: () => void }) {
  const [f, setF]       = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState("");
  const [dup, setDup]   = useState<{ id: string; name: string; stage: string } | null>(null);
  // One key per person entered, so a retried submit can never double-record
  const clientRef = useRef(crypto.randomUUID());
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(contactId?: string) {
    setBusy(true); setErr(""); if (!contactId) setDup(null);
    const common = {
      metLocation: f.metLocation || d.locationName, response: f.response, notes: f.notes || null,
      metByMemberId: f.metByMemberId || null, clientRef: clientRef.current,
    };
    const body = contactId ? { ...common, contactId } : {
      ...common,
      contact: { firstName: f.firstName, lastName: f.lastName || null, phone: f.phone || null, ageRange: f.ageRange || null, gender: f.gender || null, homeArea: f.homeArea || null },
    };
    const r = await api<{ contact?: { id: string; name: string; stage: string } }>(`/api/evangelism/outreaches/${d.id}/encounters`, "POST", body);
    setBusy(false);
    if (r.ok) { setF(BLANK); setDup(null); clientRef.current = crypto.randomUUID(); onSaved(); return; }
    if (r.data.code === "DUPLICATE_CONTACT" && r.data.contact) setDup(r.data.contact);
    setErr(r.data.error ?? "Couldn't save");
  }

  return (
    <section className="rounded-xl p-4 flex flex-col gap-3" style={{ border: "1px solid var(--brand-border)", background: "var(--surface)" }}>
      <h2 className="text-[15px] font-semibold" style={{ color: "var(--brand-text)" }}>Record someone you met</h2>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name *"><input className={inputCls} style={inputStyle} value={f.firstName} onChange={set("firstName")} /></Field>
        <Field label="Last name"><input className={inputCls} style={inputStyle} value={f.lastName} onChange={set("lastName")} /></Field>
        <Field label="Phone"><input inputMode="tel" className={inputCls} style={inputStyle} value={f.phone} onChange={set("phone")} placeholder="024 000 0000" /></Field>
        <Field label="Lives around"><input className={inputCls} style={inputStyle} value={f.homeArea} onChange={set("homeArea")} /></Field>
        <Field label="Age">
          <select className={inputCls} style={inputStyle} value={f.ageRange} onChange={set("ageRange")}>
            <option value="">—</option><option value="CHILD">Child</option><option value="TEEN">Teen</option>
            <option value="YOUTH">Youth</option><option value="ADULT">Adult</option><option value="ELDER">Elder</option>
          </select>
        </Field>
        <Field label="Gender">
          <select className={inputCls} style={inputStyle} value={f.gender} onChange={set("gender")}>
            <option value="">—</option><option value="Male">Male</option><option value="Female">Female</option>
          </select>
        </Field>
        <Field label="Response">
          <select className={inputCls} style={inputStyle} value={f.response} onChange={set("response")}>
            {Object.entries(RESPONSE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Met by">
          <select className={inputCls} style={inputStyle} value={f.metByMemberId} onChange={set("metByMemberId")}>
            <option value="">Me</option>
            {d.team.map((t) => <option key={t.member.id} value={t.member.id}>{fullName(t.member)}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Where exactly / notes">
        <input className={inputCls} style={inputStyle} value={f.metLocation} onChange={set("metLocation")} placeholder={d.locationName} />
      </Field>
      <textarea rows={2} className="w-full px-3 py-2.5 text-[14px] rounded-lg resize-none" style={inputStyle} value={f.notes}
                onChange={set("notes")} placeholder="Anything worth remembering for follow-up" />

      {err && <p className="text-[13px]" style={{ color: "var(--brand-danger)" }}>{err}</p>}
      {dup && (
        <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2" style={{ background: "var(--tint-warn-bg)", color: "var(--tint-warn-fg)" }}>
          <span className="text-[13px]">{dup.name} · <StageBadge stage={dup.stage} /></span>
          <button className="text-[13px] font-medium underline" onClick={() => submit(dup.id)}>Same person — link</button>
        </div>
      )}
      <PrimaryButton busy={busy} disabled={!f.firstName.trim()} onClick={() => submit()}>Save</PrimaryButton>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OutreachDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD]       = useState<Detail | null>(null);
  const [error, setErr] = useState("");
  const [tally, setTally] = useState({ peopleSpokenTo: "", decisionsForChrist: "", summary: "", reason: "" });
  const [actErr, setActErr] = useState("");
  const [closing, setClosing] = useState<"" | "COMPLETED" | "CANCELLED">("");

  const load = useCallback(async () => {
    setErr("");
    try { setD(await fetchJson<Detail>(`/api/evangelism/outreaches/${id}`)); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn't load"); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function move(status: "ONGOING" | "COMPLETED" | "CANCELLED") {
    setActErr("");
    const num = (v: string) => (v === "" ? undefined : Number(v));
    const r = await api(`/api/evangelism/outreaches/${id}`, "PATCH", {
      status,
      ...(status === "COMPLETED" ? { peopleSpokenTo: num(tally.peopleSpokenTo), decisionsForChrist: num(tally.decisionsForChrist), summary: tally.summary || undefined } : {}),
      ...(status === "CANCELLED" ? { cancelledReason: tally.reason } : {}),
    });
    if (!r.ok) return setActErr(r.data.error ?? "Couldn't update");
    setClosing(""); load();
  }

  if (error) return <div className="p-6"><LoadError message={error} onRetry={load} /></div>;
  if (!d)    return <p className="p-6 text-[13px]" style={{ color: "var(--brand-muted)" }}>Loading…</p>;

  const open = d.status === "PLANNED" || d.status === "ONGOING";

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto flex flex-col gap-6">
      <Link href="/evangelism" className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: "var(--brand-muted)" }}>
        <ArrowLeft className="h-4 w-4" /> Evangelism
      </Link>

      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-[20px] font-semibold" style={{ color: "var(--brand-text)" }}>{d.title}</h1>
          <StatusBadge status={d.status} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]" style={{ color: "var(--brand-muted)" }}>
          <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{fmtDateTime(d.startsAt)}</span>
          <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{d.locationName}{d.area ? `, ${d.area}` : ""}</span>
          <span>{OUTREACH_TYPES[d.type]}</span>
        </div>
        {d.notes && <p className="text-[13px]" style={{ color: "var(--brand-text)" }}>{d.notes}</p>}
        {d.cancelledReason && <p className="text-[13px]" style={{ color: "var(--brand-danger)" }}>Cancelled: {d.cancelledReason}</p>}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <Stat label="Met" value={d.funnel.met} />
        <Stat label="With phone" value={d.funnel.withPhone} />
        <Stat label="Received Christ" value={d.funnel.decisions} />
        <Stat label="Invited" value={d.funnel.invited} />
        <Stat label="Came" value={d.funnel.attended} />
        <Stat label="Joined" value={d.funnel.converted} />
      </div>
      {(d.peopleSpokenTo != null || d.decisionsForChrist != null) && (
        <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>
          Headcount: {d.peopleSpokenTo ?? "—"} spoken to · {d.decisionsForChrist ?? "—"} decisions (includes people who gave no details)
          {d.summary ? ` — ${d.summary}` : ""}
        </p>
      )}

      <TeamEditor d={d} onChange={load} />

      {open && <RecordForm d={d} onSaved={load} />}

      {open && (
        <section className="flex flex-col gap-3">
          {closing === "" && (
            <div className="flex gap-2 flex-wrap">
              {d.status === "PLANNED" && <PrimaryButton onClick={() => move("ONGOING")}>Start now</PrimaryButton>}
              <PrimaryButton onClick={() => setClosing("COMPLETED")}>Complete…</PrimaryButton>
              <button className="h-10 px-4 text-[13px]" style={{ color: "var(--brand-danger)" }} onClick={() => setClosing("CANCELLED")}>Cancel…</button>
            </div>
          )}
          {closing === "COMPLETED" && (
            <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "var(--brand-navy-light)" }}>
              <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>Not everyone gives their details. Add the overall headcount here.</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="People spoken to"><input type="number" min={0} className={inputCls} style={inputStyle} value={tally.peopleSpokenTo} onChange={(e) => setTally((t) => ({ ...t, peopleSpokenTo: e.target.value }))} /></Field>
                <Field label="Decisions for Christ"><input type="number" min={0} className={inputCls} style={inputStyle} value={tally.decisionsForChrist} onChange={(e) => setTally((t) => ({ ...t, decisionsForChrist: e.target.value }))} /></Field>
              </div>
              <textarea rows={2} className="w-full px-3 py-2.5 text-[14px] rounded-lg resize-none" style={inputStyle} placeholder="How did it go?" value={tally.summary} onChange={(e) => setTally((t) => ({ ...t, summary: e.target.value }))} />
              <div className="flex gap-2 justify-end">
                <button className="h-10 px-4 text-[13px]" style={{ color: "var(--brand-muted)" }} onClick={() => setClosing("")}>Back</button>
                <PrimaryButton onClick={() => move("COMPLETED")}>Mark completed</PrimaryButton>
              </div>
            </div>
          )}
          {closing === "CANCELLED" && (
            <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "var(--tint-danger-bg)" }}>
              <input className={inputCls} style={inputStyle} placeholder="Why is it cancelled?" value={tally.reason} onChange={(e) => setTally((t) => ({ ...t, reason: e.target.value }))} />
              <div className="flex gap-2 justify-end">
                <button className="h-10 px-4 text-[13px]" onClick={() => setClosing("")}>Back</button>
                <PrimaryButton onClick={() => move("CANCELLED")}>Cancel outreach</PrimaryButton>
              </div>
            </div>
          )}
          {actErr && <p className="text-[13px]" style={{ color: "var(--brand-danger)" }}>{actErr}</p>}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--brand-text)" }}>People met ({d.encounters.length})</h2>
        {d.encounters.length === 0 && <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>No one recorded yet.</p>}
        {d.encounters.map((e) => (
          <Link key={e.id} href={`/evangelism/people/${e.contact.id}`} className="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                style={{ border: "1px solid var(--brand-border)", background: "var(--surface)" }}>
            <div className="min-w-0">
              <p className="text-[14px] font-medium truncate" style={{ color: "var(--brand-text)" }}>{fullName(e.contact)}</p>
              <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
                {RESPONSE_LABELS[e.response]} · {fmtDateTime(e.metAt)}{e.metBy ? ` · by ${fullName(e.metBy)}` : ""}{e.contact.phone ? ` · ${e.contact.phone}` : ""}
              </p>
            </div>
            <StageBadge stage={e.contact.stage} />
          </Link>
        ))}
      </section>
    </div>
  );
}
