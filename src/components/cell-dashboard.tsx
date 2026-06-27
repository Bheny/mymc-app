"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users, UserPlus, UserCircle, ShieldCheck,
  ShieldAlert, ChevronRight, LayoutGrid,
  Search, Loader2, X,
  Phone, Calendar, TrendingUp, BarChart2,
  AlertCircle, UserX, UserCheck,
} from "lucide-react";
import { SummaryCard } from "@/components/summary-card";
import { AddMemberModal } from "@/components/add-member-modal";
import { Button } from "@/components/ui/button";
import { BirthdaySection } from "@/components/birthday-section";
import { AttendanceStatsSection } from "@/components/attendance-stats-section";
import { BreadcrumbTrail } from "@/components/breadcrumb-trail";
import type { BirthdayEntry } from "@/lib/birthdays";
import { useActiveRole } from "@/hooks/use-active-role";
import { RecommendShepherdDialog } from "@/components/recommend-shepherd-dialog";
import { BUSCENTRE_DASHBOARD_ROLES } from "@/lib/view-permissions";

// ─── Types ────────────────────────────────────────────────────────────────────

type ShepherdMember = {
  id:         string;
  firstName:  string;
  lastName:   string;
  phone:      string | null;
  gender:     string | null;
  isActive:   boolean;
  isUser:     boolean;
  joinedDate: string | null;
  // Populated for activated members so we can detect their role
  user?: { id: string; role: { role: string } | null } | null;
  // Present once a cell shepherd has put this member forward as a shepherd candidate
  shepherdCandidacy?: { status: string } | null;
};

type ShepherdSlot = {
  id:     string;
  user:   { id: string; name: string } | null;
  person: { id: string; firstName: string; lastName: string } | null;
  _count: { members: number };
  members: ShepherdMember[];
};

type CellShepherd = { userId: string; name: string };

type CellOverview = {
  cell: {
    id: string; name: string;
    buscentre: { id: string; name: string } | null;
    mc:        { id: string; name: string } | null;
    shepherd:  string | null;
  };
  stats: {
    // Primary
    totalMembers:    number;
    activeMembers:   number;
    inactiveMembers: number;
    systemUsers:     number;
    totalShepherds:  number;
    occupiedSlots:   number;
    unoccupiedSlots: number;
    // Demographics
    maleCount:   number;
    femaleCount: number;
    havePhone:   number;
    haveDOB:     number;
    // Growth
    newThisMonth: number;
    newThisYear:  number;
    longStanding: number;
    // Shepherd load
    avgPerShepherd:      number;
    shepherdsAtCapacity: number;
    withoutShepherd:     number;
  };
  shepherds:         ShepherdSlot[];
  unassignedMembers: ShepherdMember[];
  cellShepherds:     CellShepherd[];
  birthdays:         BirthdayEntry[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shepherdName(s: ShepherdSlot): string | null {
  if (s.user)   return s.user.name;
  if (s.person) return `${s.person.firstName} ${s.person.lastName}`;
  return null;
}

function CandidacyBadge({ status }: { status: string }) {
  const isCertified = status === "CERTIFIED";
  return (
    <span
      className="rounded-pill text-[10px] font-medium px-2 py-0.5 shrink-0"
      style={isCertified
        ? { background: "#E8F0FE", color: "#1D4ED8" }
        : { background: "#EAF3EE", color: "#1A8C6C" }}
    >
      {isCertified ? "Certified shepherd" : "Recommended"}
    </span>
  );
}

function MemberRow({
  member, canRecommend, onChanged,
}: {
  member:       ShepherdMember;
  canRecommend: boolean;
  onChanged:    () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--brand-navy-light)]"
      style={{ borderBottom: "1px solid var(--brand-border)" }}
    >
      {/* Mini avatar */}
      <div
        className="flex items-center justify-center rounded-lg text-[11px] font-semibold shrink-0"
        style={{ width: 28, height: 28, background: "var(--brand-navy)", color: "#fff" }}
      >
        {member.firstName[0]}{member.lastName[0]}
      </div>

      {/* Name */}
      <span className="flex-1 text-[14px] font-medium" style={{ color: "var(--brand-text)" }}>
        {member.firstName} {member.lastName}
      </span>

      {/* Gender */}
      {member.gender && (
        <span className="text-[12px] hidden sm:block" style={{ color: "var(--brand-muted)" }}>
          {member.gender}
        </span>
      )}

      {/* Badges */}
      <div className="flex items-center gap-1.5 shrink-0">
        {!member.isActive && (
          <span className="rounded-pill text-[10px] font-medium px-2 py-0.5"
                style={{ background: "#FDECEA", color: "#791F1F" }}>
            Inactive
          </span>
        )}
        {member.isUser && (
          <span title="System user">
            <ShieldCheck className="h-3.5 w-3.5" style={{ color: "var(--brand-success)" }} />
          </span>
        )}
        {member.shepherdCandidacy ? (
          <CandidacyBadge status={member.shepherdCandidacy.status} />
        ) : canRecommend ? (
          <RecommendShepherdDialog
            memberId={member.id}
            memberName={`${member.firstName} ${member.lastName}`}
            onDone={onChanged}
          />
        ) : null}
      </div>
    </div>
  );
}

// ─── Unassigned member row — expandable with details + shepherd assign ─────────

function UnassignedMemberRow({
  member, shepherds, isLast, onAssigned, canRecommend, readOnly,
}: {
  member:         ShepherdMember;
  shepherds:      ShepherdSlot[];
  cellShepherds:  CellShepherd[];
  isLast:         boolean;
  onAssigned:     () => void;
  canRecommend:   boolean;
  readOnly:       boolean;
}) {
  const [open,     setOpen]     = useState(false);
  const [selected, setSelected] = useState("");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");

  function openExpanded() {
    setOpen((o) => !o);
    setSelected("");
    setError("");
  }

  async function assign() {
    if (!selected) { setError("Select a shepherd slot."); return; }
    setSaving(true); setError("");

    // Regular members (isUser: false) are put under a shepherd slot.
    // Supervisor chain for leadership roles is set automatically by the hierarchy.
    const res = await fetch(`/api/members/${member.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ shepherdId: selected }),
    });

    setSaving(false);
    if (res.ok) { setOpen(false); onAssigned(); }
    else { const d = await res.json().catch(() => ({})); setError(d.error ?? "Failed to assign."); }
  }

  const occupiedSlots   = shepherds.filter((s) => s.user || s.person);
  const unoccupiedSlots = shepherds.filter((s) => !s.user && !s.person);

  function slotLabel(s: ShepherdSlot): string {
    if (s.user)   return `${s.user.name} (${s._count.members}/5 members)`;
    if (s.person) return `${s.person.firstName} ${s.person.lastName} (${s._count.members}/5 members)`;
    return `Unassigned slot (${s._count.members}/5 members)`;
  }

  return (
    <>
      {/* ── Summary row — always visible ── */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none transition-colors hover:bg-[var(--brand-navy-light)]"
        style={{ borderBottom: open ? "none" : isLast ? "none" : "1px solid var(--brand-border)" }}
        onClick={openExpanded}
      >
        {/* Avatar */}
        <div className="flex items-center justify-center rounded-lg text-[11px] font-semibold shrink-0"
             style={{ width: 32, height: 32, background: "var(--brand-navy)", color: "#fff" }}>
          {member.firstName[0]}{member.lastName[0]}
        </div>

        {/* Name */}
        <span className="flex-1 text-[14px] font-medium" style={{ color: "var(--brand-text)" }}>
          {member.firstName} {member.lastName}
        </span>

        {/* Gender */}
        {member.gender && (
          <span className="text-[12px] hidden sm:block mr-2" style={{ color: "var(--brand-muted)" }}>
            {member.gender}
          </span>
        )}

        {/* Badges */}
        {!member.isActive && (
          <span className="rounded-pill text-[10px] font-medium px-2 py-0.5"
                style={{ background: "#FDECEA", color: "#791F1F" }}>
            Inactive
          </span>
        )}
        {member.isUser && (
          <span title="System user">
            <ShieldCheck className="h-3.5 w-3.5" style={{ color: "var(--brand-success)" }} />
          </span>
        )}
        {member.shepherdCandidacy ? (
          <CandidacyBadge status={member.shepherdCandidacy.status} />
        ) : canRecommend ? (
          <RecommendShepherdDialog
            memberId={member.id}
            memberName={`${member.firstName} ${member.lastName}`}
            onDone={onAssigned}
          />
        ) : null}

        {/* Expand chevron */}
        <ChevronRight
          className="h-4 w-4 shrink-0 transition-transform"
          style={{ color: "var(--brand-muted)", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
        />
      </div>

      {/* ── Expanded detail + assign ── */}
      {open && (
        <div
          className="px-4 pb-4 flex flex-col gap-3"
          style={{ borderBottom: isLast ? "none" : "1px solid var(--brand-border)", background: "#FAFAFA" }}
        >
          {/* Detail pills */}
          <div className="flex flex-wrap gap-2 pt-2">
            {[
              { label: "Phone",  value: member.phone },
              { label: "Gender", value: member.gender },
              { label: "Joined", value: member.joinedDate
                  ? new Date(member.joinedDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                  : null },
              { label: "Status", value: member.isActive ? "Active" : "Inactive" },
            ].map(({ label, value }) => value ? (
              <div key={label} className="flex flex-col rounded-lg px-3 py-1.5"
                   style={{ background: "var(--brand-navy-light)", minWidth: 80 }}>
                <span className="text-[10px] font-medium uppercase tracking-[0.04em]"
                      style={{ color: "var(--brand-muted)" }}>{label}</span>
                <span className="text-[13px] font-medium mt-0.5"
                      style={{ color: "var(--brand-text)" }}>{value}</span>
              </div>
            ) : null)}
          </div>

          {/* ── Assign to shepherd ── */}
          {!readOnly && (
            <div className="flex flex-col gap-2 pt-1">
              <p className="text-[12px] font-medium uppercase tracking-[0.04em]"
                 style={{ color: "var(--brand-muted)" }}>
                Assign to shepherd
              </p>

              <div className="flex gap-2">
                <select
                  value={selected}
                  onChange={(e) => { setSelected(e.target.value); setError(""); }}
                  className="flex-1 h-9 px-3 text-[13px] rounded-lg"
                  style={{ border: "1px solid var(--brand-border)", color: "var(--brand-text)", background: "#fff" }}
                >
                  <option value="">— Select shepherd —</option>
                  {occupiedSlots.length > 0 && (
                    <optgroup label="Named shepherds">
                      {occupiedSlots.map((s) => (
                        <option key={s.id} value={s.id} disabled={s._count.members >= 5}>
                          {slotLabel(s)}{s._count.members >= 5 ? " — full" : ""}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {unoccupiedSlots.length > 0 && (
                    <optgroup label="Unassigned slots">
                      {unoccupiedSlots.map((s) => (
                        <option key={s.id} value={s.id} disabled={s._count.members >= 5}>
                          {slotLabel(s)}{s._count.members >= 5 ? " — full" : ""}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {occupiedSlots.length === 0 && unoccupiedSlots.length === 0 && (
                    <option value="" disabled>No shepherd slots in this cell yet</option>
                  )}
                </select>

                <button
                  onClick={assign}
                  disabled={saving || !selected}
                  className="h-9 px-4 text-[13px] font-medium rounded-lg disabled:opacity-40 transition-opacity shrink-0"
                  style={{ background: "var(--brand-navy)", color: "#fff" }}
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Assign"}
                </button>
              </div>

              {error && <p className="text-[12px]" style={{ color: "var(--brand-danger)" }}>{error}</p>}
            </div>
          )}
        </div>
      )}
    </>
  );
}

type MemberOption = { id: string; firstName: string; lastName: string };

function ShepherdCard({
  slot, index, onAssigned, canRecommend, readOnly,
}: {
  slot:         ShepherdSlot;
  index:        number;
  onAssigned:   () => void;
  canRecommend: boolean;
  readOnly:     boolean;
}) {
  const name        = shepherdName(slot);
  const isAssigned  = !!name;
  const hasLogin    = !!slot.user;
  const memberCount = slot._count.members;

  const [assigning, setAssigning] = useState(false);
  const [query,     setQuery]     = useState("");
  const [results,   setResults]   = useState<MemberOption[]>([]);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");

  // Debounced search
  useEffect(() => {
    if (!assigning || query.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/org/members?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.slice(0, 8));
    }, 300);
    return () => clearTimeout(t);
  }, [query, assigning]);

  async function assign(memberId: string) {
    setSaving(true); setError("");
    const res = await fetch(`/api/org/shepherds/${slot.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
    setSaving(false);
    if (res.ok) {
      setAssigning(false); setQuery(""); setResults([]);
      onAssigned();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed to assign.");
    }
  }

  async function unassign() {
    setSaving(true);
    await fetch(`/api/org/shepherds/${slot.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: null }),
    });
    setSaving(false);
    onAssigned();
  }

  function cancelAssign() {
    setAssigning(false); setQuery(""); setResults([]); setError("");
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--brand-border)" }}>
      {/* ── Card header ── */}
      <div
        className="px-4 py-3 flex items-center gap-3"
        style={{ background: isAssigned ? "var(--brand-navy)" : "#F9FAFB", borderBottom: "1px solid var(--brand-border)" }}
      >
        {/* Avatar */}
        <div
          className="flex items-center justify-center rounded-lg shrink-0 text-[13px] font-semibold"
          style={{ width: 36, height: 36,
            background: isAssigned ? "rgba(255,255,255,0.15)" : "var(--brand-border)",
            color:      isAssigned ? "#fff" : "var(--brand-muted)" }}
        >
          {isAssigned
            ? name!.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
            : `S${index + 1}`}
        </div>

        {/* Name + badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-semibold"
                  style={{ color: isAssigned ? "#fff" : "var(--brand-muted)", fontStyle: isAssigned ? "normal" : "italic" }}>
              {name ?? "Unassigned shepherd"}
            </span>
            {isAssigned && !hasLogin && (
              <span className="rounded-pill text-[10px] font-medium px-1.5 py-0.5"
                    style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)" }}>
                no login
              </span>
            )}
          </div>
          <p className="text-[12px] mt-0.5"
             style={{ color: isAssigned ? "rgba(255,255,255,0.6)" : "var(--brand-muted)" }}>
            {memberCount}/5 members
          </p>
        </div>

        {/* Capacity bar + action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Unassign — only for person-linked (no system login), not while assigning */}
          {!readOnly && isAssigned && !hasLogin && !assigning && (
            <button
              onClick={unassign}
              disabled={saving}
              className="text-[11px] font-medium px-2 py-1 rounded-lg transition-opacity hover:opacity-80"
              style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.75)" }}
            >
              {saving ? "…" : "Unassign"}
            </button>
          )}

          {/* Assign button — for empty slots */}
          {!readOnly && !isAssigned && !assigning && (
            <button
              onClick={() => setAssigning(true)}
              className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-colors"
              style={{ background: "var(--brand-navy)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
            >
              Assign
            </button>
          )}

          {/* Cancel assign */}
          {!readOnly && assigning && (
            <button onClick={cancelAssign}
                    className="rounded-lg p-1 transition-opacity hover:opacity-70"
                    style={{ color: "var(--brand-muted)" }}>
              <X className="h-4 w-4" />
            </button>
          )}

          {/* Capacity bar */}
          <div className="w-14">
            <div className="rounded-pill overflow-hidden" style={{ height: 5, background: "rgba(255,255,255,0.2)" }}>
              <div className="h-full rounded-pill"
                   style={{ width: `${Math.min(100, (memberCount / 5) * 100)}%`,
                            background: memberCount >= 5 ? "#C0392B" : memberCount >= 4 ? "#F5A623" : "rgba(255,255,255,0.8)" }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Inline assign form ── */}
      {!readOnly && assigning && (
        <div className="px-4 py-3 flex flex-col gap-2"
             style={{ background: "var(--brand-navy-light)", borderBottom: "1px solid var(--brand-border)" }}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
                    style={{ color: "var(--brand-muted)" }} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search member by name…"
              className="w-full h-9 pl-8 pr-3 text-[13px] rounded-lg"
              style={{ border: "1px solid var(--brand-border)", outline: "none", background: "#fff",
                       color: "var(--brand-text)" }}
            />
            {saving && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin"
                       style={{ color: "var(--brand-muted)" }} />
            )}
          </div>

          {results.length > 0 && (
            <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--brand-border)" }}>
              {results.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={saving}
                  onClick={() => assign(m.id)}
                  className="w-full text-left px-3 py-2 text-[13px] hover:bg-white transition-colors"
                  style={{ borderBottom: "1px solid var(--brand-border)", color: "var(--brand-text)", background: "#FAFAFA" }}
                >
                  {m.firstName} {m.lastName}
                </button>
              ))}
            </div>
          )}

          {query.length >= 2 && results.length === 0 && !saving && (
            <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
              No members found for &ldquo;{query}&rdquo;
            </p>
          )}

          {error && <p className="text-[12px]" style={{ color: "var(--brand-danger)" }}>{error}</p>}
        </div>
      )}

      {/* ── Members list ── */}
      {slot.members.length === 0 ? (
        <div className="px-4 py-5 text-center">
          <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>No members assigned yet</p>
        </div>
      ) : (
        <div>
          {slot.members.map((m) => (
            <MemberRow key={m.id} member={m} canRecommend={canRecommend} onChanged={onAssigned} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1200px] mx-auto pb-20 lg:pb-8">
      <div className="skeleton h-7 w-40 rounded mb-2" />
      <div className="skeleton h-4 w-56 rounded mb-8" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => <div key={i} className="skeleton h-48 rounded-xl" />)}
      </div>
    </div>
  );
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function CardSectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-3 mt-2">
      <span className="text-[11px] font-medium uppercase tracking-[0.06em] whitespace-nowrap"
            style={{ color: "var(--brand-muted)" }}>
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: "var(--brand-border)" }} />
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function CellDashboard({ cellId }: { cellId?: string }) {
  // A drilled-in dashboard (explicit cellId) is read-only — write actions stay
  // reserved for the cell's own page or a real acting-up grant.
  const readOnly = !!cellId;

  const [data,    setData]    = useState<CellOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const { activeView } = useActiveRole();
  const actingCellId = activeView?.isActing && activeView.cellId ? activeView.cellId : null;
  // An explicit cellId (drill-down route) always wins over the acting-up override —
  // it's a deliberate "go view this node" action, not a permission switch.
  const queryParam = cellId
    ? `?viewCellId=${cellId}`
    : actingCellId ? `?actingCellId=${actingCellId}` : "";

  // Only the cell shepherd (or someone acting as one for this cell) can put
  // members forward as shepherd candidates — never while just drilled in to view.
  const canRecommend = !readOnly && activeView?.role === "cell_shepherd";

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/cell/overview${queryParam}`);
    if (res.ok) {
      setData(await res.json());
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed to load cell data.");
    }
    setLoading(false);
  }

  // Re-fetch whenever the active role or the drilled-into cell changes
  useEffect(() => { load(); }, [cellId, actingCellId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <Skeleton />;

  if (error || !data) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-12 max-w-[600px] mx-auto text-center">
        <LayoutGrid style={{ width: 40, height: 40, color: "var(--brand-muted)", margin: "0 auto 12px" }} />
        <p className="text-[14px] font-medium mb-1" style={{ color: "var(--brand-text)" }}>
          {error || "No cell assigned"}
        </p>
        <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>
          Your account needs to be scoped to a cell. Contact your Buscentre Head or administrator.
        </p>
      </div>
    );
  }

  const { cell, stats, shepherds, unassignedMembers, cellShepherds = [], birthdays = [] } = data;
  const canLinkToBuscentre = !!cell.buscentre && !!activeView?.role && BUSCENTRE_DASHBOARD_ROLES.includes(activeView.role);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1200px] mx-auto pb-20 lg:pb-8">

      <BreadcrumbTrail items={[
        { label: cell.mc?.name ?? "—" },
        { label: cell.buscentre?.name ?? "—", href: canLinkToBuscentre ? `/buscentre/${cell.buscentre!.id}` : undefined },
        { label: cell.name },
      ]} />

      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-[24px] font-semibold" style={{ color: "var(--brand-text)" }}>
            {cell.name}
          </h1>
          <p className="mt-0.5 text-[14px]" style={{ color: "var(--brand-muted)" }}>
            {[cell.buscentre?.name, cell.mc?.name].filter(Boolean).join(" · ")}
          </p>
        </div>
        {!readOnly && <AddMemberModal onAdded={load} />}
      </div>

      {/* ── Primary KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <SummaryCard title="Total Members"  value={stats.totalMembers}    icon={<Users className="h-4 w-4" />} />
        <SummaryCard title="Active"         value={stats.activeMembers}   icon={<UserCheck className="h-4 w-4" />}
          subtitle={`${stats.totalMembers > 0 ? Math.round((stats.activeMembers / stats.totalMembers) * 100) : 0}% of total`} />
        <SummaryCard title="Inactive"       value={stats.inactiveMembers} icon={<UserX className="h-4 w-4" />} />
        <SummaryCard title="System Users"   value={stats.systemUsers}     icon={<ShieldCheck className="h-4 w-4" />} />
      </div>

      {/* ── Demographics ── */}
      <CardSectionLabel label="Demographics" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <SummaryCard title="Male"
          value={stats.maleCount}
          icon={<Users className="h-4 w-4" />}
          subtitle={`${stats.totalMembers > 0 ? Math.round((stats.maleCount / stats.totalMembers) * 100) : 0}% of total`} />
        <SummaryCard title="Female"
          value={stats.femaleCount}
          icon={<Users className="h-4 w-4" />}
          subtitle={`${stats.totalMembers > 0 ? Math.round((stats.femaleCount / stats.totalMembers) * 100) : 0}% of total`} />
        <SummaryCard title="Have Phone"
          value={stats.havePhone}
          icon={<Phone className="h-4 w-4" />}
          subtitle={`${stats.totalMembers > 0 ? Math.round((stats.havePhone / stats.totalMembers) * 100) : 0}% coverage`} />
        <SummaryCard title="Have Date of Birth"
          value={stats.haveDOB}
          icon={<Calendar className="h-4 w-4" />}
          subtitle={`${stats.totalMembers > 0 ? Math.round((stats.haveDOB / stats.totalMembers) * 100) : 0}% coverage`} />
      </div>

      {/* ── Growth & Activity ── */}
      <CardSectionLabel label="Growth & Activity" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <SummaryCard title="New This Month"
          value={stats.newThisMonth}
          icon={<TrendingUp className="h-4 w-4" />} />
        <SummaryCard title="New This Year"
          value={stats.newThisYear}
          icon={<TrendingUp className="h-4 w-4" />} />
        <SummaryCard title="Long-standing, No Login"
          value={stats.longStanding}
          icon={<UserCircle className="h-4 w-4" />}
          subtitle="Joined 6+ months ago, not yet activated" />
      </div>

      {/* ── Shepherd Load ── */}
      <CardSectionLabel label="Shepherd Load" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <SummaryCard title="Avg Members / Shepherd"
          value={stats.avgPerShepherd}
          icon={<BarChart2 className="h-4 w-4" />}
          subtitle={`out of max 5 per shepherd`} />
        <SummaryCard title="Shepherds at Capacity"
          value={stats.shepherdsAtCapacity}
          icon={<AlertCircle className="h-4 w-4" />}
          subtitle={stats.shepherdsAtCapacity > 0 ? "Need new shepherd slots" : "All within capacity"} />
        <SummaryCard title="Without Shepherd"
          value={stats.withoutShepherd}
          icon={<UserX className="h-4 w-4" />}
          subtitle={stats.withoutShepherd > 0 ? "Assign below ↓" : "All members assigned"} />
      </div>

      {/* ── Shepherd health row ── */}
      <div
        className="rounded-xl px-5 py-3.5 mb-6 flex items-center justify-between flex-wrap gap-3"
        style={{ background: "var(--brand-navy-light)", border: "1px solid var(--brand-border)" }}
      >
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <UserCircle className="h-4 w-4" style={{ color: "var(--brand-navy)" }} />
            <span className="text-[14px] font-medium" style={{ color: "var(--brand-navy)" }}>
              {stats.occupiedSlots}/{stats.totalShepherds} shepherd slots filled
            </span>
          </div>
          {stats.unoccupiedSlots > 0 && (
            <span className="rounded-pill text-[12px] font-medium px-2.5 py-1"
                  style={{ background: "#FEF3DC", color: "#854F0B" }}>
              {stats.unoccupiedSlots} unassigned
            </span>
          )}
        </div>
        {!readOnly && stats.unoccupiedSlots > 0 && (
          <span className="text-[13px]" style={{ color: "var(--brand-muted)" }}>
            Click a shepherd card below to assign
          </span>
        )}
      </div>

      {/* ── Attendance averages ── */}
      <AttendanceStatsSection
        endpoint="/api/cell/attendance-stats"
        actingParam={cellId
          ? `viewCellId=${cellId}`
          : activeView?.isActing && activeView.cellId ? `actingCellId=${activeView.cellId}` : ""}
      />

      {/* ── Upcoming birthdays ── */}
      <BirthdaySection birthdays={birthdays} />

      {/* ── Shepherd roster ── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[16px] font-semibold" style={{ color: "var(--brand-text)" }}>
          Shepherd roster
        </h2>
        <span className="text-[13px]" style={{ color: "var(--brand-muted)" }}>
          {stats.totalShepherds} slot{stats.totalShepherds !== 1 ? "s" : ""}
        </span>
      </div>

      {shepherds.length === 0 ? (
        <div className="rounded-xl p-10 text-center mb-6" style={{ border: "1px solid var(--brand-border)" }}>
          <UserCircle style={{ width: 36, height: 36, color: "var(--brand-muted)", margin: "0 auto 10px" }} />
          <p className="text-[14px]" style={{ color: "var(--brand-muted)" }}>
            No shepherd slots yet.{" "}
            <Link href="/org" className="font-medium hover:underline" style={{ color: "var(--brand-navy)" }}>
              Create slots from the Org tree →
            </Link>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {shepherds.map((slot, i) => (
            <ShepherdCard key={slot.id} slot={slot} index={i} onAssigned={load} canRecommend={canRecommend} readOnly={readOnly} />
          ))}
        </div>
      )}

      {/* ── Unassigned members ── */}
      {unassignedMembers.length > 0 && (
        <>
          <div className="flex items-center gap-3 my-4">
            <span className="text-[12px] font-medium uppercase tracking-[0.04em]"
                  style={{ color: "var(--brand-danger)" }}>
              Not under any shepherd ({unassignedMembers.length})
            </span>
            <div className="flex-1 h-px" style={{ background: "var(--brand-border)" }} />
          </div>
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #F5C0BC" }}>
            <div className="px-4 py-2.5 flex items-center gap-2"
                 style={{ background: "#FDECEA", borderBottom: "1px solid #F5C0BC" }}>
              <ShieldAlert className="h-4 w-4" style={{ color: "#791F1F" }} />
              <p className="text-[13px] font-medium" style={{ color: "#791F1F" }}>
                These members have no shepherd assigned — tap to assign
              </p>
            </div>
            {unassignedMembers.map((m, i) => (
              <UnassignedMemberRow
                key={m.id}
                member={m}
                shepherds={shepherds}
                cellShepherds={cellShepherds}
                isLast={i === unassignedMembers.length - 1}
                onAssigned={load}
                canRecommend={canRecommend}
                readOnly={readOnly}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Quick actions ── */}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/members">
          <Button variant="outline" className="h-9 text-[13px]" style={{ borderRadius: 8 }}>
            <Users className="mr-2 h-4 w-4" /> View all members
          </Button>
        </Link>
        <Link href="/org/activate">
          <Button variant="outline" className="h-9 text-[13px]" style={{ borderRadius: 8 }}>
            <UserPlus className="mr-2 h-4 w-4" /> Activate member
          </Button>
        </Link>
        {canRecommend && (
          <Link href="/org/shepherd-candidates">
            <Button variant="outline" className="h-9 text-[13px]" style={{ borderRadius: 8 }}>
              <ShieldCheck className="mr-2 h-4 w-4" /> Shepherd candidates
            </Button>
          </Link>
        )}
      </div>

    </div>
  );
}
