"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone, Plus, Search, MapPin, Calendar, Users, Phone, AlertCircle } from "lucide-react";
import { RadarList } from "@/components/evangelism/radar-list";
import { fetchJson } from "@/lib/fetch-json";
import { LoadError } from "@/components/load-error";
import { useActiveRole } from "@/hooks/use-active-role";
import {
  api, Field, fmtDate, fmtDateTime, fullName, inputCls, inputStyle, OUTREACH_TYPES, PrimaryButton,
  StageBadge, StatusBadge, STAGE_LABELS,
} from "@/components/evangelism/shared";

type Outreach = {
  id: string; title: string; type: string; status: string; startsAt: string; locationName: string;
  ownerName: string; level: string; recordedDecisions: number;
  lead: { firstName: string; lastName: string } | null;
  _count: { team: number; encounters: number };
};
type Contact = {
  id: string; firstName: string; lastName: string | null; phone: string | null; stage: string;
  homeArea: string | null; lastActivityAt: string; cell: { name: string } | null;
  followUpOwner: { firstName: string; lastName: string } | null; _count: { encounters: number };
};
type ContactList = { contacts: Contact[]; total: number; byStage: Record<string, number> };

const FILTERS = ["open", "NEW", "CONTACTED", "INVITED", "ATTENDED", "CONVERTED", "NOT_INTERESTED", "UNREACHABLE", "OUT_OF_AREA"];

function NewOutreachForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [f, setF] = useState({ title: "", type: "STREET", startsAt: "", locationName: "", area: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit() {
    setBusy(true); setErr("");
    const r = await api("/api/evangelism/outreaches", "POST", { ...f, startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : undefined });
    setBusy(false);
    if (!r.ok) return setErr(r.data.error ?? "Couldn't save");
    onDone();
  }

  return (
    <div className="rounded-xl p-5 flex flex-col gap-4" style={{ border: "1px solid var(--brand-border)", background: "var(--brand-navy-light)" }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Title *"><input className={inputCls} style={inputStyle} value={f.title} onChange={set("title")} placeholder="e.g. Saturday market outreach" /></Field>
        <Field label="Type">
          <select className={inputCls} style={inputStyle} value={f.type} onChange={set("type")}>
            {Object.entries(OUTREACH_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Starts *"><input type="datetime-local" className={inputCls} style={inputStyle} value={f.startsAt} onChange={set("startsAt")} /></Field>
        <Field label="Where *"><input className={inputCls} style={inputStyle} value={f.locationName} onChange={set("locationName")} placeholder="e.g. Madina Market" /></Field>
        <Field label="Area"><input className={inputCls} style={inputStyle} value={f.area} onChange={set("area")} placeholder="Neighbourhood / town" /></Field>
      </div>
      <Field label="Notes">
        <textarea rows={2} className="w-full px-3 py-2.5 text-[14px] rounded-lg resize-none" style={inputStyle} value={f.notes} onChange={set("notes")} />
      </Field>
      {err && <p className="text-[13px]" style={{ color: "var(--brand-danger)" }}>{err}</p>}
      <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>Planned at your own level. Add the team and lead on the next screen.</p>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="h-10 px-4 text-[13px]" style={{ color: "var(--brand-muted)" }}>Cancel</button>
        <PrimaryButton busy={busy} onClick={submit}>Plan outreach</PrimaryButton>
      </div>
    </div>
  );
}

export default function EvangelismPage() {
  const { activeView, ready } = useActiveRole();
  const canPlan = !!activeView && activeView.role !== "shepherd";
  // Buscentre heads and above hold the conversations with guests who keep coming
  const canTalk = ["buscentre_head", "mc_pastor", "chief_shepherd", "admin"].includes(activeView?.role ?? "");
  const radarActing = !activeView?.isActing ? ""
    : activeView.role === "buscentre_head" && activeView.buscentreId ? `actingBuscentreId=${activeView.buscentreId}`
    : activeView.role === "mc_pastor" && activeView.mcId ? `actingMcId=${activeView.mcId}`
    : activeView.role === "chief_shepherd" && activeView.branchId ? `actingBranchId=${activeView.branchId}` : "";

  const [tab, setTab]           = useState<"outreaches" | "people" | "radar">("outreaches");
  const [outreaches, setOut]    = useState<Outreach[] | null>(null);
  const [people, setPeople]     = useState<ContactList | null>(null);
  const [filter, setFilter]     = useState("open");
  const [q, setQ]               = useState("");
  const [adding, setAdding]     = useState(false);
  const [error, setError]       = useState("");

  const loadOutreaches = useCallback(async () => {
    setError("");
    try { setOut(await fetchJson<Outreach[]>("/api/evangelism/outreaches")); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't load"); }
  }, []);

  const loadPeople = useCallback(async () => {
    setError("");
    const p = new URLSearchParams();
    if (filter === "open") p.set("open", "1"); else p.set("stage", filter);
    if (q.trim()) p.set("q", q.trim());
    try { setPeople(await fetchJson<ContactList>(`/api/evangelism/contacts?${p}`)); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't load"); }
  }, [filter, q]);

  useEffect(() => { if (ready) loadOutreaches(); }, [ready, loadOutreaches]);
  // Arrive on the radar when linked from the overview (/evangelism?tab=radar)
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "radar") setTab("radar");
  }, []);
  useEffect(() => {
    if (!ready || tab !== "people") return;
    const t = setTimeout(loadPeople, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [ready, tab, loadPeople, q]);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Megaphone className="h-5 w-5" style={{ color: "var(--brand-link)" }} />
          <h1 className="text-[20px] font-semibold" style={{ color: "var(--brand-text)" }}>Evangelism</h1>
        </div>
        {canPlan && tab === "outreaches" && !adding && (
          <PrimaryButton onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Plan outreach</PrimaryButton>
        )}
      </div>

      <div className="flex gap-1 border-b" style={{ borderColor: "var(--brand-border)" }}>
        {(["outreaches", "people", ...(canTalk ? ["radar" as const] : [])] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className="px-4 py-2 text-[14px] font-medium -mb-px border-b-2"
                  style={{ borderColor: tab === t ? "var(--brand-navy)" : "transparent", color: tab === t ? "var(--brand-link)" : "var(--brand-muted)" }}>
            {t === "outreaches" ? "Outreaches" : t === "people" ? "People" : "Radar"}
          </button>
        ))}
      </div>

      {error && <LoadError message={error} onRetry={tab === "people" ? loadPeople : loadOutreaches} compact />}

      {tab === "outreaches" && !error && (
        <>
          {adding && <NewOutreachForm onCancel={() => setAdding(false)} onDone={() => { setAdding(false); loadOutreaches(); }} />}
          {!outreaches ? <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>Loading…</p>
            : outreaches.length === 0 ? (
              <div className="text-center py-12 text-[14px]" style={{ color: "var(--brand-muted)" }}>
                No outreaches yet.{canPlan ? " Plan the first one." : ""}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {outreaches.map((o) => (
                  <Link key={o.id} href={`/evangelism/${o.id}`} className="rounded-xl p-4 flex flex-col gap-2"
                        style={{ border: "1px solid var(--brand-border)", background: "var(--surface)" }}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[15px] font-medium" style={{ color: "var(--brand-text)" }}>{o.title}</p>
                      <StatusBadge status={o.status} />
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]" style={{ color: "var(--brand-muted)" }}>
                      <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDateTime(o.startsAt)}</span>
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{o.locationName}</span>
                      <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{o._count.team} on team</span>
                      <span>{OUTREACH_TYPES[o.type]} · {o.ownerName}</span>
                    </div>
                    <p className="text-[12px]" style={{ color: "var(--brand-text)" }}>
                      {o._count.encounters} met · {o.recordedDecisions} received Christ
                    </p>
                  </Link>
                ))}
              </div>
            )}
        </>
      )}

      {tab === "radar" && canTalk && <RadarList actingParam={radarActing} canAdd />}

      {tab === "people" && !error && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--brand-muted)" }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone or area"
                   className={`${inputCls} pl-9`} style={inputStyle} />
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((s) => (
              <button key={s} onClick={() => setFilter(s)} className="text-[12px] px-3 py-1.5 rounded-full"
                      style={{ background: filter === s ? "var(--brand-navy)" : "var(--brand-navy-light)", color: filter === s ? "#fff" : "var(--brand-text)" }}>
                {s === "open" ? "Being worked" : STAGE_LABELS[s]}
                {s !== "open" && people?.byStage[s] ? ` · ${people.byStage[s]}` : ""}
              </button>
            ))}
          </div>
          {!people ? <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>Loading…</p>
            : people.contacts.length === 0 ? (
              <p className="text-center py-12 text-[14px]" style={{ color: "var(--brand-muted)" }}>No one here.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {people.contacts.map((c) => (
                  <Link key={c.id} href={`/evangelism/people/${c.id}`} className="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                        style={{ border: "1px solid var(--brand-border)", background: "var(--surface)" }}>
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium truncate" style={{ color: "var(--brand-text)" }}>{fullName(c)}</p>
                      <p className="text-[12px] flex flex-wrap gap-x-3" style={{ color: "var(--brand-muted)" }}>
                        {c.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                        {c.homeArea && <span>{c.homeArea}</span>}
                        <span>{c.cell ? c.cell.name : <span className="inline-flex items-center gap-1" style={{ color: "var(--brand-warning)" }}><AlertCircle className="h-3 w-3" />No cell yet</span>}</span>
                        <span>last activity {fmtDate(c.lastActivityAt)}</span>
                      </p>
                    </div>
                    <StageBadge stage={c.stage} />
                  </Link>
                ))}
                <p className="text-[12px] text-center" style={{ color: "var(--brand-muted)" }}>{people.total} total</p>
              </div>
            )}
        </>
      )}
    </div>
  );
}
