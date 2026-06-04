"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle, Clock, UserPlus, UserCheck, Phone, MapPin, Users, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type AttendanceStatus = "PRESENT" | "ABSENT" | "EXCUSED";
type FirstTimerIntent = "JUST_VISITING" | "UNDECIDED" | "WANTS_TO_JOIN";

const INTENT_LABELS: Record<FirstTimerIntent, string> = {
  JUST_VISITING: "Just visiting",
  UNDECIDED:     "Undecided",
  WANTS_TO_JOIN: "Wants to join",
};

const INTENT_STYLE: Record<FirstTimerIntent, { bg: string; color: string }> = {
  JUST_VISITING: { bg: "#F9FAFB",  color: "var(--brand-muted)" },
  UNDECIDED:     { bg: "#FEF3DC",  color: "#854F0B" },
  WANTS_TO_JOIN: { bg: "#E0F4EC",  color: "#085041" },
};

type FirstTimer = {
  id:                  string;
  firstName:           string;
  lastName:            string;
  phone:               string | null;
  location:            string | null;
  referredBy:          string | null;
  intent:              FirstTimerIntent;
  convertedToMemberId: string | null;
  convertedAt:         string | null;
  convertedMember:     { id: string; firstName: string; lastName: string } | null;
};

type ServiceDetail = {
  id:        string;
  type:      "LC_LIVE" | "MGS";
  date:      string;
  mode:      "IN_PERSON" | "ONLINE";
  notes:     string | null;
  createdAt: string;
  stats: { total: number; present: number; absent: number; excused: number };
  firstTimers: FirstTimer[];
  attendance: {
    id:     string;
    status: AttendanceStatus;
    notes:  string | null;
    member: {
      id:        string;
      firstName: string;
      lastName:  string;
      gender:    string | null;
      isActive:  boolean;
      shepherd: {
        id:     string;
        user:   { name: string } | null;
        person: { firstName: string; lastName: string } | null;
      } | null;
    };
  }[];
};


function StatusButton({
  value, current, onChange,
}: {
  value: AttendanceStatus; current: AttendanceStatus; onChange: (v: AttendanceStatus) => void;
}) {
  const isActive = current === value;
  const labels = { PRESENT: "P", ABSENT: "A", EXCUSED: "E" };
  const styles: Record<AttendanceStatus, React.CSSProperties> = {
    PRESENT: { background: "#E0F4EC", color: "#085041", border: "2px solid #1A8C6C" },
    ABSENT:  { background: "#FDECEA", color: "#791F1F", border: "2px solid var(--brand-danger)" },
    EXCUSED: { background: "#FEF3DC", color: "#854F0B", border: "2px solid var(--brand-warning)" },
  };
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className="w-8 h-8 rounded-lg text-[12px] font-semibold transition-all"
      style={isActive ? styles[value] : { background: "#fff", color: "var(--brand-muted)", border: "1px solid var(--brand-border)" }}
    >
      {labels[value]}
    </button>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function shepherdLabel(s: ServiceDetail["attendance"][0]["member"]["shepherd"]): string {
  if (!s) return "No shepherd";
  if (s.user)   return s.user.name;
  if (s.person) return `${s.person.firstName} ${s.person.lastName}`;
  return "Unassigned";
}

export default function AttendanceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [service,  setService]  = useState<ServiceDetail | null>(null);
  const [overrides,   setOverrides]   = useState<Record<string, AttendanceStatus>>({});
  const [saving,      setSaving]      = useState<string | null>(null);
  const [converting,  setConverting]  = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);

  // Add-first-timer form state
  const [addingFT,    setAddingFT]    = useState(false);
  const [ftForm,      setFtForm]      = useState({ firstName: "", lastName: "", phone: "", location: "", referredBy: "", intent: "UNDECIDED" as FirstTimerIntent });
  const [ftSaving,    setFtSaving]    = useState(false);
  const [ftError,     setFtError]     = useState("");

  useEffect(() => {
    fetch(`/api/services/${id}`)
      .then((r) => r.json())
      .then(setService)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  async function convertFirstTimer(ftId: string) {
    setConverting(ftId);
    await fetch(`/api/first-timers/${ftId}/convert`, { method: "POST" });
    setConverting(null);
    fetch(`/api/services/${id}`).then((r) => r.json()).then(setService);
  }

  async function submitAddFT(e: React.FormEvent) {
    e.preventDefault();
    if (!ftForm.firstName.trim() || !ftForm.lastName.trim()) {
      setFtError("First name and last name are required."); return;
    }
    setFtSaving(true); setFtError("");
    const res = await fetch("/api/first-timers", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId: id, ...ftForm }),
    });
    setFtSaving(false);
    if (res.ok) {
      setAddingFT(false);
      setFtForm({ firstName: "", lastName: "", phone: "", location: "", referredBy: "", intent: "UNDECIDED" });
      fetch(`/api/services/${id}`).then((r) => r.json()).then(setService);
    } else {
      const d = await res.json().catch(() => ({}));
      setFtError(d.error ?? "Failed to add first timer.");
    }
  }

  async function updateStatus(memberId: string, status: AttendanceStatus) {
    setOverrides((prev) => ({ ...prev, [memberId]: status }));
    setSaving(memberId);
    await fetch(`/api/services/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ memberId, status }),
    });
    setSaving(null);
    // Refresh stats
    fetch(`/api/services/${id}`).then((r) => r.json()).then(setService);
  }

  if (loading) return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[800px] mx-auto">
      <div className="skeleton h-7 w-48 rounded mb-6" />
      <div className="flex flex-col gap-3">
        {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}
      </div>
    </div>
  );

  if (!service) return (
    <div className="px-4 sm:px-6 lg:px-8 py-12 text-center">
      <p style={{ color: "var(--brand-muted)" }}>Service not found.</p>
    </div>
  );

  const grouped = service.attendance.reduce<Record<string, { label: string; records: typeof service.attendance }>>((acc, a) => {
    const key   = a.member.shepherd?.id ?? "__none__";
    const label = shepherdLabel(a.member.shepherd);
    if (!acc[key]) acc[key] = { label, records: [] };
    acc[key].records.push(a);
    return acc;
  }, {});

  const rate = service.stats.total > 0
    ? Math.round((service.stats.present / service.stats.total) * 100)
    : 0;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[800px] mx-auto pb-20 lg:pb-8">

      {/* Header */}
      <div className="mb-6">
        <Link href="/attendance"
              className="flex items-center gap-1.5 text-[13px] hover:underline mb-3"
              style={{ color: "var(--brand-muted)" }}>
          <ArrowLeft className="h-3.5 w-3.5" /> All services
        </Link>
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span
            className="rounded-pill text-[12px] font-semibold px-2.5 py-0.5"
            style={{ background: service.type === "LC_LIVE" ? "var(--brand-navy)" : "#1A8C6C", color: "#fff" }}
          >
            {service.type === "LC_LIVE" ? "LC LIVE" : "MGS"}
          </span>
          {service.mode === "ONLINE" && (
            <span className="rounded-pill text-[12px] font-medium px-2 py-0.5"
                  style={{ background: "#FEF3DC", color: "#854F0B" }}>Online</span>
          )}
          <h1 className="text-[20px] font-semibold" style={{ color: "var(--brand-text)" }}>
            {formatDate(service.date)}
          </h1>
        </div>
        {service.notes && (
          <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>{service.notes}</p>
        )}
      </div>

      {/* Stats */}
      <div className="rounded-xl px-5 py-4 mb-6 grid grid-cols-4 gap-4"
           style={{ border: "1px solid var(--brand-border)" }}>
        {[
          { label: "Present", value: service.stats.present, color: "var(--brand-success)", icon: CheckCircle2 },
          { label: "Absent",  value: service.stats.absent,  color: "var(--brand-danger)",  icon: XCircle },
          { label: "Excused", value: service.stats.excused, color: "var(--brand-warning)", icon: Clock },
          { label: "Rate",    value: `${rate}%`,            color: rate >= 80 ? "var(--brand-success)" : rate >= 60 ? "var(--brand-warning)" : "var(--brand-danger)", icon: CheckCircle2 },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <span className="text-[22px] font-semibold" style={{ color }}>{value}</span>
            <span className="text-[11px] font-medium uppercase tracking-[0.04em]"
                  style={{ color: "var(--brand-muted)" }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Stats bar — add first timers count */}
      {(service.firstTimers?.length ?? 0) > 0 && (
        <div className="rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2"
             style={{ background: "var(--brand-navy-light)", border: "1px solid var(--brand-border)" }}>
          <UserPlus className="h-3.5 w-3.5" style={{ color: "var(--brand-navy)" }} />
          <span className="text-[13px] font-medium" style={{ color: "var(--brand-navy)" }}>
            {service.firstTimers.length} first timer{service.firstTimers.length !== 1 ? "s" : ""} recorded
          </span>
          <span className="text-[12px] ml-1" style={{ color: "var(--brand-muted)" }}>
            · {service.firstTimers.filter((ft) => ft.convertedToMemberId).length} converted to member
          </span>
        </div>
      )}

      {/* Member list by shepherd */}
      <div className="flex flex-col gap-4">
        {Object.entries(grouped).map(([key, group]) => (
          <div key={key} className="rounded-xl overflow-hidden"
               style={{ border: "1px solid var(--brand-border)" }}>
            <div className="px-4 py-2.5 flex items-center gap-2"
                 style={{ background: "#F9FAFB", borderBottom: "1px solid var(--brand-border)" }}>
              <span className="text-[12px] font-medium uppercase tracking-[0.04em]"
                    style={{ color: "var(--brand-muted)" }}>Shepherd:</span>
              <span className="text-[13px] font-medium" style={{ color: "var(--brand-text)" }}>
                {group.label}
              </span>
            </div>

            {group.records.map((a, i) => {
              const status   = overrides[a.member.id] ?? a.status;
              const initials = `${a.member.firstName[0] ?? ""}${a.member.lastName[0] ?? ""}`.toUpperCase();
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom: i < group.records.length - 1 ? "1px solid var(--brand-border)" : "none" }}
                >
                  <div
                    className="flex items-center justify-center rounded-lg text-[12px] font-semibold shrink-0"
                    style={{
                      width: 32, height: 32,
                      background: status === "PRESENT" ? "#1A8C6C" : status === "ABSENT" ? "#C0392B" : "#B87015",
                      color: "#fff",
                    }}
                  >
                    {initials}
                  </div>
                  <span className="flex-1 text-[14px] font-medium" style={{ color: "var(--brand-text)" }}>
                    {a.member.firstName} {a.member.lastName}
                    {a.member.gender && (
                      <span className="ml-1.5 text-[12px] font-normal" style={{ color: "var(--brand-muted)" }}>
                        {a.member.gender[0]}
                      </span>
                    )}
                  </span>

                  {/* Inline edit buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    {saving === a.member.id ? (
                      <span className="text-[12px]" style={{ color: "var(--brand-muted)" }}>…</span>
                    ) : (
                      (["PRESENT", "ABSENT", "EXCUSED"] as AttendanceStatus[]).map((s) => (
                        <StatusButton
                          key={s}
                          value={s}
                          current={status}
                          onChange={(v) => updateStatus(a.member.id, v)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── First Timers section ── */}
      <div className="mt-8">
        <div className="flex items-center gap-3 mb-4">
          <UserPlus className="h-4 w-4" style={{ color: "var(--brand-navy)" }} />
          <h2 className="text-[16px] font-semibold flex-1" style={{ color: "var(--brand-text)" }}>
            First Timers
            {(service.firstTimers?.length ?? 0) > 0 && (
              <span className="ml-2 rounded-pill text-[11px] font-medium px-2 py-0.5"
                    style={{ background: "var(--brand-navy)", color: "#fff" }}>
                {service.firstTimers.length}
              </span>
            )}
          </h2>
          {!addingFT && (
            <button
              onClick={() => setAddingFT(true)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium transition-colors"
              style={{ background: "var(--brand-navy-light)", color: "var(--brand-navy)", border: "1px solid var(--brand-border)" }}
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          )}
        </div>

        {/* Inline add form */}
        {addingFT && (
          <form onSubmit={submitAddFT}
                className="rounded-xl p-4 flex flex-col gap-3 mb-4"
                style={{ border: "1px solid var(--brand-border)", background: "var(--brand-navy-light)" }}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[12px] font-semibold uppercase tracking-[0.05em]"
                 style={{ color: "var(--brand-navy)" }}>New First Timer</p>
              <button type="button" onClick={() => { setAddingFT(false); setFtError(""); }}
                      className="p-1 rounded hover:opacity-70" style={{ color: "var(--brand-muted)" }}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "firstName", label: "First name *", placeholder: "e.g. Abena" },
                { key: "lastName",  label: "Last name *",  placeholder: "e.g. Mensah" },
                { key: "phone",     label: "Phone",        placeholder: "024 000 0000" },
                { key: "location",  label: "Location",     placeholder: "e.g. East Legon" },
              ].map(({ key, label, placeholder }) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className="text-[10px] font-medium uppercase tracking-[0.04em]"
                         style={{ color: "var(--brand-muted)" }}>{label}</label>
                  <input
                    value={ftForm[key as keyof typeof ftForm] as string}
                    onChange={(e) => setFtForm((f) => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="h-9 px-3 text-[13px] rounded-lg"
                    style={{ border: "1px solid var(--brand-border)", outline: "none", background: "#fff" }}
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium uppercase tracking-[0.04em]"
                     style={{ color: "var(--brand-muted)" }}>Brought by</label>
              <input
                value={ftForm.referredBy}
                onChange={(e) => setFtForm((f) => ({ ...f, referredBy: e.target.value }))}
                placeholder="Name of shepherd / member who brought them"
                className="h-9 px-3 text-[13px] rounded-lg"
                style={{ border: "1px solid var(--brand-border)", outline: "none", background: "#fff" }}
              />
            </div>

            <div className="flex gap-2">
              {(["JUST_VISITING", "UNDECIDED", "WANTS_TO_JOIN"] as FirstTimerIntent[]).map((intent) => (
                <button
                  key={intent} type="button"
                  onClick={() => setFtForm((f) => ({ ...f, intent }))}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                  style={ftForm.intent === intent
                    ? { background: "var(--brand-navy)", color: "#fff" }
                    : { background: "#fff", color: "var(--brand-muted)", border: "1px solid var(--brand-border)" }}
                >
                  {INTENT_LABELS[intent]}
                </button>
              ))}
            </div>

            {ftError && <p className="text-[12px]" style={{ color: "var(--brand-danger)" }}>{ftError}</p>}

            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setAddingFT(false); setFtError(""); }}
                      className="h-8 px-3 rounded-lg text-[12px]" style={{ color: "var(--brand-muted)" }}>
                Cancel
              </button>
              <Button type="submit" disabled={ftSaving} className="h-8 px-4 text-[12px]"
                      style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}>
                {ftSaving ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        )}

        {(service.firstTimers?.length ?? 0) === 0 && !addingFT ? (
          <div className="rounded-xl py-6 text-center mb-4"
               style={{ border: "2px dashed var(--brand-border)" }}>
            <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>
              No first timers recorded for this service
            </p>
          </div>
        ) : (

          <div className="flex flex-col gap-3">
            {(service.firstTimers ?? []).map((ft) => {
              const isConverted = !!ft.convertedToMemberId;
              const intentStyle = INTENT_STYLE[ft.intent];
              return (
                <div key={ft.id} className="rounded-xl overflow-hidden"
                     style={{ border: `1px solid ${isConverted ? "#A8D5BE" : "var(--brand-border)"}` }}>
                  <div className="px-4 py-3 flex items-center gap-3"
                       style={{ background: isConverted ? "#E0F4EC" : "#FAFAFA",
                                borderBottom: "1px solid var(--brand-border)" }}>
                    {/* Avatar */}
                    <div className="flex items-center justify-center rounded-lg shrink-0 text-[12px] font-bold"
                         style={{ width: 34, height: 34,
                                  background: isConverted ? "#1A8C6C" : "var(--brand-navy)", color: "#fff" }}>
                      {ft.firstName[0]}{ft.lastName[0]}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold" style={{ color: "var(--brand-text)" }}>
                        {ft.firstName} {ft.lastName}
                      </p>
                      <div className="flex items-center gap-3 flex-wrap mt-0.5">
                        {ft.phone && (
                          <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--brand-muted)" }}>
                            <Phone style={{ width: 10, height: 10 }} /> {ft.phone}
                          </span>
                        )}
                        {ft.location && (
                          <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--brand-muted)" }}>
                            <MapPin style={{ width: 10, height: 10 }} /> {ft.location}
                          </span>
                        )}
                        {ft.referredBy && (
                          <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--brand-muted)" }}>
                            <Users style={{ width: 10, height: 10 }} /> Brought by {ft.referredBy}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Intent badge */}
                      <span className="rounded-pill text-[11px] font-medium px-2 py-0.5"
                            style={{ background: intentStyle.bg, color: intentStyle.color }}>
                        {INTENT_LABELS[ft.intent]}
                      </span>

                      {/* Convert / converted status */}
                      {isConverted ? (
                        <span className="flex items-center gap-1 rounded-pill text-[11px] font-medium px-2 py-0.5"
                              style={{ background: "#E0F4EC", color: "#085041" }}>
                          <UserCheck style={{ width: 11, height: 11 }} /> Member
                        </span>
                      ) : (
                        <button
                          onClick={() => convertFirstTimer(ft.id)}
                          disabled={converting === ft.id}
                          className="flex items-center gap-1 rounded-lg text-[12px] font-medium px-3 py-1.5 transition-colors hover:opacity-80 disabled:opacity-40"
                          style={{ background: "var(--brand-navy)", color: "#fff" }}
                        >
                          <UserPlus style={{ width: 12, height: 12 }} />
                          {converting === ft.id ? "Converting…" : "Convert to member"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Converted member link */}
                  {isConverted && ft.convertedMember && (
                    <div className="px-4 py-2 text-[12px]" style={{ color: "var(--brand-muted)" }}>
                      Converted → <span className="font-medium" style={{ color: "var(--brand-text)" }}>
                        {ft.convertedMember.firstName} {ft.convertedMember.lastName}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
