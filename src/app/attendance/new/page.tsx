"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle, Clock, Users, UserPlus, Trash2, Plus, Mic2, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useActiveRole } from "@/hooks/use-active-role";
import { useSession } from "next-auth/react";

type FirstTimerIntent = "JUST_VISITING" | "UNDECIDED" | "WANTS_TO_JOIN";

type FirstTimerDraft = {
  _key:       number;
  firstName:  string;
  lastName:   string;
  phone:      string;
  location:   string;
  referredBy: string;
  intent:     FirstTimerIntent;
};

const INTENT_LABELS: Record<FirstTimerIntent, string> = {
  JUST_VISITING:  "Just visiting",
  UNDECIDED:      "Undecided",
  WANTS_TO_JOIN:  "Wants to join",
};

function emptyDraft(key: number): FirstTimerDraft {
  return { _key: key, firstName: "", lastName: "", phone: "", location: "", referredBy: "", intent: "UNDECIDED" };
}

type Member = {
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

// Shepherd slot from /api/org/shepherds — person.id is the member ID needed for attendance
type ShepherdSlot = {
  id:     string;
  user:   { name: string } | null;
  person: { id: string; firstName: string; lastName: string } | null;
  _count: { members: number };
};

type AttendanceStatus = "PRESENT" | "ABSENT" | "EXCUSED";
type ServiceType = "LC_LIVE" | "MGS" | "SHEPHERDS_MEETING" | "SPECIAL_MEETING";
type ServiceMode = "IN_PERSON" | "ONLINE";

const SERVICE_CONFIG: Record<ServiceType, {
  label: string;
  day: string;
  color: string;
  description: string;
}> = {
  LC_LIVE:           { label: "LC Live",          day: "Wednesday", color: "var(--brand-navy)", description: "Wednesday cell service" },
  MGS:               { label: "MGS",              day: "Sunday",    color: "#1A8C6C",           description: "Sunday Mega Gospel Service" },
  SHEPHERDS_MEETING: { label: "Shepherds Meeting",day: "Friday",    color: "#7C3AED",           description: "Weekly Friday shepherds meeting" },
  SPECIAL_MEETING:   { label: "Special Meeting",  day: "Any day",   color: "#B45309",           description: "Guest minister / special program" },
};

// Suggest based on day of week
function suggestServiceType(): ServiceType {
  const day = new Date().getDay(); // 0=Sun,3=Wed,5=Fri
  if (day === 3) return "LC_LIVE";
  if (day === 0) return "MGS";
  if (day === 5) return "SHEPHERDS_MEETING";
  return "LC_LIVE";
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function shepherdLabel(s: Member["shepherd"]): string {
  if (!s) return "No shepherd";
  if (s.user)   return s.user.name;
  if (s.person) return `${s.person.firstName} ${s.person.lastName}`;
  return "Unassigned shepherd";
}

function StatusButton({
  value, current, onChange,
}: {
  value:    AttendanceStatus;
  current:  AttendanceStatus | null;
  onChange: (v: AttendanceStatus) => void;
}) {
  const config: Record<AttendanceStatus, { label: string; active: React.CSSProperties; inactive: React.CSSProperties }> = {
    PRESENT: {
      label: "P",
      active:   { background: "#E0F4EC", color: "#085041", border: "2px solid #1A8C6C" },
      inactive: { background: "#fff", color: "var(--brand-muted)", border: "1px solid var(--brand-border)" },
    },
    ABSENT: {
      label: "A",
      active:   { background: "#FDECEA", color: "#791F1F", border: "2px solid var(--brand-danger)" },
      inactive: { background: "#fff", color: "var(--brand-muted)", border: "1px solid var(--brand-border)" },
    },
    EXCUSED: {
      label: "E",
      active:   { background: "#FEF3DC", color: "#854F0B", border: "2px solid var(--brand-warning)" },
      inactive: { background: "#fff", color: "var(--brand-muted)", border: "1px solid var(--brand-border)" },
    },
  };

  const c = config[value];
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className="w-10 h-10 sm:w-9 sm:h-9 rounded-lg text-[13px] font-semibold flex items-center justify-center transition-all"
      style={current === value ? c.active : c.inactive}
      title={value.charAt(0) + value.slice(1).toLowerCase()}
    >
      {c.label}
    </button>
  );
}

export default function NewAttendancePage() {
  const router = useRouter();
  const { data: session }     = useSession();
  const { activeView, ready } = useActiveRole();
  const actingCellId = activeView?.isActing && activeView.cellId ? activeView.cellId : null;

  // Service fields — pre-fill from URL params when navigating from a gaps row
  const [serviceType, setServiceType] = useState<ServiceType>(suggestServiceType());
  const [serviceDate, setServiceDate] = useState(todayISO());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp   = new URLSearchParams(window.location.search);
    const date = sp.get("date");
    const type = sp.get("type") as ServiceType | null;
    if (date) setServiceDate(date);
    if (type && Object.keys(SERVICE_CONFIG).includes(type)) setServiceType(type);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [serviceMode, setServiceMode] = useState<ServiceMode>("IN_PERSON");
  const [speaker,     setSpeaker]     = useState("");
  const [notes,       setNotes]       = useState("");

  // The cell this user belongs to (primary or acting)
  const cellId = activeView?.cellId ?? null;

  // Members + attendance map
  const [allMembers,        setAllMembers]        = useState<Member[]>([]);
  const [shepherdAttendees, setShepherdAttendees] = useState<Member[]>([]);
  const [attendance,        setAttendance]        = useState<Record<string, AttendanceStatus | null>>({});
  const [loadingMembers,    setLoadingMembers]    = useState(true);

  // First timers (not shown for Shepherds Meeting)
  const [firstTimers,  setFirstTimers]  = useState<FirstTimerDraft[]>([]);
  const [ftKeyCounter, setFtKeyCounter] = useState(0);

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const isShepherdsMeeting = serviceType === "SHEPHERDS_MEETING";
  // Shepherds Meeting uses the shepherd slot holders; all other types use regular cell members
  const members = isShepherdsMeeting ? shepherdAttendees : allMembers;

  function addFirstTimer() {
    const key = ftKeyCounter + 1;
    setFtKeyCounter(key);
    setFirstTimers((prev) => [...prev, emptyDraft(key)]);
  }
  function updateFT(key: number, patch: Partial<FirstTimerDraft>) {
    setFirstTimers((prev) => prev.map((ft) => ft._key === key ? { ...ft, ...patch } : ft));
  }
  function removeFT(key: number) {
    setFirstTimers((prev) => prev.filter((ft) => ft._key !== key));
  }

  // Load regular cell members — scoped to the active cell.
  // `ready` must be in the dep array: without it, if cellId is already set when
  // ready flips true the effect never re-runs and the skeleton stays forever.
  useEffect(() => {
    if (!ready || !cellId) return;
    setLoadingMembers(true);
    fetch(`/api/members?cellId=${cellId}`)
      .then((r) => r.json())
      .then((data: Member[]) => {
        const active = data.filter((m) => m.isActive);
        setAllMembers(active);
        const init: Record<string, null> = {};
        active.forEach((m) => { init[m.id] = null; });
        setAttendance(init);
        setLoadingMembers(false);
      })
      .catch(() => setLoadingMembers(false));
  }, [ready, cellId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load shepherd slot holders for Shepherds Meeting — same dep-array fix
  useEffect(() => {
    if (!ready || serviceType !== "SHEPHERDS_MEETING" || !cellId) return;
    fetch(`/api/org/shepherds?cellId=${cellId}`)
      .then((r) => r.json())
      .then((slots: ShepherdSlot[]) => {
        // Only slots with a person (member record) can be tracked in the Attendance table
        const attendees: Member[] = slots
          .filter((s) => s.person !== null)
          .map((s) => ({
            id:        s.person!.id,
            firstName: s.person!.firstName,
            lastName:  s.person!.lastName,
            gender:    null,
            isActive:  true,
            shepherd:  null,
          }));
        setShepherdAttendees(attendees);
        // Fresh attendance map for this service type
        const init: Record<string, null> = {};
        attendees.forEach((m) => { init[m.id] = null; });
        setAttendance(init);
      })
      .catch(() => {});
  }, [ready, serviceType, cellId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-initialise attendance map when switching away from Shepherds Meeting back to normal types
  useEffect(() => {
    if (serviceType === "SHEPHERDS_MEETING") return; // handled above
    setAttendance((prev) => {
      const next: Record<string, AttendanceStatus | null> = {};
      allMembers.forEach((m) => { next[m.id] = prev[m.id] ?? null; });
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceType]);

  // Group displayed members by shepherd
  const grouped = members.reduce<Record<string, { label: string; members: Member[] }>>((acc, m) => {
    const key   = m.shepherd?.id ?? "__none__";
    const label = shepherdLabel(m.shepherd);
    if (!acc[key]) acc[key] = { label, members: [] };
    acc[key].members.push(m);
    return acc;
  }, {});

  const marked  = Object.values(attendance).filter((v) => v !== null).length;
  const total   = members.length;
  const present = Object.values(attendance).filter((v) => v === "PRESENT").length;
  const absent  = Object.values(attendance).filter((v) => v === "ABSENT").length;
  const excused = Object.values(attendance).filter((v) => v === "EXCUSED").length;
  const allDone = marked === total && total > 0;

  function setStatus(memberId: string, status: AttendanceStatus) {
    setAttendance((prev) => ({ ...prev, [memberId]: status }));
  }

  async function handleSubmit() {
    if (!allDone) { setError("Mark attendance for every member before submitting."); return; }
    setSaving(true); setError("");

    const records = Object.entries(attendance).map(([memberId, status]) => ({ memberId, status: status! }));
    const validFTs = firstTimers.filter((ft) => ft.firstName.trim() && ft.lastName.trim());

    const res = await fetch("/api/services", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type:         serviceType,
        date:         serviceDate,
        mode:         serviceMode,
        speaker:      speaker.trim() || null,
        notes:        notes.trim() || null,
        attendance:   records,
        actingCellId,
        firstTimers: isShepherdsMeeting ? [] : validFTs.map(({ firstName, lastName, phone, location, referredBy, intent }) => ({
          firstName, lastName,
          phone:      phone || null,
          location:   location || null,
          referredBy: referredBy || null,
          intent,
        })),
      }),
    });

    setSaving(false);
    if (res.ok) {
      router.push("/attendance");
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed to save attendance.");
    }
  }

  const svcCfg = SERVICE_CONFIG[serviceType];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[800px] mx-auto pb-20 lg:pb-8">

      {/* Header */}
      <div className="mb-6">
        <Link href="/attendance" className="flex items-center gap-1.5 text-[13px] mb-2 hover:underline w-fit"
              style={{ color: "var(--brand-muted)" }}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to attendance
        </Link>
        <h1 className="text-[22px] font-semibold" style={{ color: "var(--brand-text)" }}>
          Record Attendance
        </h1>
      </div>

      {/* ── Service details ── */}
      <div className="rounded-xl p-5 mb-6 flex flex-col gap-4"
           style={{ border: "1px solid var(--brand-border)" }}>
        <p className="text-[11px] font-medium uppercase tracking-[0.06em]"
           style={{ color: "var(--brand-muted)" }}>Service details</p>

        {/* Type grid — 2×2 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-medium" style={{ color: "var(--brand-muted)" }}>
            Service type <span style={{ color: "var(--brand-danger)" }}>*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(SERVICE_CONFIG) as [ServiceType, typeof SERVICE_CONFIG[ServiceType]][]).map(([t, cfg]) => (
              <button
                key={t}
                type="button"
                onClick={() => setServiceType(t)}
                className="text-left px-3 py-2.5 rounded-lg transition-colors"
                style={serviceType === t
                  ? { background: cfg.color, color: "#fff", border: `1px solid ${cfg.color}` }
                  : { background: "#fff", color: "var(--brand-text)", border: "1px solid var(--brand-border)" }}
              >
                <p className="text-[13px] font-semibold">{cfg.label}</p>
                <p className="text-[11px] mt-0.5 opacity-75">{cfg.day}</p>
              </button>
            ))}
          </div>
          <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>{svcCfg.description}</p>
        </div>

        {/* Date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-medium" style={{ color: "var(--brand-muted)" }}>
            Date <span style={{ color: "var(--brand-danger)" }}>*</span>
          </label>
          <input
            type="date"
            value={serviceDate}
            onChange={(e) => setServiceDate(e.target.value)}
            className="h-10 px-3 text-[14px] rounded-lg"
            style={{ border: "1px solid var(--brand-border)", color: "var(--brand-text)", background: "#fff" }}
          />
        </div>

        {/* Mode — LC LIVE only */}
        {serviceType === "LC_LIVE" && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium" style={{ color: "var(--brand-muted)" }}>Mode</label>
            <div className="flex gap-2">
              {(["IN_PERSON", "ONLINE"] as ServiceMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setServiceMode(m)}
                  className="flex-1 py-2 rounded-lg text-[13px] font-medium transition-colors"
                  style={serviceMode === m
                    ? { background: "var(--brand-navy)", color: "#fff" }
                    : { background: "#fff", color: "var(--brand-muted)", border: "1px solid var(--brand-border)" }}
                >
                  {m === "IN_PERSON" ? "In-person" : "Online"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Speaker — Special Meeting only */}
        {serviceType === "SPECIAL_MEETING" && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium" style={{ color: "var(--brand-muted)" }}>
              Minister / Speaker
            </label>
            <div className="flex items-center gap-2 rounded-lg px-3"
                 style={{ border: "1px solid var(--brand-border)", background: "#fff" }}>
              <Mic2 className="h-4 w-4 shrink-0" style={{ color: "var(--brand-muted)" }} />
              <input
                type="text"
                value={speaker}
                onChange={(e) => setSpeaker(e.target.value)}
                placeholder="e.g. Prophet Kofi Boateng"
                className="flex-1 h-10 text-[14px] outline-none bg-transparent"
                style={{ color: "var(--brand-text)" }}
              />
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-medium" style={{ color: "var(--brand-muted)" }}>Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={serviceType === "SPECIAL_MEETING" ? "e.g. Held at HTU Park, theme: Revival" : "e.g. Held at HTU Park"}
            className="h-10 px-3 text-[14px] rounded-lg"
            style={{ border: "1px solid var(--brand-border)", color: "var(--brand-text)", background: "#fff" }}
          />
        </div>

        {/* Shepherds Meeting info banner */}
        {isShepherdsMeeting && (
          <div className="rounded-lg px-4 py-3 text-[13px]"
               style={{ background: "#F3EFF9", border: "1px solid #D4C5F9", color: "#5B21B6" }}>
            Attendance is recorded for shepherds only. Regular members are excluded from this list.
          </div>
        )}
      </div>

      {/* ── Attendance summary bar ── */}
      <div
        className="rounded-xl px-4 py-3 mb-4 sticky"
        style={{ top: 56, zIndex: 10, background: "var(--brand-navy-light)", border: "1px solid var(--brand-border)" }}
      >
        {/* Top row: marked count + status icons */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-3 flex-wrap text-[13px]">
            <span style={{ color: "var(--brand-navy)", fontWeight: 600 }}>{marked}/{total} marked</span>
            {present > 0 && (
              <span className="flex items-center gap-1" style={{ color: "var(--brand-success)" }}>
                <CheckCircle2 className="h-3.5 w-3.5" /> {present}
              </span>
            )}
            {absent > 0 && (
              <span className="flex items-center gap-1" style={{ color: "var(--brand-danger)" }}>
                <XCircle className="h-3.5 w-3.5" /> {absent}
              </span>
            )}
            {excused > 0 && (
              <span className="flex items-center gap-1" style={{ color: "var(--brand-warning)" }}>
                <Clock className="h-3.5 w-3.5" /> {excused}
              </span>
            )}
          </div>
          <span className="text-[12px] font-semibold shrink-0" style={{ color: "var(--brand-navy)" }}>
            {total > 0 ? Math.round((marked / total) * 100) : 0}%
          </span>
        </div>
        {/* Progress bar — full width on all screens */}
        <div className="rounded-pill overflow-hidden" style={{ height: 5, background: "var(--brand-border)" }}>
          <div className="h-full rounded-pill transition-all"
               style={{ width: `${total > 0 ? Math.round((marked / total) * 100) : 0}%`,
                        background: "var(--brand-navy)" }} />
        </div>
      </div>

      {/* ── Member / shepherd list ── */}
      {loadingMembers ? (
        <div className="rounded-xl p-8 flex flex-col items-center gap-3 text-center"
             style={{ border: "1px solid var(--brand-border)" }}>
          <Loader2 className="h-7 w-7 animate-spin" style={{ color: "var(--brand-navy)" }} />
          <div>
            <p className="text-[14px] font-medium" style={{ color: "var(--brand-text)" }}>
              {!ready ? "Checking your role…" : isShepherdsMeeting ? "Loading shepherds…" : "Loading members…"}
            </p>
            <p className="text-[12px] mt-1" style={{ color: "var(--brand-muted)" }}>
              This should only take a moment
            </p>
          </div>
          {/* Skeleton rows beneath the spinner for visual continuity */}
          <div className="w-full flex flex-col gap-2 mt-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-12 rounded-xl" style={{ opacity: 1 - i * 0.2 }} />
            ))}
          </div>
        </div>
      ) : total === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ border: "1px solid var(--brand-border)" }}>
          <Users style={{ width: 36, height: 36, color: "var(--brand-muted)", margin: "0 auto 10px" }} />
          <p className="text-[14px]" style={{ color: "var(--brand-muted)" }}>
            {isShepherdsMeeting
              ? "No shepherds found in your cell. Assign shepherd slots first."
              : "No active members in your cell."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {Object.entries(grouped).map(([key, group]) => (
            <div key={key} className="rounded-xl overflow-hidden"
                 style={{ border: "1px solid var(--brand-border)" }}>
              {!isShepherdsMeeting && (
                <div className="px-4 py-2.5 flex items-center gap-2"
                     style={{ background: "#F9FAFB", borderBottom: "1px solid var(--brand-border)" }}>
                  <span className="text-[12px] font-medium uppercase tracking-[0.04em]"
                        style={{ color: "var(--brand-muted)" }}>Shepherd:</span>
                  <span className="text-[13px] font-medium" style={{ color: "var(--brand-text)" }}>
                    {/* "No shepherd" means directly overseen by the cell shepherd */}
                    {key === "__none__"
                      ? (session?.user?.name ?? "Cell Shepherd")
                      : group.label}
                  </span>
                  {key === "__none__" && (
                    <span className="text-[10px] font-semibold rounded-pill px-1.5 py-0.5"
                          style={{ background: "var(--brand-navy-light)", color: "var(--brand-navy)" }}>
                      you
                    </span>
                  )}
                  <span className="text-[12px] ml-auto" style={{ color: "var(--brand-muted)" }}>
                    {group.members.length} member{group.members.length !== 1 ? "s" : ""}
                  </span>
                </div>
              )}

              {group.members.map((m, i) => {
                const status   = attendance[m.id] ?? null;
                const initials = `${m.firstName[0] ?? ""}${m.lastName[0] ?? ""}`.toUpperCase();

                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3"
                    style={{ borderBottom: i < group.members.length - 1 ? "1px solid var(--brand-border)" : "none" }}
                  >
                    {/* Avatar — hidden on very small screens to give name more room */}
                    <div
                      className="hidden xs:flex items-center justify-center rounded-lg text-[12px] font-semibold shrink-0"
                      style={{
                        width: 32, height: 32,
                        background: status === "PRESENT" ? "#1A8C6C" : status === "ABSENT" ? "#C0392B" : status === "EXCUSED" ? "#B87015" : "var(--brand-navy)",
                        color: "#fff",
                      }}
                    >
                      {initials}
                    </div>
                    <span className="flex-1 min-w-0 text-[14px] font-medium truncate" style={{ color: "var(--brand-text)" }}>
                      {m.firstName} {m.lastName}
                      {m.gender && (
                        <span className="ml-1.5 text-[12px] font-normal" style={{ color: "var(--brand-muted)" }}>
                          {m.gender[0]}
                        </span>
                      )}
                    </span>
                    {/* P / A / E buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      {(["PRESENT", "ABSENT", "EXCUSED"] as AttendanceStatus[]).map((s) => (
                        <StatusButton key={s} value={s} current={status} onChange={(v) => setStatus(m.id, v)} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* ── First Timers (hidden for Shepherds Meeting) ── */}
      {!isShepherdsMeeting && (
        <div className="mt-8">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <h2 className="text-[16px] font-semibold" style={{ color: "var(--brand-text)" }}>First Timers</h2>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--brand-muted)" }}>
                New faces — not yet members
              </p>
            </div>
            <button
              type="button"
              onClick={addFirstTimer}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-[13px] font-medium transition-colors shrink-0"
              style={{ background: "var(--brand-navy-light)", color: "var(--brand-navy)", border: "1px solid var(--brand-border)" }}
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Add first timer</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>

          {firstTimers.length === 0 ? (
            <button
              type="button"
              onClick={addFirstTimer}
              className="w-full rounded-xl py-8 flex flex-col items-center gap-2 transition-colors hover:bg-[var(--brand-navy-light)]"
              style={{ border: "2px dashed var(--brand-border)" }}
            >
              <UserPlus className="h-7 w-7" style={{ color: "var(--brand-muted)" }} />
              <span className="text-[13px]" style={{ color: "var(--brand-muted)" }}>
                Tap to record first timers for this service
              </span>
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              {firstTimers.map((ft, idx) => (
                <div key={ft._key} className="rounded-xl p-4 flex flex-col gap-3"
                     style={{ border: "1px solid var(--brand-border)" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold uppercase tracking-[0.05em]"
                          style={{ color: "var(--brand-navy)" }}>
                      First Timer #{idx + 1}
                    </span>
                    <button type="button" onClick={() => removeFT(ft._key)}
                            className="p-1 rounded hover:opacity-70 transition-opacity"
                            style={{ color: "var(--brand-danger)" }}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { field: "firstName" as const, label: "First name", placeholder: "e.g. Abena" },
                      { field: "lastName"  as const, label: "Last name",  placeholder: "e.g. Mensah" },
                    ].map(({ field, label, placeholder }) => (
                      <div key={field} className="flex flex-col gap-1">
                        <label className="text-[11px] font-medium uppercase tracking-[0.04em]"
                               style={{ color: "var(--brand-muted)" }}>
                          {label} <span style={{ color: "var(--brand-danger)" }}>*</span>
                        </label>
                        <input
                          value={ft[field]}
                          onChange={(e) => updateFT(ft._key, { [field]: e.target.value })}
                          placeholder={placeholder}
                          className="h-9 px-3 text-[13px] rounded-lg"
                          style={{ border: "1px solid var(--brand-border)", outline: "none", background: "#fff" }}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { field: "phone"    as const, label: "Phone",    placeholder: "e.g. 024 000 0000" },
                      { field: "location" as const, label: "Location", placeholder: "e.g. East Legon" },
                    ].map(({ field, label, placeholder }) => (
                      <div key={field} className="flex flex-col gap-1">
                        <label className="text-[11px] font-medium uppercase tracking-[0.04em]"
                               style={{ color: "var(--brand-muted)" }}>
                          {label}
                        </label>
                        <input
                          value={ft[field]}
                          onChange={(e) => updateFT(ft._key, { [field]: e.target.value })}
                          placeholder={placeholder}
                          className="h-9 px-3 text-[13px] rounded-lg"
                          style={{ border: "1px solid var(--brand-border)", outline: "none", background: "#fff" }}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium uppercase tracking-[0.04em]"
                           style={{ color: "var(--brand-muted)" }}>
                      Brought by (shepherd / member name)
                    </label>
                    <input
                      value={ft.referredBy}
                      onChange={(e) => updateFT(ft._key, { referredBy: e.target.value })}
                      placeholder="e.g. Kwame Asante"
                      className="h-9 px-3 text-[13px] rounded-lg"
                      style={{ border: "1px solid var(--brand-border)", outline: "none", background: "#fff" }}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-medium uppercase tracking-[0.04em]"
                           style={{ color: "var(--brand-muted)" }}>
                      Intention
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {(Object.keys(INTENT_LABELS) as FirstTimerIntent[]).map((intent) => (
                        <button
                          key={intent}
                          type="button"
                          onClick={() => updateFT(ft._key, { intent })}
                          className="flex-1 py-2 rounded-lg text-[12px] font-medium transition-colors"
                          style={ft.intent === intent
                            ? { background: "var(--brand-navy)", color: "#fff" }
                            : { background: "#fff", color: "var(--brand-muted)", border: "1px solid var(--brand-border)" }}
                        >
                          {INTENT_LABELS[intent]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addFirstTimer}
                className="flex items-center justify-center gap-1.5 h-9 rounded-lg text-[13px] font-medium transition-colors"
                style={{ border: "1px dashed var(--brand-border)", color: "var(--brand-muted)" }}
              >
                <Plus className="h-3.5 w-3.5" /> Add another
              </button>
            </div>
          )}
        </div>
      )}

      {/* Submit */}
      <div className="mt-6 flex flex-col gap-3">
        {error && <p className="text-[13px]" style={{ color: "var(--brand-danger)" }}>{error}</p>}
        {!allDone && total > 0 && (
          <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
            {total - marked} {isShepherdsMeeting ? "shepherd" : "member"}{total - marked !== 1 ? "s" : ""} still need to be marked.
          </p>
        )}
        <Button
          onClick={handleSubmit}
          disabled={saving || !allDone}
          className="h-12 text-[15px] font-medium w-full flex flex-col items-center justify-center gap-0.5"
          style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}
        >
          {saving ? (
            "Saving…"
          ) : (
            <>
              <span>Submit Attendance</span>
              {allDone && (
                <span className="text-[11px] font-normal opacity-80">
                  {present} present · {absent} absent{excused > 0 ? ` · ${excused} excused` : ""}
                </span>
              )}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
