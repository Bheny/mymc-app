"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users, UserCheck, UserX, ShieldCheck,
  LayoutGrid, TrendingUp, AlertCircle,
  Building2, Phone, Mail, ChevronRight, ArrowUpRight,
  Plus, Loader2, Search, X, UserMinus,
} from "lucide-react";
import { SummaryCard } from "@/components/summary-card";
import { AddMemberModal } from "@/components/add-member-modal";
import { BirthdaySection } from "@/components/birthday-section";
import { AttendanceStatsSection } from "@/components/attendance-stats-section";
import { BreadcrumbTrail } from "@/components/breadcrumb-trail";
import { Button } from "@/components/ui/button";
import type { BirthdayEntry } from "@/lib/birthdays";
import { useActiveRole } from "@/hooks/use-active-role";
import { CELL_DASHBOARD_ROLES } from "@/lib/view-permissions";

// ─── Types ────────────────────────────────────────────────────────────────────

type ShepherdInfo = {
  id:          string;
  name:        string | null;
  phone:       string | null;
  email:       string | null;
  memberCount: number;
  isOccupied:  boolean;
  hasLogin:    boolean;
};

type CellInfo = {
  id:       string;
  name:     string;
  location: string | null;
  stats: {
    totalMembers:   number;
    totalShepherds: number;
    occupiedSlots:  number;
  };
  cellShepherd: {
    userId: string;
    name:   string | null;
    email:  string | null;
    phone:  string | null;
  } | null;
  shepherds: ShepherdInfo[];
};

type RecentMember = {
  id:        string;
  firstName: string;
  lastName:  string;
  isActive:  boolean;
  isUser:    boolean;
  createdAt: string;
  cell:      { id: string; name: string } | null;
};

type BuscentreOverview = {
  buscentre: {
    id:       string;
    name:     string;
    location: string | null;
    mc:       { id: string; name: string } | null;
    head:     string | null;
  };
  stats: {
    totalCells:               number;
    totalMembers:             number;
    activeMembers:            number;
    inactiveMembers:          number;
    systemUsers:              number;
    membersInDepartment:      number;
    totalShepherds:           number;
    unoccupiedSlots:          number;
    cellShepherdsAssigned:    number;
    cellShepherdsUnassigned:  number;
    newThisMonth:             number;
    newThisYear:              number;
  };
  recentMembers: RecentMember[];
  birthdays:     BirthdayEntry[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Cell card ────────────────────────────────────────────────────────────────

type MemberOption = { id: string; firstName: string; lastName: string };

function CellCard({ cell, viewerRole, readOnly }: { cell: CellInfo; onRefresh: () => void; viewerRole?: string; readOnly?: boolean }) {
  const [expanded, setExpanded] = useState(false);

  // Local shepherd list — updated in place so shepherd actions don't remount the page
  const [shepherds, setShepherds] = useState<ShepherdInfo[]>(cell.shepherds);
  const totalShepherds  = shepherds.length;
  const occupiedSlots   = shepherds.filter((s) => s.isOccupied).length;
  const unassignedSlots = totalShepherds - occupiedSlots;
  const { totalMembers } = cell.stats;
  const memberCapacityPct = totalShepherds > 0
    ? Math.min(100, (totalMembers / (totalShepherds * 5)) * 100)
    : 0;
  const canViewFullDashboard = !!viewerRole && CELL_DASHBOARD_ROLES.includes(viewerRole);

  // Shepherd slot management
  const [addingSlot,    setAddingSlot]    = useState(false);
  const [slotError,     setSlotError]     = useState("");
  const [assigningId,   setAssigningId]   = useState<string | null>(null);
  const [assignQuery,   setAssignQuery]   = useState("");
  const [assignResults, setAssignResults] = useState<MemberOption[]>([]);
  const [assignBusy,    setAssignBusy]    = useState(false);
  const [assignError,   setAssignError]   = useState("");

  // Debounced member search for assignment
  useEffect(() => {
    if (!assigningId || assignQuery.length < 2) { setAssignResults([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/org/members?q=${encodeURIComponent(assignQuery)}&cellId=${cell.id}`);
      const data: MemberOption[] = await res.json().catch(() => []);
      setAssignResults(data.slice(0, 6));
    }, 300);
    return () => clearTimeout(t);
  }, [assignQuery, assigningId, cell.id]);

  function openAssign(slotId: string) {
    setAssigningId(slotId); setAssignQuery(""); setAssignResults([]); setAssignError("");
  }
  function closeAssign() {
    setAssigningId(null); setAssignQuery(""); setAssignResults([]); setAssignError("");
  }

  async function handleAddSlot() {
    setAddingSlot(true); setSlotError("");
    const res = await fetch("/api/org/shepherds", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cellId: cell.id }),
    });
    setAddingSlot(false);
    if (res.ok) {
      const slot = await res.json();
      // Append the new empty slot locally — no full page reload
      setShepherds((prev) => [...prev, {
        id: slot.id, name: null, phone: null, email: null,
        memberCount: 0, isOccupied: false, hasLogin: false,
      }]);
    } else {
      const d = await res.json().catch(() => ({}));
      setSlotError(d.error ?? "Could not add shepherd slot.");
    }
  }

  async function handleAssign(memberId: string) {
    if (!assigningId) return;
    setAssignBusy(true); setAssignError("");
    const res = await fetch(`/api/org/shepherds/${assigningId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
    setAssignBusy(false);
    if (res.ok) {
      const updated = await res.json();
      const name = updated.user?.name
        ?? (updated.person ? `${updated.person.firstName} ${updated.person.lastName}` : null);
      // Patch only this slot in local state
      setShepherds((prev) => prev.map((s) =>
        s.id === assigningId
          ? { ...s, name, isOccupied: true, hasLogin: !!updated.user, memberCount: updated._count?.members ?? s.memberCount }
          : s
      ));
      closeAssign();
    } else {
      const d = await res.json().catch(() => ({}));
      setAssignError(d.error ?? "Could not assign shepherd.");
    }
  }

  async function handleUnassign(slotId: string) {
    const res = await fetch(`/api/org/shepherds/${slotId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: null }),
    });
    if (res.ok) {
      // Clear only this slot locally
      setShepherds((prev) => prev.map((s) =>
        s.id === slotId
          ? { ...s, name: null, isOccupied: false, hasLogin: false }
          : s
      ));
    }
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--brand-border)" }}>
      {/* ── Header ── */}
      <div
        className="px-4 py-3 flex items-center gap-3 cursor-pointer select-none hover:bg-[var(--brand-navy-light)] transition-colors"
        style={{ borderBottom: expanded ? "1px solid var(--brand-border)" : "none" }}
        onClick={() => setExpanded((o) => !o)}
      >
        {/* Icon */}
        <div className="flex items-center justify-center rounded-lg shrink-0"
             style={{ width: 36, height: 36, background: "var(--brand-navy)", color: "#fff" }}>
          <LayoutGrid style={{ width: 18, height: 18 }} />
        </div>

        {/* Name + location */}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold truncate" style={{ color: "var(--brand-text)" }}>
            {cell.name}
          </p>
          {cell.location && (
            <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>{cell.location}</p>
          )}
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[12px] font-medium rounded-pill px-2 py-0.5"
                style={{ background: "var(--brand-navy-light)", color: "var(--brand-navy)" }}>
            {totalMembers} members
          </span>
          {unassignedSlots > 0 && (
            <span className="text-[11px] font-medium rounded-pill px-2 py-0.5"
                  style={{ background: "#FEF3DC", color: "#854F0B" }}>
              {unassignedSlots} slot{unassignedSlots !== 1 ? "s" : ""} open
            </span>
          )}
          {!cell.cellShepherd && (
            <span className="text-[11px] font-medium rounded-pill px-2 py-0.5"
                  style={{ background: "#FDECEA", color: "#791F1F" }}>
              No shepherd
            </span>
          )}
          <ChevronRight
            className="transition-transform"
            style={{ width: 16, height: 16, color: "var(--brand-muted)",
                     transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
          />
        </div>
      </div>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div className="px-4 py-4 flex flex-col gap-4" style={{ background: "#FAFAFA" }}>
          {/* Capacity bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium uppercase tracking-[0.04em]"
                    style={{ color: "var(--brand-muted)" }}>
                Capacity
              </span>
              <span className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
                {totalMembers} / {totalShepherds * 5} max
              </span>
            </div>
            <div className="rounded-pill overflow-hidden" style={{ height: 6, background: "var(--brand-border)" }}>
              <div className="h-full rounded-pill transition-all"
                   style={{ width: `${memberCapacityPct}%`,
                            background: memberCapacityPct >= 90 ? "#C0392B" : memberCapacityPct >= 70 ? "#F5A623" : "var(--brand-navy)" }} />
            </div>
          </div>

          {/* Cell shepherd */}
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.04em] mb-2"
               style={{ color: "var(--brand-muted)" }}>
              Cell Shepherd
            </p>
            {cell.cellShepherd ? (
              <div className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                   style={{ background: "var(--brand-navy-light)", border: "1px solid var(--brand-border)" }}>
                <div className="flex items-center justify-center rounded-lg shrink-0 text-[11px] font-bold"
                     style={{ width: 30, height: 30, background: "var(--brand-navy)", color: "#fff" }}>
                  {(cell.cellShepherd.name ?? "?").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold" style={{ color: "var(--brand-text)" }}>
                    {cell.cellShepherd.name ?? "—"}
                  </p>
                  <div className="flex items-center gap-3 flex-wrap mt-0.5">
                    {cell.cellShepherd.phone && (
                      <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--brand-muted)" }}>
                        <Phone style={{ width: 10, height: 10 }} /> {cell.cellShepherd.phone}
                      </span>
                    )}
                    {cell.cellShepherd.email && (
                      <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--brand-muted)" }}>
                        <Mail style={{ width: 10, height: 10 }} /> {cell.cellShepherd.email}
                      </span>
                    )}
                  </div>
                </div>
                <ShieldCheck style={{ width: 14, height: 14, color: "var(--brand-success)", flexShrink: 0 }} />
              </div>
            ) : (
              <p className="text-[13px] italic" style={{ color: "var(--brand-muted)" }}>
                No cell shepherd assigned
              </p>
            )}
          </div>

          {/* Shepherd slots */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.04em]"
                 style={{ color: "var(--brand-muted)" }}>
                Shepherd Slots ({occupiedSlots}/{totalShepherds} filled)
              </p>
              {!readOnly && (
                <button
                  onClick={handleAddSlot}
                  disabled={addingSlot}
                  className="flex items-center gap-1 text-[12px] font-medium rounded-lg px-2 py-1 transition-colors hover:opacity-80"
                  style={{ background: "var(--brand-navy-light)", color: "var(--brand-navy)" }}
                >
                  {addingSlot ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Add slot
                </button>
              )}
            </div>

            {slotError && (
              <p className="text-[12px] mb-2" style={{ color: "var(--brand-danger)" }}>{slotError}</p>
            )}

            {shepherds.length === 0 ? (
              <p className="text-[13px] italic" style={{ color: "var(--brand-muted)" }}>
                No shepherd slots yet — add one above.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {shepherds.map((sh) => (
                  <div key={sh.id}>
                    <div className="flex items-center gap-3 px-3 py-2 rounded-lg"
                         style={{ background: sh.isOccupied ? "var(--brand-navy-light)" : "#F9FAFB",
                                  border: "1px solid var(--brand-border)" }}>
                      <div className="flex items-center justify-center rounded-md shrink-0 text-[10px] font-bold"
                           style={{ width: 24, height: 24,
                                    background: sh.isOccupied ? "var(--brand-navy)" : "var(--brand-border)",
                                    color: sh.isOccupied ? "#fff" : "var(--brand-muted)" }}>
                        {sh.isOccupied && sh.name
                          ? sh.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
                          : "—"}
                      </div>
                      <span className="flex-1 text-[13px]"
                            style={{ color: sh.isOccupied ? "var(--brand-text)" : "var(--brand-muted)",
                                     fontStyle: sh.isOccupied ? "normal" : "italic" }}>
                        {sh.name ?? "Unassigned"}
                        {sh.isOccupied && !sh.hasLogin && (
                          <span className="ml-1.5 text-[10px] font-medium rounded-pill px-1.5 py-0.5"
                                style={{ background: "#FEF3DC", color: "#854F0B" }}>
                            no login
                          </span>
                        )}
                      </span>
                      <span className="text-[12px] font-medium rounded-pill px-2 py-0.5"
                            style={{ background: sh.memberCount >= 5 ? "#FDECEA" : "var(--brand-border)",
                                     color: sh.memberCount >= 5 ? "#791F1F" : "var(--brand-muted)" }}>
                        {sh.memberCount}/5
                      </span>
                      {/* Assign / unassign */}
                      {!readOnly && (sh.isOccupied ? (
                        <button
                          onClick={() => handleUnassign(sh.id)}
                          className="p-1 rounded hover:bg-[#FDECEA] transition-colors"
                          title="Unassign shepherd"
                        >
                          <UserMinus className="h-3.5 w-3.5" style={{ color: "var(--brand-danger)" }} />
                        </button>
                      ) : (
                        <button
                          onClick={() => openAssign(sh.id)}
                          className="text-[11px] font-medium px-2 py-0.5 rounded-lg transition-colors hover:opacity-80"
                          style={{ background: "var(--brand-navy)", color: "#fff" }}
                        >
                          Assign
                        </button>
                      ))}
                    </div>

                    {/* Inline assign search */}
                    {!readOnly && assigningId === sh.id && (
                      <div className="mt-1.5 rounded-lg p-3 flex flex-col gap-2"
                           style={{ background: "#F0F4FA", border: "1px solid var(--brand-border)" }}>
                        <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5"
                             style={{ background: "#fff", border: "1px solid var(--brand-border)" }}>
                          <Search className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--brand-muted)" }} />
                          <input
                            autoFocus
                            value={assignQuery}
                            onChange={(e) => setAssignQuery(e.target.value)}
                            placeholder="Search member by name…"
                            className="flex-1 text-[13px] outline-none bg-transparent"
                            style={{ color: "var(--brand-text)" }}
                          />
                          <button onClick={closeAssign}>
                            <X className="h-3.5 w-3.5" style={{ color: "var(--brand-muted)" }} />
                          </button>
                        </div>
                        {assignError && (
                          <p className="text-[12px]" style={{ color: "var(--brand-danger)" }}>{assignError}</p>
                        )}
                        {assignBusy && (
                          <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--brand-muted)" }}>
                            <Loader2 className="h-3 w-3 animate-spin" /> Assigning…
                          </div>
                        )}
                        {assignResults.length > 0 && (
                          <div className="flex flex-col rounded-lg overflow-hidden"
                               style={{ border: "1px solid var(--brand-border)" }}>
                            {assignResults.map((m, i) => (
                              <button
                                key={m.id}
                                onClick={() => handleAssign(m.id)}
                                className="text-left px-3 py-2 text-[13px] hover:bg-[var(--brand-navy-light)] transition-colors"
                                style={{
                                  borderBottom: i < assignResults.length - 1 ? "1px solid var(--brand-border)" : "none",
                                  color: "var(--brand-text)",
                                }}
                              >
                                {m.firstName} {m.lastName}
                              </button>
                            ))}
                          </div>
                        )}
                        {assignQuery.length >= 2 && assignResults.length === 0 && !assignBusy && (
                          <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
                            No members found in this cell.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* View full cell dashboard */}
          {canViewFullDashboard && (
            <Link
              href={`/cell/${cell.id}`}
              className="flex items-center gap-1.5 text-[12px] font-medium self-start hover:underline"
              style={{ color: "var(--brand-navy)" }}
            >
              View full cell dashboard <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Recent member row ────────────────────────────────────────────────────────

function RecentMemberRow({ member }: { member: RecentMember }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--brand-navy-light)]"
         style={{ borderBottom: "1px solid var(--brand-border)" }}>
      <div className="flex items-center justify-center rounded-lg text-[11px] font-semibold shrink-0"
           style={{ width: 28, height: 28, background: "var(--brand-navy)", color: "#fff" }}>
        {member.firstName[0]}{member.lastName[0]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium truncate" style={{ color: "var(--brand-text)" }}>
          {member.firstName} {member.lastName}
        </p>
        {member.cell && (
          <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>{member.cell.name}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {!member.isActive && (
          <span className="rounded-pill text-[10px] font-medium px-2 py-0.5"
                style={{ background: "#FDECEA", color: "#791F1F" }}>
            Inactive
          </span>
        )}
        {member.isUser && (
          <ShieldCheck className="h-3.5 w-3.5" style={{ color: "var(--brand-success)" }} />
        )}
        <span className="text-[11px]" style={{ color: "var(--brand-muted)" }}>
          {new Date(member.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </span>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1200px] mx-auto pb-20 lg:pb-8">
      <div className="skeleton h-7 w-48 rounded mb-2" />
      <div className="skeleton h-4 w-64 rounded mb-8" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function BuscentreDashboard({ buscentreId }: { buscentreId?: string }) {
  // A drilled-in dashboard (explicit buscentreId) is read-only — write actions stay
  // reserved for the buscentre's own page or a real acting-up grant.
  const readOnly = !!buscentreId;

  const [overview, setOverview] = useState<BuscentreOverview | null>(null);
  const [cells,    setCells]    = useState<CellInfo[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  const { activeView } = useActiveRole();
  const actingBuscentreId = activeView?.isActing && activeView.buscentreId ? activeView.buscentreId : null;
  // An explicit buscentreId (drill-down route) always wins over the acting-up override —
  // it's a deliberate "go view this node" action, not a permission switch.
  const queryParam = buscentreId
    ? `?viewBuscentreId=${buscentreId}`
    : actingBuscentreId ? `?actingBuscentreId=${actingBuscentreId}` : "";

  async function load() {
    setLoading(true);
    const [ovRes, cellsRes] = await Promise.all([
      fetch(`/api/buscentre/overview${queryParam}`),
      fetch(`/api/buscentre/cells${queryParam}`),
    ]);

    if (ovRes.ok && cellsRes.ok) {
      const [ovData, cellsData] = await Promise.all([ovRes.json(), cellsRes.json()]);
      setOverview(ovData);
      setCells(cellsData.cells ?? []);
    } else {
      const d = await ovRes.json().catch(() => ({}));
      setError(d.error ?? "Failed to load buscentre data.");
    }
    setLoading(false);
  }

  // Re-fetch whenever the active role or the drilled-into buscentre changes
  useEffect(() => { load(); }, [buscentreId, actingBuscentreId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <Skeleton />;

  if (error || !overview) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-12 max-w-[600px] mx-auto text-center">
        <Building2 style={{ width: 40, height: 40, color: "var(--brand-muted)", margin: "0 auto 12px" }} />
        <p className="text-[14px] font-medium mb-1" style={{ color: "var(--brand-text)" }}>
          {error || "No buscentre assigned"}
        </p>
        <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>
          Your account needs to be scoped to a buscentre. Contact your MC Pastor or administrator.
        </p>
      </div>
    );
  }

  const { buscentre, stats, recentMembers, birthdays } = overview;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1200px] mx-auto pb-20 lg:pb-8">

      <BreadcrumbTrail items={[
        { label: buscentre.mc?.name ?? "—" },
        { label: buscentre.name },
      ]} />

      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-[24px] font-semibold" style={{ color: "var(--brand-text)" }}>
            {buscentre.name}
          </h1>
          <p className="mt-0.5 text-[14px]" style={{ color: "var(--brand-muted)" }}>
            {[buscentre.location, buscentre.mc?.name].filter(Boolean).join(" · ")}
          </p>
        </div>
        {!readOnly && <AddMemberModal onAdded={load} />}
      </div>

      {/* ── Primary KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <SummaryCard title="Total Members"  value={stats.totalMembers}
          icon={<Users className="h-4 w-4" />}
          subtitle={`${stats.membersInDepartment} in a department (${stats.totalMembers > 0 ? Math.round((stats.membersInDepartment / stats.totalMembers) * 100) : 0}%)`} />
        <SummaryCard title="Active"         value={stats.activeMembers}
          icon={<UserCheck className="h-4 w-4" />}
          subtitle={`${stats.totalMembers > 0 ? Math.round((stats.activeMembers / stats.totalMembers) * 100) : 0}% of total`} />
        <SummaryCard title="Inactive"       value={stats.inactiveMembers}
          icon={<UserX className="h-4 w-4" />} />
        <SummaryCard title="System Users"   value={stats.systemUsers}
          icon={<ShieldCheck className="h-4 w-4" />} />
      </div>

      {/* ── Structure stats ── */}
      <CardSectionLabel label="Structure" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <SummaryCard title="Total Cells"     value={stats.totalCells}
          icon={<LayoutGrid className="h-4 w-4" />} />
        <SummaryCard title="Total Shepherds" value={stats.totalShepherds}
          icon={<Users className="h-4 w-4" />}
          subtitle={stats.unoccupiedSlots > 0 ? `${stats.unoccupiedSlots} slots open` : "All slots filled"} />
        <SummaryCard title="Cells with Shepherd" value={stats.cellShepherdsAssigned}
          icon={<ShieldCheck className="h-4 w-4" />}
          subtitle={`${stats.cellShepherdsUnassigned} unassigned`} />
        <SummaryCard title="Open Shepherd Slots" value={stats.unoccupiedSlots}
          icon={<AlertCircle className="h-4 w-4" />}
          subtitle={stats.unoccupiedSlots > 0 ? "Needs attention" : "All filled"} />
      </div>

      {/* ── Growth ── */}
      <CardSectionLabel label="Growth" />
      <div className="grid grid-cols-2 gap-3 mb-6">
        <SummaryCard title="New This Month" value={stats.newThisMonth}
          icon={<TrendingUp className="h-4 w-4" />} />
        <SummaryCard title="New This Year"  value={stats.newThisYear}
          icon={<TrendingUp className="h-4 w-4" />} />
      </div>

      {/* ── Attendance averages ── */}
      <AttendanceStatsSection
        endpoint="/api/buscentre/attendance-stats"
        actingParam={buscentreId
          ? `viewBuscentreId=${buscentreId}`
          : activeView?.isActing && activeView.buscentreId ? `actingBuscentreId=${activeView.buscentreId}` : ""}
      />

      {/* ── Upcoming birthdays ── */}
      <BirthdaySection birthdays={birthdays} />

      {/* ── Cells ── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[16px] font-semibold" style={{ color: "var(--brand-text)" }}>
          Cells
        </h2>
        <span className="text-[13px]" style={{ color: "var(--brand-muted)" }}>
          {stats.totalCells} cell{stats.totalCells !== 1 ? "s" : ""}
        </span>
      </div>

      {cells.length === 0 ? (
        <div className="rounded-xl p-10 text-center mb-6" style={{ border: "1px solid var(--brand-border)" }}>
          <LayoutGrid style={{ width: 36, height: 36, color: "var(--brand-muted)", margin: "0 auto 10px" }} />
          <p className="text-[14px]" style={{ color: "var(--brand-muted)" }}>
            No cells yet.{" "}
            <Link href="/org" className="font-medium hover:underline" style={{ color: "var(--brand-navy)" }}>
              Create cells from the Org tree →
            </Link>
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 mb-6">
          {cells.map((cell) => (
            <CellCard key={cell.id} cell={cell} onRefresh={load} viewerRole={activeView?.role} readOnly={readOnly} />
          ))}
        </div>
      )}

      {/* ── Recently added members ── */}
      {recentMembers.length > 0 && (
        <>
          <CardSectionLabel label="Recently Added" />
          <div className="rounded-xl overflow-hidden mb-6" style={{ border: "1px solid var(--brand-border)" }}>
            {recentMembers.map((m) => <RecentMemberRow key={m.id} member={m} />)}
          </div>
        </>
      )}

      {/* ── Quick actions ── */}
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/members">
          <Button variant="outline" className="h-9 text-[13px]" style={{ borderRadius: 8 }}>
            <Users className="mr-2 h-4 w-4" /> All members
          </Button>
        </Link>
        <Link href="/org/activate">
          <Button variant="outline" className="h-9 text-[13px]" style={{ borderRadius: 8 }}>
            <ShieldCheck className="mr-2 h-4 w-4" /> Activate member
          </Button>
        </Link>
        <Link href="/org">
          <Button variant="outline" className="h-9 text-[13px]" style={{ borderRadius: 8 }}>
            <LayoutGrid className="mr-2 h-4 w-4" /> Org tree
          </Button>
        </Link>
      </div>

    </div>
  );
}
