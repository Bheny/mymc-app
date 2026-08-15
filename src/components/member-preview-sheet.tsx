"use client";

import { useEffect, useState } from "react";
import {
  Phone, Mail, Calendar, MapPin, Users, UserCircle,
  ShieldCheck, ShieldAlert, Briefcase, Wallet, GraduationCap,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody,
} from "@/components/ui/sheet";

// ─── Types ────────────────────────────────────────────────────────────────────

type MemberPreview = {
  id:         string;
  firstName:  string;
  lastName:   string;
  phone:      string | null;
  email:      string | null;
  gender:     string | null;
  isActive:   boolean;
  isUser:     boolean;
  dateOfBirth: string | null;
  joinedDate:  string | null;
  createdAt:   string;

  hometown?:          string | null;
  previousChurch?:    string | null;
  parentName?:        string | null;
  parentPhone?:       string | null;
  emergencyName?:     string | null;
  emergencyPhone?:    string | null;
  emergencyRelation?: string | null;

  isEmployed?:     boolean | null;
  employer?:       string | null;
  occupation?:     string | null;
  salaryRange?:    string | null;
  ownsBusiness?:   boolean | null;
  businessName?:   string | null;
  businessType?:   string | null;
  isStudent?:      boolean | null;
  schoolLevel?:    string | null;
  schoolName?:     string | null;
  programOfStudy?: string | null;

  effectiveShepherdName?: string;
  cell?:      { id: string; name: string; buscentre?: { id: string; name: string } | null } | null;
  buscentre?: { id: string; name: string } | null;
  mc?:        { id: string; name: string } | null;
  shepherdRole?: { id: string; _count: { members: number }; cell: { id: string; name: string } | null } | null;
  user?: {
    id: string; name: string;
    role?: { role: string } | null;
    supervisor?: { id: string; name: string; role?: { role: string } | null } | null;
  } | null;
};

type AttendanceRecord = {
  id:     string;
  status: "PRESENT" | "ABSENT" | "EXCUSED";
  notes:  string | null;
  service: { id: string; type: string; date: string; mode: string; speaker: string | null };
};

// ─── Label maps ───────────────────────────────────────────────────────────────

const SALARY_LABELS: Record<string, string> = {
  BELOW_1000:       "Below GH₵1,000",
  RANGE_1000_2999:  "GH₵1,000 – 2,999",
  RANGE_3000_4999:  "GH₵3,000 – 4,999",
  RANGE_5000_9999:  "GH₵5,000 – 9,999",
  RANGE_10000_PLUS: "GH₵10,000+",
};

const SCHOOL_LEVEL_LABELS: Record<string, string> = {
  PRIMARY:      "Primary",
  JHS:          "JHS",
  SHS:          "SHS",
  TERTIARY:     "Tertiary (University/College)",
  POSTGRADUATE: "Postgraduate",
  VOCATIONAL:   "Vocational / Technical",
};

// Mirrors src/lib/permissions.ts roleRank — kept local so client components
// don't pull in the Prisma client bundle just for a rank lookup.
const ROLE_RANK: Record<string, number> = {
  admin: 0, chief_shepherd: 1, mc_pastor: 2, buscentre_head: 3, cell_shepherd: 4, shepherd: 5,
};
function canViewSalary(role: string | null | undefined): boolean {
  return !!role && (ROLE_RANK[role] ?? 99) <= ROLE_RANK.cell_shepherd;
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
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

function memberPosition(detail: MemberPreview): { badge: string; badgeBg: string; badgeColor: string } {
  const sysRole = detail.user?.role?.role;
  if (sysRole === "cell_shepherd")  return { badge: "Cell Shepherd",  badgeBg: "var(--brand-navy)", badgeColor: "#fff" };
  if (sysRole === "buscentre_head") return { badge: "Buscentre Head", badgeBg: "#7C3AED",           badgeColor: "#fff" };
  if (sysRole === "mc_pastor")      return { badge: "MC Pastor",      badgeBg: "#059669",           badgeColor: "#fff" };
  if (sysRole === "chief_shepherd") return { badge: "Chief Shepherd", badgeBg: "#B45309",           badgeColor: "#fff" };
  if (sysRole === "admin")          return { badge: "Admin",          badgeBg: "#1F2937",           badgeColor: "#fff" };
  if (detail.shepherdRole)          return { badge: "Shepherd",       badgeBg: "#E0F4EC",           badgeColor: "#085041" };
  return                                   { badge: "Member",         badgeBg: "var(--brand-navy-light)", badgeColor: "var(--brand-navy)" };
}

function Avatar({ firstName, lastName }: { firstName: string; lastName: string }) {
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
  return (
    <div
      className="flex items-center justify-center rounded-xl shrink-0"
      style={{ width: 64, height: 64, background: "var(--brand-navy)", color: "#fff", fontSize: 20, fontWeight: 600 }}
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
    <div className="flex items-start gap-3 py-2.5" style={{ borderBottom: "1px solid var(--brand-border)" }}>
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.06em] pt-5 pb-3" style={{ color: "var(--brand-muted)" }}>
      {children}
    </p>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MemberPreviewSheet({
  memberId, onClose, viewerRole,
}: {
  memberId:   string | null;
  onClose:    () => void;
  viewerRole?: string | null;
}) {
  const [detail,     setDetail]     = useState<MemberPreview | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const canSeeSalary = canViewSalary(viewerRole);

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

  return (
    <Sheet open={!!memberId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent width={480}>
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
                    {(() => {
                      const pos = memberPosition(detail);
                      return (
                        <span className="rounded-pill text-[11px] font-semibold px-2.5 py-0.5"
                              style={{ background: pos.badgeBg, color: pos.badgeColor }}>
                          {pos.badge}
                        </span>
                      );
                    })()}
                    <span className="rounded-pill text-[11px] font-medium px-2.5 py-0.5"
                          style={detail.isActive
                            ? { background: "#E0F4EC", color: "#085041" }
                            : { background: "#FDECEA", color: "#791F1F" }}>
                      {detail.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>
              <SheetDescription>Member since {timeAgo(detail.createdAt)}</SheetDescription>
            </>
          )}
        </SheetHeader>

        <SheetBody>
          {loading ? (
            <div className="flex flex-col gap-3 pt-2">
              {[...Array(8)].map((_, i) => <div key={i} className="skeleton h-9 rounded-lg" />)}
            </div>
          ) : detail ? (
            <div className="flex flex-col gap-0">

              <SectionLabel>Personal</SectionLabel>
              <DetailRow icon={Phone}      label="Phone"         value={detail.phone} />
              <DetailRow icon={Mail}       label="Email"         value={detail.email} />
              <DetailRow icon={UserCircle} label="Gender"        value={detail.gender} />
              <DetailRow icon={Calendar}   label="Date of birth" value={formatDate(detail.dateOfBirth)} />
              <DetailRow icon={Calendar}   label="Date joined"   value={formatDate(detail.joinedDate)} />

              <SectionLabel>Background</SectionLabel>
              <DetailRow icon={MapPin} label="Hometown"     value={detail.hometown} />
              <DetailRow icon={MapPin} label="Prev. church" value={detail.previousChurch} />

              <SectionLabel>Parent / Guardian</SectionLabel>
              <DetailRow icon={Users} label="Name"  value={detail.parentName} />
              <DetailRow icon={Phone} label="Phone" value={detail.parentPhone} />

              <SectionLabel>Emergency Contact</SectionLabel>
              <DetailRow icon={Users}       label="Name"     value={detail.emergencyName} />
              <DetailRow icon={Phone}       label="Phone"    value={detail.emergencyPhone} />
              <DetailRow icon={UserCircle}  label="Relation" value={detail.emergencyRelation} />

              <SectionLabel>Employment</SectionLabel>
              <DetailRow icon={Briefcase} label="Employed"   value={detail.isEmployed == null ? null : detail.isEmployed ? "Yes" : "No"} />
              <DetailRow icon={Briefcase} label="Employer"   value={detail.employer} />
              <DetailRow icon={Briefcase} label="Occupation" value={detail.occupation} />
              <DetailRow icon={Wallet} label="Salary range"
                value={canSeeSalary ? (detail.salaryRange ? SALARY_LABELS[detail.salaryRange] ?? detail.salaryRange : null) : "Restricted"} />

              <SectionLabel>Business</SectionLabel>
              <DetailRow icon={Briefcase} label="Owns business" value={detail.ownsBusiness == null ? null : detail.ownsBusiness ? "Yes" : "No"} />
              <DetailRow icon={Briefcase} label="Business name" value={detail.businessName} />
              <DetailRow icon={Briefcase} label="Business type" value={detail.businessType} />

              <SectionLabel>Education</SectionLabel>
              <DetailRow icon={GraduationCap} label="Student" value={detail.isStudent == null ? null : detail.isStudent ? "Yes" : "No"} />
              <DetailRow icon={GraduationCap} label="Level"   value={detail.schoolLevel ? SCHOOL_LEVEL_LABELS[detail.schoolLevel] ?? detail.schoolLevel : null} />
              <DetailRow icon={GraduationCap} label="School"  value={detail.schoolName} />
              <DetailRow icon={GraduationCap} label="Program" value={detail.programOfStudy} />

              <SectionLabel>Assignment</SectionLabel>
              <DetailRow icon={Users} label="Shepherd" value={detail.effectiveShepherdName ?? "Unassigned"} />
              {detail.cell && <DetailRow icon={MapPin} label="Cell" value={detail.cell.name} />}
              {(detail.cell?.buscentre || detail.buscentre) && (
                <DetailRow icon={MapPin} label="Buscentre" value={detail.cell?.buscentre?.name ?? detail.buscentre?.name ?? null} />
              )}
              {detail.mc && <DetailRow icon={MapPin} label="MC" value={detail.mc.name} />}

              <SectionLabel>Attendance history</SectionLabel>
              {attendance.length === 0 ? (
                <p className="text-[13px] italic pb-2" style={{ color: "var(--brand-muted)" }}>
                  No attendance recorded yet.
                </p>
              ) : (
                <div className="flex flex-col rounded-xl overflow-hidden mb-2" style={{ border: "1px solid var(--brand-border)" }}>
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
                    const dateStr = new Date(rec.service.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                    return (
                      <div key={rec.id} className="flex items-center gap-2 px-3 py-2.5"
                           style={{ borderBottom: i < attendance.length - 1 ? "1px solid var(--brand-border)" : "none" }}>
                        <span className="rounded-pill text-[10px] font-semibold px-2 py-0.5 shrink-0 text-white"
                              style={{ background: svcColor[rec.service.type] ?? "var(--brand-navy)" }}>
                          {svcLabel[rec.service.type] ?? rec.service.type}
                        </span>
                        <span className="text-[13px] flex-1" style={{ color: "var(--brand-text)" }}>{dateStr}</span>
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

              <SectionLabel>System access</SectionLabel>
              {detail.isUser ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "#E0F4EC" }}>
                    <ShieldCheck className="h-5 w-5 shrink-0" style={{ color: "#085041" }} />
                    <div>
                      <p className="text-[14px] font-medium" style={{ color: "#085041" }}>
                        Activated — {detail.user?.role?.role.replace(/_/g, " ") ?? "system user"}
                      </p>
                      <p className="text-[12px] mt-0.5" style={{ color: "#085041" }}>This member can log in to the app.</p>
                    </div>
                  </div>
                  <DetailRow icon={UserCircle} label="Overseer"
                    value={detail.user?.supervisor
                      ? `${detail.user.supervisor.name}${detail.user.supervisor.role ? ` (${detail.user.supervisor.role.role.replace(/_/g, " ")})` : ""}`
                      : "Not yet assigned"} />
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "var(--brand-navy-light)" }}>
                  <ShieldAlert className="h-5 w-5 shrink-0" style={{ color: "var(--brand-navy)" }} />
                  <div>
                    <p className="text-[14px] font-medium" style={{ color: "var(--brand-navy)" }}>Not activated</p>
                    <p className="text-[12px] mt-0.5" style={{ color: "var(--brand-muted)" }}>No system access yet.</p>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
