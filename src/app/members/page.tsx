"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useActiveRole } from "@/hooks/use-active-role";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
  SheetBody, SheetFooter,
} from "@/components/ui/sheet";
import Link from "next/link";
import {
  Search, Pencil, Trash2, Users, UserCheck, UserX,
  ShieldCheck, Phone, Mail, Calendar, MapPin,
  UserCircle, ShieldAlert, ChevronRight,
} from "lucide-react";
import { AddMemberModal } from "@/components/add-member-modal";
import { SummaryCard } from "@/components/summary-card";

// ─── Types ────────────────────────────────────────────────────────────────────

type Member = {
  id:         string;
  firstName:  string;
  lastName:   string;
  phone:      string | null;
  email:      string | null;
  gender:     string | null;
  isActive:   boolean;
  isUser:     boolean;
  joinedDate: string | null;
  // Placement — exactly one level is set
  shepherd:   { id: string; user: { id: string; name: string } | null; person: { firstName: string; lastName: string } | null } | null;
  cell:       { id: string; name: string; buscentre: { id: string; name: string } } | null;
  buscentre:  { id: string; name: string } | null;
  mc:         { id: string; name: string } | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className="rounded-pill text-[11px] font-medium px-2.5 py-0.5"
      style={active
        ? { background: "#E0F4EC", color: "#085041" }
        : { background: "#FDECEA", color: "#791F1F" }}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function SystemUserBadge() {
  return (
    <span className="rounded-pill text-[11px] font-medium px-2.5 py-0.5"
          style={{ background: "var(--brand-navy-light)", color: "var(--brand-navy)" }}>
      System user
    </span>
  );
}

function LevelBadge({ member }: { member: Member }) {
  if (member.shepherd)  return null; // regular member — no extra badge needed
  const styles = { background: "#FEF3DC", color: "#854F0B" };
  if (member.mc)        return <span className="rounded-pill text-[11px] font-medium px-2.5 py-0.5" style={styles}>MC level</span>;
  if (member.buscentre) return <span className="rounded-pill text-[11px] font-medium px-2.5 py-0.5" style={styles}>Buscentre level</span>;
  if (member.cell)      return <span className="rounded-pill text-[11px] font-medium px-2.5 py-0.5" style={styles}>Cell level</span>;
  return null;
}

// Returns the "where they sit" text for the table
function memberPlacement(m: Member): { primary: string; secondary: string } {
  if (m.shepherd) {
    return {
      primary:   m.cell?.name ?? "—",
      secondary: m.cell?.buscentre?.name ?? "—",
    };
  }
  if (m.cell) return { primary: m.cell.name, secondary: m.cell.buscentre?.name ?? "—" };
  if (m.buscentre) return { primary: m.buscentre.name, secondary: "Buscentre level" };
  if (m.mc) return { primary: m.mc.name, secondary: "MC level" };
  return { primary: "—", secondary: "—" };
}

function shepherdName(m: Member): string {
  if (m.shepherd?.user?.name) return m.shepherd.user.name;
  if (m.shepherd?.person)     return `${m.shepherd.person.firstName} ${m.shepherd.person.lastName}`;
  if (m.shepherd)             return "Unassigned";
  return "—";
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-6">
      <span className="text-[12px] font-medium uppercase tracking-[0.04em] whitespace-nowrap"
            style={{ color: "var(--brand-muted)" }}>
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: "var(--brand-border)" }} />
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

type MemberLevel = "shepherd" | "cell" | "buscentre" | "mc";
type ScopeOption  = { id: string; name: string };
type ShepherdSlot = {
  id:     string;
  user:   { name: string } | null;
  person: { firstName: string; lastName: string } | null;
  _count: { members: number };
};

function inferLevel(m: Member): MemberLevel {
  if (m.shepherd)  return "shepherd";
  if (m.cell)      return "cell";
  if (m.buscentre) return "buscentre";
  return "mc";
}

function currentAssignmentText(m: Member): string {
  if (m.shepherd)  return `${m.cell?.name ?? "—"} · ${m.cell?.buscentre?.name ?? "—"} · Shepherd: ${shepherdName(m)}`;
  if (m.cell)      return `${m.cell.name} · ${m.cell.buscentre?.name ?? "—"}`;
  if (m.buscentre) return m.buscentre.name;
  if (m.mc)        return m.mc.name;
  return "—";
}

const LEVEL_LABELS: Record<MemberLevel, string> = {
  shepherd:  "Regular member",
  cell:      "Cell level",
  buscentre: "Buscentre level",
  mc:        "MC level",
};

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-[12px] font-medium uppercase tracking-[0.04em]"
           style={{ color: "var(--brand-muted)" }}>
      {children}{required && <span style={{ color: "var(--brand-danger)" }}> *</span>}
    </label>
  );
}

function NativeSelect({ value, onChange, disabled, placeholder, options, displayFn }: {
  value: string; onChange: (v: string) => void; disabled?: boolean;
  placeholder: string; options: { id: string }[];
  displayFn: (o: { id: string }) => string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
      className="h-10 px-3 text-[14px] rounded-lg disabled:opacity-40"
      style={{ border: "1px solid var(--brand-border)", color: "var(--brand-text)", background: "#fff" }}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.id} value={o.id}>{displayFn(o)}</option>)}
    </select>
  );
}

// ─── Member detail sheet ──────────────────────────────────────────────────────

type MemberDetail = Member & {
  dateOfBirth: string | null;
  createdAt:   string;
  // Extended profile
  hometown?:          string | null;
  previousChurch?:    string | null;
  parentName?:        string | null;
  parentPhone?:       string | null;
  emergencyName?:     string | null;
  emergencyPhone?:    string | null;
  emergencyRelation?: string | null;
  // Set when the member has been activated as a system user
  user: {
    id:   string;
    name: string;
    role: { role: string } | null;
    supervisor: {
      id:   string;
      name: string;
      role: { role: string } | null;
    } | null;
  } | null;
};

type AttendanceRecord = {
  id:     string;
  status: "PRESENT" | "ABSENT" | "EXCUSED";
  notes:  string | null;
  service: {
    id:      string;
    type:    string;
    date:    string;
    mode:    string;
    speaker: string | null;
  };
};

function Avatar({ firstName, lastName }: { firstName: string; lastName: string }) {
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
  return (
    <div
      className="flex items-center justify-center rounded-xl shrink-0"
      style={{
        width: 64, height: 64,
        background: "var(--brand-navy)",
        color: "#fff",
        fontSize: 22,
        fontWeight: 600,
        letterSpacing: "0.03em",
      }}
    >
      {initials}
    </div>
  );
}

function DetailRow({
  icon: Icon, label, value,
}: {
  icon?: React.ElementType;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5"
         style={{ borderBottom: "1px solid var(--brand-border)" }}>
      {Icon
        ? <Icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--brand-muted)" }} />
        : <span className="w-4 shrink-0" />}
      <span className="text-[12px] font-medium uppercase tracking-[0.04em] w-24 shrink-0 pt-0.5"
            style={{ color: "var(--brand-muted)" }}>
        {label}
      </span>
      <span className="text-[14px] flex-1" style={{ color: value ? "var(--brand-text)" : "var(--brand-muted)" }}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function timeAgo(iso: string): string {
  const ms   = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86400000);
  if (days < 30)  return `${days} day${days !== 1 ? "s" : ""} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months !== 1 ? "s" : ""} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years !== 1 ? "s" : ""} ago`;
}

function MemberDetailSheet({
  memberId,
  onClose,
  onEdit,
  onDeleted,
}: {
  memberId:  string | null;
  onClose:   () => void;
  onEdit:    (m: Member) => void;
  onDeleted: () => void;
}) {
  const [detail,    setDetail]    = useState<MemberDetail | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    if (!memberId) { setDetail(null); setAttendance([]); return; }
    setLoading(true);
    Promise.all([
      fetch(`/api/members/${memberId}`).then((r) => r.json()),
      fetch(`/api/members/${memberId}/attendance?take=15`).then((r) => r.json()),
    ])
      .then(([d, att]) => {
        setDetail(d);
        setAttendance(Array.isArray(att) ? att : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [memberId]);

  async function handleDelete() {
    if (!detail) return;
    if (!confirm(`Delete ${detail.firstName} ${detail.lastName}? This cannot be undone.`)) return;
    setDeleting(true);
    await fetch(`/api/members/${detail.id}`, { method: "DELETE" });
    setDeleting(false);
    onDeleted();
    onClose();
  }

  const level = detail ? inferLevel(detail) : null;

  return (
    <Sheet open={!!memberId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent width={540}>

        {/* ── Header ── */}
        <SheetHeader>
          {loading || !detail ? (
            <div className="flex flex-col gap-2">
              <div className="skeleton h-6 w-40 rounded" />
              <div className="skeleton h-4 w-24 rounded" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <Avatar firstName={detail.firstName} lastName={detail.lastName} />
                <div className="flex flex-col gap-1 min-w-0">
                  <SheetTitle className="text-[20px]">
                    {detail.firstName} {detail.lastName}
                  </SheetTitle>
                  <div className="flex flex-wrap gap-1.5">
                    {level && (
                      <span className="rounded-pill text-[11px] font-medium px-2.5 py-0.5"
                            style={{ background: "var(--brand-navy-light)", color: "var(--brand-navy)" }}>
                        {LEVEL_LABELS[level]}
                      </span>
                    )}
                    <StatusBadge active={detail.isActive} />
                    {detail.isUser && <SystemUserBadge />}
                  </div>
                </div>
              </div>
              <SheetDescription>
                Member since {timeAgo(detail.createdAt)}
              </SheetDescription>
            </>
          )}
        </SheetHeader>

        {/* ── Body ── */}
        <SheetBody>
          {loading ? (
            <div className="flex flex-col gap-3 pt-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="skeleton h-9 rounded-lg" />
              ))}
            </div>
          ) : detail ? (
            <div className="flex flex-col gap-0">

              {/* ── Personal ── */}
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] py-3"
                 style={{ color: "var(--brand-muted)" }}>Personal</p>
              <DetailRow icon={Phone}      label="Phone"         value={detail.phone} />
              <DetailRow icon={Mail}       label="Email"         value={detail.email} />
              <DetailRow icon={UserCircle} label="Gender"        value={detail.gender} />
              <DetailRow icon={Calendar}   label="Date of birth" value={formatDate(detail.dateOfBirth)} />
              <DetailRow icon={Calendar}   label="Date joined"   value={formatDate(detail.joinedDate)} />

              {/* ── Background ── */}
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] pt-5 pb-3"
                 style={{ color: "var(--brand-muted)" }}>Background</p>
              <DetailRow icon={MapPin} label="Hometown"       value={detail.hometown} />
              <DetailRow icon={MapPin} label="Prev. church"   value={detail.previousChurch} />

              {/* ── Parent / Guardian ── */}
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] pt-5 pb-3"
                 style={{ color: "var(--brand-muted)" }}>Parent / Guardian</p>
              <DetailRow icon={Users} label="Name"  value={detail.parentName} />
              <DetailRow icon={Phone} label="Phone" value={detail.parentPhone} />

              {/* ── Emergency Contact ── */}
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] pt-5 pb-3"
                 style={{ color: "var(--brand-muted)" }}>Emergency Contact</p>
              <DetailRow icon={Users} label="Name"         value={detail.emergencyName} />
              <DetailRow icon={Phone} label="Phone"        value={detail.emergencyPhone} />
              <DetailRow icon={UserCircle} label="Relation" value={detail.emergencyRelation} />

              {/* ── Assignment ── */}
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] pt-5 pb-3"
                 style={{ color: "var(--brand-muted)" }}>Assignment</p>
              {detail.shepherd && (
                <DetailRow icon={Users} label="Shepherd"
                  value={detail.shepherd.user?.name ?? (detail.shepherd.person ? `${detail.shepherd.person.firstName} ${detail.shepherd.person.lastName}` : "Unassigned")} />
              )}
              {detail.cell && <DetailRow icon={MapPin} label="Cell" value={detail.cell.name} />}
              {(detail.cell?.buscentre || detail.buscentre) && (
                <DetailRow icon={MapPin} label="Buscentre" value={detail.cell?.buscentre?.name ?? detail.buscentre?.name ?? null} />
              )}
              {detail.mc && <DetailRow icon={MapPin} label="MC" value={detail.mc.name} />}

              {/* ── Attendance history ── */}
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] pt-5 pb-3"
                 style={{ color: "var(--brand-muted)" }}>Attendance history</p>

              {attendance.length === 0 ? (
                <p className="text-[13px] italic pb-2" style={{ color: "var(--brand-muted)" }}>
                  No attendance recorded yet.
                </p>
              ) : (
                <div className="flex flex-col rounded-xl overflow-hidden mb-2"
                     style={{ border: "1px solid var(--brand-border)" }}>
                  {attendance.map((rec, i) => {
                    const svcLabel: Record<string, string> = {
                      LC_LIVE: "LC Live", MGS: "MGS",
                      SHEPHERDS_MEETING: "Shepherds Mtg", SPECIAL_MEETING: "Special Mtg",
                    };
                    const svcColor: Record<string, string> = {
                      LC_LIVE: "var(--brand-navy)", MGS: "#1A8C6C",
                      SHEPHERDS_MEETING: "#7C3AED", SPECIAL_MEETING: "#B45309",
                    };
                    const statusStyle: Record<string, React.CSSProperties> = {
                      PRESENT: { background: "#E0F4EC", color: "#085041" },
                      ABSENT:  { background: "#FDECEA", color: "#791F1F" },
                      EXCUSED: { background: "#FEF3DC", color: "#854F0B" },
                    };
                    const dateStr = new Date(rec.service.date).toLocaleDateString("en-GB", {
                      day: "numeric", month: "short",
                    });
                    return (
                      <div key={rec.id}
                           className="flex items-center gap-2 px-3 py-2.5"
                           style={{ borderBottom: i < attendance.length - 1 ? "1px solid var(--brand-border)" : "none" }}>
                        <span className="rounded-pill text-[10px] font-semibold px-2 py-0.5 shrink-0 text-white"
                              style={{ background: svcColor[rec.service.type] ?? "var(--brand-navy)" }}>
                          {svcLabel[rec.service.type] ?? rec.service.type}
                        </span>
                        <span className="text-[13px] flex-1" style={{ color: "var(--brand-text)" }}>
                          {dateStr}
                        </span>
                        {rec.service.speaker && (
                          <span className="text-[11px] truncate max-w-[90px]" style={{ color: "var(--brand-muted)" }}>
                            {rec.service.speaker}
                          </span>
                        )}
                        <span className="rounded-pill text-[11px] font-semibold px-2 py-0.5 shrink-0"
                              style={statusStyle[rec.status] ?? {}}>
                          {rec.status.charAt(0) + rec.status.slice(1).toLowerCase()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── System access ── */}
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] pt-5 pb-3"
                 style={{ color: "var(--brand-muted)" }}>System access</p>
              {detail.isUser ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "#E0F4EC" }}>
                    <ShieldCheck className="h-5 w-5 shrink-0" style={{ color: "#085041" }} />
                    <div>
                      <p className="text-[14px] font-medium" style={{ color: "#085041" }}>
                        Activated — {detail.user?.role?.role.replace(/_/g, " ") ?? "system user"}
                      </p>
                      <p className="text-[12px] mt-0.5" style={{ color: "#085041" }}>
                        This member can log in to the app.
                      </p>
                    </div>
                  </div>
                  <DetailRow icon={UserCircle} label="Overseer"
                    value={detail.user?.supervisor
                      ? `${detail.user.supervisor.name}${detail.user.supervisor.role ? ` (${detail.user.supervisor.role.role.replace(/_/g, " ")})` : ""}`
                      : "Not yet assigned"} />
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-xl px-4 py-3"
                     style={{ background: "var(--brand-navy-light)" }}>
                  <div className="flex items-center gap-3">
                    <ShieldAlert className="h-5 w-5 shrink-0" style={{ color: "var(--brand-navy)" }} />
                    <div>
                      <p className="text-[14px] font-medium" style={{ color: "var(--brand-navy)" }}>Not activated</p>
                      <p className="text-[12px] mt-0.5" style={{ color: "var(--brand-muted)" }}>No system access yet.</p>
                    </div>
                  </div>
                  <Link href="/org/activate"
                        className="flex items-center gap-1 text-[13px] font-medium transition-colors hover:underline"
                        style={{ color: "var(--brand-navy)" }}>
                    Activate <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}
            </div>
          ) : null}
        </SheetBody>

        {/* ── Footer ── */}
        {detail && !loading && (
          <SheetFooter>
            <Button
              variant="outline"
              disabled={deleting}
              onClick={handleDelete}
              className="h-9 text-[13px] mr-auto"
              style={{ borderColor: "var(--brand-danger)", color: "var(--brand-danger)", borderRadius: 8 }}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              {deleting ? "Deleting…" : "Delete"}
            </Button>
            <Button
              onClick={() => { onEdit(detail); onClose(); }}
              className="h-9 text-[13px]"
              style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}
            >
              <Pencil className="h-4 w-4 mr-1.5" />
              Edit
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Edit member sheet ────────────────────────────────────────────────────────

function EditMemberSheet({
  member, onClose, onSaved,
}: {
  member: Member | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  // ── Personal fields ──
  const [firstName,   setFirstName]   = useState("");
  const [lastName,    setLastName]    = useState("");
  const [phone,       setPhone]       = useState("");
  const [email,       setEmail]       = useState("");
  const [gender,      setGender]      = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [joinedDate,  setJoinedDate]  = useState("");
  const [isActive,    setIsActive]    = useState(true);

  // ── Reassignment ──
  const [reassigning,  setReassigning]  = useState(false);
  const [level,        setLevel]        = useState<MemberLevel>("shepherd");
  const [mcs,          setMCs]          = useState<ScopeOption[]>([]);
  const [buscentres,   setBuscentres]   = useState<ScopeOption[]>([]);
  const [cells,        setCells]        = useState<ScopeOption[]>([]);
  const [shepherds,    setShepherds]    = useState<ShepherdSlot[]>([]);
  const [mcId,         setMcId]         = useState("");
  const [buscentreId,  setBuscentreId]  = useState("");
  const [cellId,       setCellId]       = useState("");
  const [shepherdId,   setShepherdId]   = useState("");

  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState("");

  // Populate fields when member changes
  useEffect(() => {
    if (!member) return;
    setFirstName(member.firstName);
    setLastName(member.lastName);
    setPhone(member.phone ?? "");
    setEmail(member.email ?? "");
    setGender(member.gender ?? "");
    setDateOfBirth(""); // dateOfBirth not in current type — can be added later
    setJoinedDate(member.joinedDate ? member.joinedDate.slice(0, 10) : "");
    setIsActive(member.isActive);
    setReassigning(false);
    setError("");
  }, [member]);

  // When reassign section opens — load MCs and pre-fill current placement
  useEffect(() => {
    if (!reassigning || !member) return;
    const current = inferLevel(member);
    setLevel(current);
    fetch("/api/org/mega-churches").then((r) => r.json()).then(setMCs);
  }, [reassigning, member]);

  // Cascade: MC → buscentres
  useEffect(() => {
    setBuscentres([]); setBuscentreId(""); setCells([]); setCellId(""); setShepherds([]); setShepherdId("");
    if (!mcId) return;
    fetch(`/api/org/buscentres?mcId=${mcId}`).then((r) => r.json()).then(setBuscentres);
  }, [mcId]);

  // Cascade: buscentre → cells
  useEffect(() => {
    setCells([]); setCellId(""); setShepherds([]); setShepherdId("");
    if (!buscentreId) return;
    fetch(`/api/org/cells?buscentreId=${buscentreId}`).then((r) => r.json()).then(setCells);
  }, [buscentreId]);

  // Cascade: cell → shepherds
  useEffect(() => {
    setShepherds([]); setShepherdId("");
    if (!cellId || level !== "shepherd") return;
    fetch(`/api/org/shepherds?cellId=${cellId}`).then((r) => r.json()).then(setShepherds);
  }, [cellId, level]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) { setError("Name is required."); return; }
    setBusy(true);

    // Build reassignment payload if section is open and valid
    let placementPatch: Record<string, string | null> = {};
    if (reassigning) {
      if (level === "shepherd" && !shepherdId) { setError("Select a shepherd."); setBusy(false); return; }
      if (level === "cell"     && !cellId)     { setError("Select a cell."); setBusy(false); return; }
      if (level === "buscentre"&& !buscentreId){ setError("Select a buscentre."); setBusy(false); return; }
      if (level === "mc"       && !mcId)       { setError("Select an MC."); setBusy(false); return; }

      placementPatch = {
        shepherdId:  level === "shepherd"  ? shepherdId  : null,
        cellId:      level === "shepherd" || level === "cell" ? cellId : null,
        buscentreId: level === "buscentre" ? buscentreId : null,
        mcId:        level === "mc"        ? mcId        : null,
      };
    }

    const res = await fetch(`/api/members/${member!.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: firstName.trim(),
        lastName:  lastName.trim(),
        phone:     phone       || null,
        email:     email       || null,
        gender:    gender      || null,
        dateOfBirth: dateOfBirth || null,
        joinedDate:  joinedDate  || null,
        isActive,
        ...placementPatch,
      }),
    });
    setBusy(false);
    if (res.ok) { onSaved(); onClose(); }
    else { const d = await res.json(); setError(d.error ?? "Save failed."); }
  }

  return (
    <Sheet open={!!member} onOpenChange={(o) => !o && onClose()}>
      <SheetContent width={500}>
        <SheetHeader>
          <SheetTitle>
            {member ? `${member.firstName} ${member.lastName}` : "Edit Member"}
          </SheetTitle>
          {member && (
            <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
              {LEVEL_LABELS[inferLevel(member)]} · {currentAssignmentText(member)}
            </p>
          )}
        </SheetHeader>

        <SheetBody>
          <form id="edit-member-form" onSubmit={handleSave} className="flex flex-col gap-5">

            {/* ── Personal details ── */}
            <section className="flex flex-col gap-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.06em]"
                 style={{ color: "var(--brand-muted)" }}>Personal details</p>

              <div className="grid grid-cols-2 gap-3">
                {([
                  { label: "First name", value: firstName, set: setFirstName, ph: "John", req: true },
                  { label: "Last name",  value: lastName,  set: setLastName,  ph: "Doe",  req: true },
                ] as const).map(({ label, value, set, ph, req }) => (
                  <div key={label} className="flex flex-col gap-1.5">
                    <FieldLabel required={req}>{label}</FieldLabel>
                    <Input value={value} onChange={(e) => set(e.target.value)}
                           placeholder={ph} className="h-10 text-[14px]"
                           style={{ borderColor: "var(--brand-border)" }} />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Phone</FieldLabel>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)}
                         placeholder="+233 …" className="h-10 text-[14px]"
                         style={{ borderColor: "var(--brand-border)" }} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Gender</FieldLabel>
                  <select value={gender} onChange={(e) => setGender(e.target.value)}
                          className="h-10 px-3 text-[14px] rounded-lg"
                          style={{ border: "1px solid var(--brand-border)", color: "var(--brand-text)", background: "#fff" }}>
                    <option value="">— None —</option>
                    <option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Date of birth</FieldLabel>
                  <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)}
                         className="h-10 text-[14px]" style={{ borderColor: "var(--brand-border)" }} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Date joined</FieldLabel>
                  <Input type="date" value={joinedDate} onChange={(e) => setJoinedDate(e.target.value)}
                         className="h-10 text-[14px]" style={{ borderColor: "var(--brand-border)" }} />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <FieldLabel>Email</FieldLabel>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                       placeholder="optional" className="h-10 text-[14px]"
                       style={{ borderColor: "var(--brand-border)" }} />
              </div>

              <div className="flex flex-col gap-1.5">
                <FieldLabel>Status</FieldLabel>
                <select value={isActive ? "active" : "inactive"}
                        onChange={(e) => setIsActive(e.target.value === "active")}
                        className="h-10 px-3 text-[14px] rounded-lg"
                        style={{ border: "1px solid var(--brand-border)", color: "var(--brand-text)", background: "#fff" }}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </section>

            <div className="h-px" style={{ background: "var(--brand-border)" }} />

            {/* ── Change assignment (collapsible) ── */}
            <section className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setReassigning((r) => !r)}
                className="flex items-center justify-between text-left w-full"
              >
                <span className="text-[11px] font-medium uppercase tracking-[0.06em]"
                      style={{ color: "var(--brand-muted)" }}>
                  Change assignment
                </span>
                <span className="text-[12px] font-medium" style={{ color: "var(--brand-navy)" }}>
                  {reassigning ? "Cancel" : "Edit"}
                </span>
              </button>

              {!reassigning && member && (
                <div className="rounded-lg px-3 py-2.5 text-[13px]"
                     style={{ background: "var(--brand-navy-light)" }}>
                  <span style={{ color: "var(--brand-navy)", fontWeight: 500 }}>
                    {LEVEL_LABELS[inferLevel(member)]}
                  </span>
                  <span style={{ color: "var(--brand-muted)" }}>
                    {" · "}{currentAssignmentText(member)}
                  </span>
                </div>
              )}

              {reassigning && (
                <div className="flex flex-col gap-3">
                  {/* Level selector */}
                  <div className="grid grid-cols-2 gap-2">
                    {(["shepherd", "cell", "buscentre", "mc"] as MemberLevel[]).map((l) => (
                      <button key={l} type="button" onClick={() => setLevel(l)}
                        className="text-left px-3 py-2 rounded-lg text-[12px] font-medium transition-colors"
                        style={level === l
                          ? { background: "var(--brand-navy)", color: "#fff", border: "1px solid var(--brand-navy)" }
                          : { background: "#fff", color: "var(--brand-text)", border: "1px solid var(--brand-border)" }}>
                        {LEVEL_LABELS[l]}
                      </button>
                    ))}
                  </div>

                  {/* MC select — always shown as root of cascade */}
                  {(level === "mc" || level === "buscentre" || level === "cell" || level === "shepherd") && (
                    <div className="flex flex-col gap-1.5">
                      <FieldLabel required={level === "mc"}>MegaChurch</FieldLabel>
                      <NativeSelect value={mcId} onChange={setMcId}
                        placeholder="— Select MC —" options={mcs}
                        displayFn={(o) => (o as ScopeOption).name} />
                    </div>
                  )}

                  {/* Buscentre */}
                  {(level === "buscentre" || level === "cell" || level === "shepherd") && (
                    <div className="flex flex-col gap-1.5">
                      <FieldLabel required={level === "buscentre"}>Buscentre</FieldLabel>
                      <NativeSelect value={buscentreId} onChange={setBuscentreId}
                        disabled={buscentres.length === 0}
                        placeholder={!mcId ? "Select MC first" : "— Select buscentre —"}
                        options={buscentres} displayFn={(o) => (o as ScopeOption).name} />
                    </div>
                  )}

                  {/* Cell */}
                  {(level === "cell" || level === "shepherd") && (
                    <div className="flex flex-col gap-1.5">
                      <FieldLabel required>Cell</FieldLabel>
                      <NativeSelect value={cellId} onChange={setCellId}
                        disabled={cells.length === 0}
                        placeholder={!buscentreId ? "Select buscentre first" : "— Select cell —"}
                        options={cells} displayFn={(o) => (o as ScopeOption).name} />
                    </div>
                  )}

                  {/* Shepherd */}
                  {level === "shepherd" && (
                    <div className="flex flex-col gap-1.5">
                      <FieldLabel required>Shepherd</FieldLabel>
                      <NativeSelect value={shepherdId} onChange={setShepherdId}
                        disabled={shepherds.length === 0}
                        placeholder={!cellId ? "Select cell first" : shepherds.length === 0 ? "No shepherds in this cell" : "— Select shepherd —"}
                        options={shepherds}
                        displayFn={(o) => {
                          const s = o as ShepherdSlot;
                          const sn = s.user?.name
                        ?? (s.person ? `${s.person.firstName} ${s.person.lastName}` : "Unassigned");
                      return `${sn} (${s._count.members}/5)`;
                        }} />
                    </div>
                  )}
                </div>
              )}
            </section>

            {error && <p className="text-[13px]" style={{ color: "var(--brand-danger)" }}>{error}</p>}
          </form>
        </SheetBody>

        <SheetFooter>
          <Button type="button" variant="outline" onClick={onClose}
                  className="h-9 text-[13px]" style={{ borderRadius: 8 }}>Cancel</Button>
          <Button type="submit" form="edit-member-form" disabled={busy}
                  className="h-9 text-[13px]"
                  style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MembersPage() {
  const { data: session } = useSession();
  const { activeView }    = useActiveRole();
  const [members,         setMembers]         = useState<Member[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [query,           setQuery]           = useState("");
  const [filter,          setFilter]          = useState<"all" | "active" | "inactive" | "system">("all");
  const [viewingMemberId, setViewingMemberId] = useState<string | null>(null);
  const [editing,         setEditing]         = useState<Member | null>(null);
  const [deleting,        setDeleting]        = useState<string | null>(null);

  const role               = activeView?.role ?? session?.user?.role;
  const scopedCellId      = role === "cell_shepherd"  ? (activeView?.cellId      ?? session?.user?.cellId)      : null;
  const scopedShepherdId  = role === "shepherd"       ? (session?.user?.shepherdId ?? null) : null;
  const scopedBuscentreId = role === "buscentre_head" ? (activeView?.buscentreId ?? session?.user?.buscentreId) : null;

  const loadMembers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (filter === "active")   params.set("isActive", "true");
    if (filter === "inactive") params.set("isActive", "false");
    if (filter === "system")   params.set("isUser", "true");
    // Auto-scope — each role only sees their slice
    if (scopedBuscentreId) params.set("buscentreId", scopedBuscentreId);
    if (scopedCellId)      params.set("cellId",      scopedCellId);
    if (scopedShepherdId)  params.set("shepherdId",  scopedShepherdId);
    const res = await fetch(`/api/members?${params.toString()}`);
    if (res.ok) setMembers(await res.json());
    setLoading(false);
  }, [query, filter, scopedBuscentreId, scopedCellId, scopedShepherdId]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(loadMembers, 300);
    return () => clearTimeout(t);
  }, [query, loadMembers]);

  async function handleDelete(id: string) {
    setDeleting(id);
    await fetch(`/api/members/${id}`, { method: "DELETE" });
    setDeleting(null);
    loadMembers();
  }

  // Derived counts for summary cards
  const total    = members.length;
  const active   = members.filter((m) => m.isActive).length;
  const inactive = members.filter((m) => !m.isActive).length;
  const system   = members.filter((m) => m.isUser).length;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1200px] mx-auto pb-20 lg:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[24px] font-semibold" style={{ color: "var(--brand-text)" }}>
            {scopedBuscentreId ? "Buscentre Members" : scopedCellId ? "My Cell Members" : scopedShepherdId ? "My Members" : "Members"}
          </h1>
          <p className="mt-0.5 text-[14px]" style={{ color: "var(--brand-muted)" }}>
            {loading ? "Loading…" : `${total} member${total !== 1 ? "s" : ""}${scopedCellId || scopedShepherdId ? " in your scope" : ""}`}
          </p>
        </div>
        <AddMemberModal onAdded={loadMembers} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SummaryCard title="Total Members"  value={total}    icon={<Users className="h-4 w-4" />} />
        <SummaryCard title="Active"         value={active}   icon={<UserCheck className="h-4 w-4" />} />
        <SummaryCard title="Inactive"       value={inactive} icon={<UserX className="h-4 w-4" />} />
        <SummaryCard title="System Users"   value={system}   icon={<ShieldCheck className="h-4 w-4" />} />
      </div>

      <SectionDivider label="All Members" />

      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                  style={{ color: "var(--brand-muted)" }} />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, phone, email or cell…"
            className="pl-9 h-10 text-[14px]"
            style={{ borderColor: "var(--brand-border)" }}
          />
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", "active", "inactive", "system"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="rounded-pill text-[12px] font-medium px-3 py-1.5 transition-colors"
              style={filter === f
                ? { background: "var(--brand-navy)", color: "#fff" }
                : { background: "var(--brand-navy-light)", color: "var(--brand-navy)" }}
            >
              {f === "all" ? "All" : f === "active" ? "Active" : f === "inactive" ? "Inactive" : "System users"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--brand-border)" }}>
        {loading ? (
          <div className="p-8 flex flex-col gap-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-10 rounded-lg" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center">
            <Users style={{ width: 40, height: 40, color: "var(--brand-muted)", margin: "0 auto 12px" }} />
            <p className="text-[14px] font-medium" style={{ color: "var(--brand-text)" }}>
              No members found
            </p>
            <p className="text-[14px] mt-1" style={{ color: "var(--brand-muted)" }}>
              {query ? "Try a different search." : "Add your first member using the button above."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow style={{ background: "#F9FAFB" }}>
                  {["Name", "Cell", "Buscentre", "Shepherd", "Gender", "Phone", "Joined", "Status", ""].map((h) => (
                    <TableHead
                      key={h}
                      className="text-[11px] font-medium uppercase tracking-[0.04em] px-4 py-2.5 whitespace-nowrap"
                      style={{ color: "var(--brand-muted)", borderBottom: "1px solid var(--brand-border)" }}
                    >
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>

              <TableBody>
                {members.map((member) => (
                  <TableRow
                    key={member.id}
                    style={{ borderBottom: "1px solid var(--brand-border)" }}
                    className="transition-colors duration-100 hover:bg-[var(--brand-navy-light)]"
                  >
                    {/* Name — click to open detail sheet */}
                    <TableCell className="px-4 py-3">
                      <button
                        className="text-left group"
                        onClick={() => setViewingMemberId(member.id)}
                      >
                        <span
                          className="text-[14px] font-medium group-hover:underline"
                          style={{ color: "var(--brand-navy)" }}
                        >
                          {member.firstName} {member.lastName}
                        </span>
                        <div className="flex gap-1 flex-wrap mt-0.5">
                          <LevelBadge member={member} />
                          {member.isUser && <SystemUserBadge />}
                        </div>
                      </button>
                    </TableCell>

                    {/* Cell / Placement */}
                    <TableCell className="px-4 py-3 text-[14px]" style={{ color: "var(--brand-text)" }}>
                      {memberPlacement(member).primary}
                    </TableCell>

                    {/* Buscentre */}
                    <TableCell className="px-4 py-3 text-[14px]" style={{ color: "var(--brand-muted)" }}>
                      {memberPlacement(member).secondary}
                    </TableCell>

                    {/* Shepherd */}
                    <TableCell className="px-4 py-3 text-[14px]" style={{ color: "var(--brand-text)" }}>
                      {shepherdName(member)}
                    </TableCell>

                    {/* Gender */}
                    <TableCell className="px-4 py-3 text-[14px]" style={{ color: "var(--brand-muted)" }}>
                      {member.gender ?? "—"}
                    </TableCell>

                    {/* Phone */}
                    <TableCell className="px-4 py-3 text-[14px]" style={{ color: "var(--brand-muted)" }}>
                      {member.phone ?? "—"}
                    </TableCell>

                    {/* Joined */}
                    <TableCell className="px-4 py-3 text-[14px] whitespace-nowrap"
                               style={{ color: "var(--brand-muted)" }}>
                      {member.joinedDate
                        ? new Date(member.joinedDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                        : "—"}
                    </TableCell>

                    {/* Status */}
                    <TableCell className="px-4 py-3">
                      <StatusBadge active={member.isActive} />
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg"
                          aria-label="Edit member"
                          onClick={() => setEditing(member)}
                        >
                          <Pencil className="h-4 w-4" style={{ color: "var(--brand-muted)" }} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg"
                          aria-label="Delete member"
                          disabled={deleting === member.id}
                          onClick={() => {
                            if (confirm(`Delete ${member.firstName} ${member.lastName}? This cannot be undone.`)) {
                              handleDelete(member.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" style={{ color: "var(--brand-danger)" }} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Member detail sheet */}
      <MemberDetailSheet
        memberId={viewingMemberId}
        onClose={() => setViewingMemberId(null)}
        onEdit={(m) => { setViewingMemberId(null); setEditing(m); }}
        onDeleted={loadMembers}
      />

      {/* Edit sheet */}
      <EditMemberSheet
        member={editing}
        onClose={() => setEditing(null)}
        onSaved={loadMembers}
      />
    </div>
  );
}
