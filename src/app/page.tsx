"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { SummaryCard } from "@/components/summary-card";
import { Button } from "@/components/ui/button";
import { BirthdaySection } from "@/components/birthday-section";
import type { BirthdayEntry } from "@/lib/birthdays";
import { useActiveRole } from "@/hooks/use-active-role";
import {
  Users, UserCheck, ShieldCheck, AlertTriangle,
  Network, Building2, Home, UserCircle,
  ChevronRight, ShieldAlert, UserPlus, LayoutGrid, MapPin,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type RecentMember = {
  id:        string;
  firstName: string;
  lastName:  string;
  createdAt: string;
  isUser:    boolean;
  isActive:  boolean;
  cell:      { name: string; buscentre: { name: string } } | null;
  buscentre: { name: string } | null;
  mc:        { name: string } | null;
};

type TopCell = {
  id:        string;
  name:      string;
  buscentre: { name: string };
  _count:    { members: number; shepherds: number };
  userRoles: { user: { name: string } }[];
};

type TopShepherd = {
  id:     string;
  user:   { id: string; name: string } | null;
  person: { firstName: string; lastName: string } | null;
  cell:   { name: string };
  _count: { members: number };
};

type DashboardData = {
  totalMembers:    number;
  activeMembers:   number;
  inactiveMembers: number;
  systemUsers:     number;
  totalMCs:        number;
  totalBuscentres: number;
  totalCells:      number;
  totalShepherds:  number;
  openActingUpFlags:       number;
  openCapacityWarnings:    number;
  totalOpenWarnings:       number;
  unoccupiedShepherdSlots: number;
  recentMembers: RecentMember[];
  topCells:      TopCell[];
  topShepherds:  TopShepherd[];
  birthdays:     BirthdayEntry[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shepherdName(s: TopShepherd): string {
  if (s.user)   return s.user.name;
  if (s.person) return `${s.person.firstName} ${s.person.lastName}`;
  return "";
}

function timeAgo(iso: string): string {
  const ms   = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60)   return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30)   return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function memberLocation(m: RecentMember): string {
  if (m.cell)      return `${m.cell.name} · ${m.cell.buscentre.name}`;
  if (m.buscentre) return `${m.buscentre.name} (buscentre level)`;
  if (m.mc)        return `${m.mc.name} (MC level)`;
  return "Unassigned";
}

function MemberAvatar({ firstName, lastName }: { firstName: string; lastName: string }) {
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
  return (
    <div className="flex items-center justify-center rounded-lg shrink-0 text-[13px] font-semibold"
         style={{ width: 36, height: 36, background: "var(--brand-navy)", color: "#fff" }}>
      {initials}
    </div>
  );
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

function CapacityBar({ count, max }: { count: number; max: number }) {
  const pct   = Math.min(100, Math.round((count / Math.max(max, 1)) * 100));
  const color = pct >= 100 ? "var(--brand-danger)" : pct >= 75 ? "var(--brand-warning)" : "var(--brand-success)";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-pill overflow-hidden" style={{ height: 6, background: "var(--brand-border)" }}>
        <div className="h-full rounded-pill transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[12px] tabular-nums shrink-0" style={{ color: "var(--brand-muted)", minWidth: 36 }}>
        {count}
      </span>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1200px] mx-auto pb-20 lg:pb-8">
      <div className="skeleton h-7 w-36 rounded mb-2" />
      <div className="skeleton h-4 w-64 rounded mb-8" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
      </div>
      <div className="skeleton h-20 rounded-xl mb-4" />
      <div className="skeleton h-48 rounded-xl" />
    </div>
  );
}

// ─── Cell Shepherd Overview ───────────────────────────────────────────────────

type CellStats = {
  totalMembers: number; activeMembers: number;
  inactiveMembers: number; occupiedSlots: number;
  totalShepherds: number; unoccupiedSlots: number;
};
type CellInfo = {
  name: string;
  buscentre: { name: string } | null;
  mc: { name: string } | null;
};
type ShepherdSummary = {
  id: string;
  user:   { name: string } | null;
  person: { firstName: string; lastName: string } | null;
  _count: { members: number };
};

type UnreachedFT = { id: string; firstName: string; lastName: string; phone: string | null; service: { date: string } };

function CellShepherdOverview() {
  const { data: session } = useSession();
  const { activeView } = useActiveRole();
  const [cell,         setCell]         = useState<CellInfo | null>(null);
  const [stats,        setStats]        = useState<CellStats | null>(null);
  const [shepherds,    setShepherds]    = useState<ShepherdSummary[]>([]);
  const [birthdays,    setBirthdays]    = useState<BirthdayEntry[]>([]);
  const [unreachedFTs,   setUnreachedFTs]   = useState<UnreachedFT[]>([]);
  const [missedServices, setMissedServices] = useState<{ date: string; type: string; label: string }[]>([]);
  const [loading,        setLoading]        = useState(true);

  const actingCellId = activeView?.isActing && activeView.cellId ? activeView.cellId : null;

  useEffect(() => {
    const params = actingCellId ? `?actingCellId=${actingCellId}` : "";
    const gapParam = actingCellId ? `?actingCellId=${actingCellId}` : "";
    Promise.all([
      fetch(`/api/cell/overview${params}`).then((r) => r.json()),
      fetch(`/api/first-timers?status=unreached&take=5${actingCellId ? `&actingCellId=${actingCellId}` : ""}`).then((r) => r.json()),
      fetch(`/api/attendance/gaps${gapParam}`).then((r) => r.json()),
    ])
      .then(([d, ft, gapData]) => {
        setCell(d.cell);
        setStats(d.stats);
        setShepherds(d.shepherds ?? []);
        setBirthdays(d.birthdays ?? []);
        setUnreachedFTs(ft.firstTimers ?? []);
        setMissedServices(gapData.gaps ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [actingCellId]);

  if (loading) return <PageSkeleton />;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1200px] mx-auto pb-20 lg:pb-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold" style={{ color: "var(--brand-text)" }}>
          Overview
        </h1>
        <p className="mt-1 text-[14px]" style={{ color: "var(--brand-muted)" }}>
          Welcome back,{" "}
          <span style={{ color: "var(--brand-navy)", fontWeight: 500 }}>
            {session?.user?.name ?? "—"}
          </span>.
        </p>
      </div>

      {/* ── Missed attendance banner — top priority ── */}
      {missedServices.length > 0 && (
        <Link href="/attendance">
          <div className="rounded-xl px-4 py-3 mb-4 flex items-center gap-3 hover:opacity-90 transition-opacity"
               style={{ background: "#FFFBEB", border: "1px solid #FCD34D" }}>
            <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: "#D97706" }} />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold" style={{ color: "#92400E" }}>
                {missedServices.length} missed service{missedServices.length !== 1 ? "s" : ""} — tap to fill
              </p>
              <p className="text-[12px]" style={{ color: "#B45309" }}>
                {missedServices.slice(0, 2).map((s) => s.label).join(" · ")}
                {missedServices.length > 2 ? ` · +${missedServices.length - 2} more` : ""}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "#D97706" }} />
          </div>
        </Link>
      )}

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <SummaryCard title="Total Members" value={stats.totalMembers}   icon={<Users className="h-4 w-4" />} />
          <SummaryCard title="Active"        value={stats.activeMembers}  subtitle={`${stats.totalMembers > 0 ? Math.round((stats.activeMembers / stats.totalMembers) * 100) : 0}% of total`} icon={<UserCheck className="h-4 w-4" />} />
          <SummaryCard title="Inactive"      value={stats.inactiveMembers} icon={<Users className="h-4 w-4" />} />
          <SummaryCard title="Shepherds"     value={`${stats.occupiedSlots}/${stats.totalShepherds}`} subtitle={stats.unoccupiedSlots > 0 ? `${stats.unoccupiedSlots} unassigned` : "All filled"} icon={<UserCircle className="h-4 w-4" />} />
        </div>
      )}

      {/* My Cell CTA */}
      <Link href="/cell">
        <div
          className="rounded-xl px-5 py-4 mb-4 flex items-center justify-between hover:opacity-95 transition-opacity cursor-pointer"
          style={{ background: "var(--brand-navy)", border: "1px solid var(--brand-navy)" }}
        >
          <div className="flex items-center gap-4">
            <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.1)" }}>
              <LayoutGrid className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-white">
                {cell?.name ?? "My Cell"}
              </p>
              <p className="text-[13px] mt-0.5" style={{ color: "rgba(255,255,255,0.65)" }}>
                {[cell?.buscentre?.name, cell?.mc?.name].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.8)" }}>
              Open My Cell
            </span>
            <ChevronRight className="h-4 w-4" style={{ color: "rgba(255,255,255,0.6)" }} />
          </div>
        </div>
      </Link>

      {/* Shepherd roster summary */}
      {shepherds.length > 0 && (
        <>
          <div className="flex items-center gap-3 my-5">
            <span className="text-[12px] font-medium uppercase tracking-[0.04em]" style={{ color: "var(--brand-muted)" }}>
              Your shepherds
            </span>
            <div className="flex-1 h-px" style={{ background: "var(--brand-border)" }} />
          </div>
          <div className="rounded-xl overflow-hidden mb-4" style={{ border: "1px solid var(--brand-border)" }}>
            {shepherds.map((s, i) => {
              const name = s.user?.name ?? (s.person ? `${s.person.firstName} ${s.person.lastName}` : null);
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--brand-navy-light)] transition-colors"
                  style={{ borderBottom: i < shepherds.length - 1 ? "1px solid var(--brand-border)" : "none" }}
                >
                  <div
                    className="rounded-lg flex items-center justify-center text-[12px] font-semibold shrink-0"
                    style={{ width: 32, height: 32, background: name ? "var(--brand-navy)" : "#F3F4F6", color: name ? "#fff" : "var(--brand-muted)" }}
                  >
                    {name ? name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() : `S${i + 1}`}
                  </div>
                  <span className="flex-1 text-[14px]" style={{ color: name ? "var(--brand-text)" : "var(--brand-muted)", fontStyle: name ? "normal" : "italic", fontWeight: name ? 500 : 400 }}>
                    {name ?? "Unassigned"}
                  </span>
                  <span className="text-[13px]" style={{ color: "var(--brand-muted)" }}>
                    {s._count.members}/5 members
                  </span>
                  {!s.user && s.person && (
                    <span className="rounded-pill text-[10px] font-medium px-2 py-0.5 ml-1"
                          style={{ background: "#FEF3DC", color: "#854F0B" }}>no login</span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Upcoming birthdays */}
      <BirthdaySection birthdays={birthdays} />

      {/* ── Unreached first timers ── */}
      {unreachedFTs.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
              <p className="text-[13px] font-semibold" style={{ color: "var(--brand-text)" }}>
                {unreachedFTs.length} first timer{unreachedFTs.length !== 1 ? "s" : ""} to reach out to
              </p>
            </div>
            <Link href="/first-timers" className="text-[12px] font-medium hover:underline"
                  style={{ color: "var(--brand-navy)" }}>
              View all →
            </Link>
          </div>
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--brand-border)" }}>
            {unreachedFTs.map((ft, i) => (
              <div key={ft.id} className="flex items-center gap-3 px-4 py-2.5"
                   style={{ borderBottom: i < unreachedFTs.length - 1 ? "1px solid var(--brand-border)" : "none" }}>
                <div className="flex items-center justify-center rounded-lg text-[11px] font-bold shrink-0"
                     style={{ width: 28, height: 28, background: "#FEF3DC", color: "#854F0B" }}>
                  {ft.firstName[0]}{ft.lastName[0]}
                </div>
                <span className="flex-1 text-[13px] font-medium" style={{ color: "var(--brand-text)" }}>
                  {ft.firstName} {ft.lastName}
                </span>
                {ft.phone && (
                  <a href={`tel:${ft.phone}`} className="text-[12px] font-medium hover:underline"
                     style={{ color: "var(--brand-navy)" }}>
                    {ft.phone}
                  </a>
                )}
              </div>
            ))}
          </div>
          <Link href="/first-timers">
            <div className="mt-2 rounded-xl px-4 py-2.5 text-center text-[13px] font-medium transition-colors hover:bg-[var(--brand-navy-light)]"
                 style={{ border: "1px solid var(--brand-border)", color: "var(--brand-navy)" }}>
              Open First Timers Focus →
            </div>
          </Link>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3 mt-4">
        <Link href="/cell">
          <Button variant="outline" className="h-9 text-[13px]" style={{ borderRadius: 8 }}>
            <LayoutGrid className="mr-2 h-4 w-4" /> My Cell
          </Button>
        </Link>
        <Link href="/members">
          <Button variant="outline" className="h-9 text-[13px]" style={{ borderRadius: 8 }}>
            <Users className="mr-2 h-4 w-4" /> All Members
          </Button>
        </Link>
        <Link href="/org/activate">
          <Button variant="outline" className="h-9 text-[13px]" style={{ borderRadius: 8 }}>
            <UserPlus className="mr-2 h-4 w-4" /> Activate Member
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ─── Buscentre Head Overview ──────────────────────────────────────────────────

type BCell = {
  id: string; name: string;
  _count: { members: number; shepherds: number };
  userRoles: { user: { name: string } }[];
  shepherds: { id: string; user: { name: string } | null; person: { firstName: string; lastName: string } | null; _count: { members: number } }[];
};

type BuscentreData = {
  buscentre: { id: string; name: string; location: string | null; mc: { name: string } | null; head: string | null };
  stats: {
    totalCells: number; totalMembers: number; activeMembers: number;
    inactiveMembers: number; systemUsers: number; totalShepherds: number;
    unoccupiedSlots: number; cellShepherdsAssigned: number;
    cellShepherdsUnassigned: number; newThisMonth: number; newThisYear: number;
  };
  cells: BCell[];
  recentMembers: { id: string; firstName: string; lastName: string; isActive: boolean; isUser: boolean; createdAt: string; cell: { name: string } | null }[];
  birthdays: BirthdayEntry[];
};

type CellGap = { cellId: string; cellName: string; cellShepherd: string | null; gapCount: number };

function BuscentreHeadOverview() {
  const { activeView } = useActiveRole();
  const [data,         setData]         = useState<BuscentreData | null>(null);
  const [unreachedFTs, setUnreachedFTs] = useState<UnreachedFT[]>([]);
  const [cellGaps,     setCellGaps]     = useState<CellGap[]>([]);

  const actingParam = activeView?.isActing && activeView.buscentreId
    ? `?actingBuscentreId=${activeView.buscentreId}`
    : "";

  useEffect(() => {
    const bcId    = actingParam ? actingParam.replace("?actingBuscentreId=", "") : null;
    const ftParam = bcId ? `?actingBuscentreId=${bcId}&status=unreached&take=5` : "?status=unreached&take=5";
    const gapParam = bcId ? `?actingBuscentreId=${bcId}` : "";
    Promise.all([
      fetch(`/api/buscentre/overview${actingParam}`).then((r) => r.json()),
      fetch(`/api/first-timers${ftParam}`).then((r) => r.json()),
      fetch(`/api/attendance/gaps${gapParam}`).then((r) => r.json()),
    ])
      .then(([d, ft, gapData]) => {
        setData(d);
        setUnreachedFTs(ft.firstTimers ?? []);
        setCellGaps(gapData.cells ?? []);
      })
      .catch(console.error);
  }, [actingParam]);

  if (!data) return <PageSkeleton />;

  const { buscentre, stats, cells, recentMembers, birthdays } = data;
  const activePct = stats.totalMembers > 0
    ? Math.round((stats.activeMembers / stats.totalMembers) * 100) : 0;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1200px] mx-auto pb-20 lg:pb-8">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold" style={{ color: "var(--brand-text)" }}>
          {buscentre.name}
        </h1>
        <p className="mt-0.5 text-[14px] flex items-center gap-1.5" style={{ color: "var(--brand-muted)" }}>
          {buscentre.mc?.name && <><MapPin className="h-3.5 w-3.5" /> {buscentre.mc.name}</>}
          {buscentre.location && <span> · {buscentre.location}</span>}
        </p>
      </div>

      {/* ── Cells with missed attendance — top priority ── */}
      {cellGaps.length > 0 && (
        <div className="rounded-xl overflow-hidden mb-5"
             style={{ border: "1px solid #FCD34D", background: "#FFFBEB" }}>
          <div className="flex items-center gap-2 px-4 py-3"
               style={{ borderBottom: "1px solid #FCD34D" }}>
            <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: "#D97706" }} />
            <span className="text-[13px] font-semibold" style={{ color: "#92400E" }}>
              {cellGaps.length} cell{cellGaps.length !== 1 ? "s" : ""} with missed attendance — follow up needed
            </span>
          </div>
          {cellGaps.map((cg, i) => (
            <div key={cg.cellId} className="flex items-center gap-3 px-4 py-2.5"
                 style={{ borderBottom: i < cellGaps.length - 1 ? "1px solid #FEF3DC" : "none" }}>
              <div className="flex-1 min-w-0">
                <span className="text-[13px] font-semibold" style={{ color: "#92400E" }}>
                  {cg.cellName}
                </span>
                {cg.cellShepherd && (
                  <span className="text-[12px] ml-2" style={{ color: "#B45309" }}>
                    · {cg.cellShepherd}
                  </span>
                )}
              </div>
              <span className="rounded-pill text-[11px] font-semibold px-2 py-0.5 shrink-0"
                    style={{ background: "#FEF3DC", color: "#854F0B" }}>
                {cg.gapCount} gap{cg.gapCount !== 1 ? "s" : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <SummaryCard title="Total Members"  value={stats.totalMembers}   icon={<Users className="h-4 w-4" />} />
        <SummaryCard title="Active"         value={stats.activeMembers}  icon={<UserCheck className="h-4 w-4" />} subtitle={`${activePct}% of total`} />
        <SummaryCard title="Cells"          value={stats.totalCells}     icon={<Home className="h-4 w-4" />} subtitle={`${stats.cellShepherdsUnassigned} without cell shepherd`} />
        <SummaryCard title="Unoccupied Slots" value={stats.unoccupiedSlots} icon={<UserCircle className="h-4 w-4" />} subtitle="Shepherd slots needing assignment" />
      </div>

      {/* Growth bar */}
      <div className="rounded-xl px-5 py-3.5 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-4"
           style={{ border: "1px solid var(--brand-border)" }}>
        {[
          { label: "New this month", value: stats.newThisMonth },
          { label: "New this year",  value: stats.newThisYear },
          { label: "Inactive",       value: stats.inactiveMembers },
          { label: "System users",   value: stats.systemUsers },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-[22px] font-semibold" style={{ color: "var(--brand-text)" }}>{value}</p>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--brand-muted)" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Birthdays */}
      <BirthdaySection birthdays={birthdays} />

      {/* Cell breakdown */}
      <SectionDivider label={`Cells (${stats.totalCells})`} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {cells.map((cell) => {
          const cellShepherd = cell.userRoles[0]?.user?.name;
          const occupiedSlots = cell.shepherds.filter((s) => s.user || s.person).length;
          return (
            <div key={cell.id} className="rounded-xl overflow-hidden"
                 style={{ border: "1px solid var(--brand-border)" }}>
              {/* Cell header */}
              <div className="px-4 py-3 flex items-center justify-between"
                   style={{ background: "#F9FAFB", borderBottom: "1px solid var(--brand-border)" }}>
                <div>
                  <p className="text-[14px] font-semibold" style={{ color: "var(--brand-text)" }}>{cell.name}</p>
                  <p className="text-[12px] mt-0.5" style={{ color: cellShepherd ? "var(--brand-muted)" : "var(--brand-warning)" }}>
                    {cellShepherd ?? "No cell shepherd assigned"}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[12px]" style={{ color: "var(--brand-muted)" }}>
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {cell._count.members}
                  </span>
                  <span className="flex items-center gap-1">
                    <UserCircle className="h-3.5 w-3.5" /> {occupiedSlots}/{cell._count.shepherds}
                  </span>
                </div>
              </div>

              {/* Shepherd list */}
              {cell.shepherds.length === 0 ? (
                <div className="px-4 py-3 text-[13px]" style={{ color: "var(--brand-muted)" }}>
                  No shepherd slots yet
                </div>
              ) : (
                cell.shepherds.map((s, i) => {
                  const name = s.user?.name ?? (s.person ? `${s.person.firstName} ${s.person.lastName}` : null);
                  return (
                    <div key={s.id} className="flex items-center gap-3 px-4 py-2.5"
                         style={{ borderBottom: i < cell.shepherds.length - 1 ? "1px solid var(--brand-border)" : "none" }}>
                      <div className="flex items-center justify-center rounded-lg text-[11px] font-semibold shrink-0"
                           style={{ width: 28, height: 28, background: name ? "var(--brand-navy)" : "#F3F4F6",
                                    color: name ? "#fff" : "var(--brand-muted)" }}>
                        {name ? name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() : "?"}
                      </div>
                      <span className="flex-1 text-[13px]"
                            style={{ color: name ? "var(--brand-text)" : "var(--brand-muted)", fontStyle: name ? "normal" : "italic" }}>
                        {name ?? "Unassigned"}
                      </span>
                      <span className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
                        {s._count.members}/5 members
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>

      {/* Recent members */}
      {recentMembers.length > 0 && (
        <>
          <SectionDivider label="Recently added" />
          <div className="rounded-xl overflow-hidden mb-4" style={{ border: "1px solid var(--brand-border)" }}>
            {recentMembers.map((m, i) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--brand-navy-light)] transition-colors"
                   style={{ borderBottom: i < recentMembers.length - 1 ? "1px solid var(--brand-border)" : "none" }}>
                <div className="flex items-center justify-center rounded-lg text-[12px] font-semibold shrink-0"
                     style={{ width: 32, height: 32, background: "var(--brand-navy)", color: "#fff" }}>
                  {m.firstName[0]}{m.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium" style={{ color: "var(--brand-text)" }}>
                    {m.firstName} {m.lastName}
                  </p>
                  <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>{m.cell?.name ?? "—"}</p>
                </div>
                <span className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
                  {timeAgo(m.createdAt)}
                </span>
              </div>
            ))}
            <Link href="/members">
              <div className="px-4 py-2.5 text-center text-[13px] font-medium hover:bg-[var(--brand-navy-light)] transition-colors"
                   style={{ color: "var(--brand-navy)", borderTop: "1px solid var(--brand-border)" }}>
                View all members →
              </div>
            </Link>
          </div>
        </>
      )}

      {/* ── Unreached first timers ── */}
      {unreachedFTs.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "#F59E0B" }} />
              <p className="text-[13px] font-semibold" style={{ color: "var(--brand-text)" }}>
                {unreachedFTs.length} first timer{unreachedFTs.length !== 1 ? "s" : ""} need a reach-out
              </p>
            </div>
            <Link href="/first-timers" className="text-[12px] font-medium hover:underline"
                  style={{ color: "var(--brand-navy)" }}>
              View all →
            </Link>
          </div>
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--brand-border)" }}>
            {unreachedFTs.map((ft, i) => (
              <div key={ft.id} className="flex items-center gap-3 px-4 py-2.5"
                   style={{ borderBottom: i < unreachedFTs.length - 1 ? "1px solid var(--brand-border)" : "none" }}>
                <div className="flex items-center justify-center rounded-lg text-[11px] font-bold shrink-0"
                     style={{ width: 28, height: 28, background: "#FEF3DC", color: "#854F0B" }}>
                  {ft.firstName[0]}{ft.lastName[0]}
                </div>
                <span className="flex-1 text-[13px] font-medium" style={{ color: "var(--brand-text)" }}>
                  {ft.firstName} {ft.lastName}
                </span>
                {ft.phone && (
                  <a href={`tel:${ft.phone}`} className="text-[12px] font-medium hover:underline"
                     style={{ color: "var(--brand-navy)" }}>
                    {ft.phone}
                  </a>
                )}
              </div>
            ))}
          </div>
          <Link href="/first-timers">
            <div className="mt-2 rounded-xl px-4 py-2.5 text-center text-[13px] font-medium transition-colors hover:bg-[var(--brand-navy-light)]"
                 style={{ border: "1px solid var(--brand-border)", color: "var(--brand-navy)" }}>
              Open First Timers Focus →
            </div>
          </Link>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3 mt-4">
        <Link href="/members">
          <Button variant="outline" className="h-9 text-[13px]" style={{ borderRadius: 8 }}>
            <Users className="mr-2 h-4 w-4" /> All Members
          </Button>
        </Link>
        <Link href="/org">
          <Button variant="outline" className="h-9 text-[13px]" style={{ borderRadius: 8 }}>
            <Network className="mr-2 h-4 w-4" /> Org Tree
          </Button>
        </Link>
        <Link href="/org/activate">
          <Button variant="outline" className="h-9 text-[13px]" style={{ borderRadius: 8 }}>
            <UserPlus className="mr-2 h-4 w-4" /> Activate Member
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const { data: session }    = useSession();
  const { activeView, ready } = useActiveRole();
  const [data, setData]      = useState<DashboardData | null>(null);

  // Use the ACTIVE role (may differ from primary if user has switched to an acting view)
  const role     = activeView?.role ?? session?.user?.role;
  const isScoped = role === "cell_shepherd" || role === "shepherd";
  const isBuscentreHead = role === "buscentre_head";

  // Always call hooks before any conditional returns
  useEffect(() => {
    if (!ready) return;          // wait for acting-roles fetch before routing
    if (isScoped || isBuscentreHead) return;
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
  }, [ready, isScoped, isBuscentreHead]);

  // Hold at skeleton until acting-roles have settled — prevents the wrong
  // role view flashing in before the correct one is confirmed
  if (!ready) return <PageSkeleton />;

  // Route scoped roles to their dedicated view
  if (isScoped) return <CellShepherdOverview />;
  if (isBuscentreHead) return <BuscentreHeadOverview />;

  if (!data) return <PageSkeleton />;

  const activePct = data.totalMembers > 0
    ? Math.round((data.activeMembers / data.totalMembers) * 100)
    : 0;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1200px] mx-auto pb-20 lg:pb-8">

      {/* ── Header ── */}
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold" style={{ color: "var(--brand-text)" }}>
          Overview
        </h1>
        <p className="mt-1 text-[14px]" style={{ color: "var(--brand-muted)" }}>
          Welcome back,{" "}
          <span style={{ color: "var(--brand-navy)", fontWeight: 500 }}>
            {session?.user?.name ?? "—"}
          </span>.
        </p>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <SummaryCard title="Total Members" value={data.totalMembers} icon={<Users className="h-4 w-4" />} />
        <SummaryCard title="Active"        value={data.activeMembers} subtitle={`${activePct}% of total`} icon={<UserCheck className="h-4 w-4" />} />
        <SummaryCard title="System Users"  value={data.systemUsers}   icon={<ShieldCheck className="h-4 w-4" />} />
        <SummaryCard title="Open Warnings" value={data.totalOpenWarnings} icon={<AlertTriangle className="h-4 w-4" />} />
      </div>

      {/* ── Org structure bar ── */}
      <div className="rounded-xl px-5 py-4 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-4"
           style={{ border: "1px solid var(--brand-border)" }}>
        {[
          { icon: Network,    label: "MegaChurches", value: data.totalMCs },
          { icon: Building2,  label: "Buscentres",   value: data.totalBuscentres },
          { icon: Home,       label: "Cells",        value: data.totalCells },
          { icon: UserCircle, label: "Shepherds",    value: data.totalShepherds },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-3">
            <div className="rounded-lg p-2" style={{ background: "var(--brand-navy-light)" }}>
              <Icon className="h-4 w-4" style={{ color: "var(--brand-navy)" }} />
            </div>
            <div>
              <p className="text-[20px] font-semibold leading-none" style={{ color: "var(--brand-text)" }}>
                {value}
              </p>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--brand-muted)" }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Alert banners ── */}
      {data.totalOpenWarnings > 0 && (
        <Link href="/org/warnings">
          <div className="rounded-xl px-5 py-3.5 mb-3 flex items-center justify-between hover:opacity-90 transition-opacity"
               style={{ background: "#FEF3DC", border: "1px solid #F5D9A0" }}>
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: "#854F0B" }} />
              <div>
                <p className="text-[14px] font-medium" style={{ color: "#854F0B" }}>
                  {data.totalOpenWarnings} open warning{data.totalOpenWarnings !== 1 ? "s" : ""}
                </p>
                <p className="text-[12px]" style={{ color: "#B87015" }}>
                  {data.openActingUpFlags > 0 && `${data.openActingUpFlags} acting-up`}
                  {data.openActingUpFlags > 0 && data.openCapacityWarnings > 0 && " · "}
                  {data.openCapacityWarnings > 0 && `${data.openCapacityWarnings} capacity`}
                  {" — review on the Org Health page"}
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "#854F0B" }} />
          </div>
        </Link>
      )}

      {data.unoccupiedShepherdSlots > 0 && (
        <Link href="/org">
          <div className="rounded-xl px-5 py-3.5 mb-3 flex items-center justify-between hover:opacity-90 transition-opacity"
               style={{ background: "var(--brand-navy-light)", border: "1px solid #C8D6EC" }}>
            <div className="flex items-center gap-3">
              <UserPlus className="h-4 w-4 shrink-0" style={{ color: "var(--brand-navy)" }} />
              <div>
                <p className="text-[14px] font-medium" style={{ color: "var(--brand-navy)" }}>
                  {data.unoccupiedShepherdSlots} shepherd slot{data.unoccupiedShepherdSlots !== 1 ? "s" : ""} without an assigned person
                </p>
                <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
                  Go to the Org tree to assign shepherds — no login required
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--brand-navy)" }} />
          </div>
        </Link>
      )}

      {data.inactiveMembers > 0 && (
        <Link href="/members">
          <div className="rounded-xl px-5 py-3.5 mb-3 flex items-center justify-between hover:opacity-90 transition-opacity"
               style={{ background: "#FDECEA", border: "1px solid #F5C0BC" }}>
            <div className="flex items-center gap-3">
              <Users className="h-4 w-4 shrink-0" style={{ color: "#791F1F" }} />
              <p className="text-[14px] font-medium" style={{ color: "#791F1F" }}>
                {data.inactiveMembers} inactive member{data.inactiveMembers !== 1 ? "s" : ""}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "#791F1F" }} />
          </div>
        </Link>
      )}

      {/* ── Upcoming birthdays ── */}
      {data.birthdays?.length > 0 && (
        <div className="mb-2">
          <BirthdaySection birthdays={data.birthdays} />
        </div>
      )}

      <SectionDivider label="Recently added" />

      {/* ── Recent members ── */}
      {data.recentMembers.length === 0 ? (
        <div className="rounded-xl p-10 text-center mb-4" style={{ border: "1px solid var(--brand-border)" }}>
          <Users style={{ width: 36, height: 36, color: "var(--brand-muted)", margin: "0 auto 10px" }} />
          <p className="text-[14px]" style={{ color: "var(--brand-muted)" }}>
            No members yet.
          </p>
          <Link href="/members" className="text-[13px] font-medium mt-2 inline-block hover:underline"
                style={{ color: "var(--brand-navy)" }}>
            Add your first member →
          </Link>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden mb-4" style={{ border: "1px solid var(--brand-border)" }}>
          {data.recentMembers.map((m, i) => (
            <Link key={m.id} href="/members">
              <div className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--brand-navy-light)] cursor-pointer"
                   style={{ borderBottom: i < data.recentMembers.length - 1 ? "1px solid var(--brand-border)" : "none" }}>
                <MemberAvatar firstName={m.firstName} lastName={m.lastName} />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium truncate" style={{ color: "var(--brand-text)" }}>
                    {m.firstName} {m.lastName}
                  </p>
                  <p className="text-[12px] truncate" style={{ color: "var(--brand-muted)" }}>
                    {memberLocation(m)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!m.isActive && (
                    <span className="rounded-pill text-[11px] font-medium px-2 py-0.5"
                          style={{ background: "#FDECEA", color: "#791F1F" }}>
                      Inactive
                    </span>
                  )}
                  {m.isUser && (
                    <span className="rounded-pill text-[11px] font-medium px-2 py-0.5"
                          style={{ background: "var(--brand-navy-light)", color: "var(--brand-navy)" }}>
                      System user
                    </span>
                  )}
                  <span className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
                    {timeAgo(m.createdAt)}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5" style={{ color: "var(--brand-muted)" }} />
                </div>
              </div>
            </Link>
          ))}
          <Link href="/members">
            <div className="px-4 py-2.5 text-center text-[13px] font-medium hover:bg-[var(--brand-navy-light)] transition-colors"
                 style={{ color: "var(--brand-navy)", borderTop: "1px solid var(--brand-border)" }}>
              View all members →
            </div>
          </Link>
        </div>
      )}

      <SectionDivider label="Cell overview" />

      {/* ── Top cells ── */}
      {data.topCells.length === 0 ? (
        <div className="rounded-xl p-10 text-center mb-4" style={{ border: "1px solid var(--brand-border)" }}>
          <Home style={{ width: 36, height: 36, color: "var(--brand-muted)", margin: "0 auto 10px" }} />
          <p className="text-[14px]" style={{ color: "var(--brand-muted)" }}>
            No cells yet.{" "}
            <Link href="/org" className="font-medium hover:underline" style={{ color: "var(--brand-navy)" }}>
              Build your org structure →
            </Link>
          </p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden mb-4" style={{ border: "1px solid var(--brand-border)" }}>
          {/* Header */}
          <div className="grid grid-cols-12 gap-3 px-4 py-2.5"
               style={{ background: "#F9FAFB", borderBottom: "1px solid var(--brand-border)" }}>
            {[
              { label: "Cell",          cols: "col-span-3" },
              { label: "Buscentre",     cols: "col-span-2" },
              { label: "Cell Shepherd", cols: "col-span-3" },
              { label: "Members",       cols: "col-span-2" },
              { label: "Shepherds",     cols: "col-span-2" },
            ].map(({ label, cols }) => (
              <span key={label} className={`${cols} text-[11px] font-medium uppercase tracking-[0.04em]`}
                    style={{ color: "var(--brand-muted)" }}>
                {label}
              </span>
            ))}
          </div>
          {data.topCells.map((cell, i) => (
            <Link key={cell.id} href="/org">
              <div className="grid grid-cols-12 gap-3 items-center px-4 py-3 hover:bg-[var(--brand-navy-light)] transition-colors cursor-pointer"
                   style={{ borderBottom: i < data.topCells.length - 1 ? "1px solid var(--brand-border)" : "none" }}>
                <span className="col-span-3 text-[14px] font-medium truncate" style={{ color: "var(--brand-text)" }}>
                  {cell.name}
                </span>
                <span className="col-span-2 text-[13px] truncate" style={{ color: "var(--brand-muted)" }}>
                  {cell.buscentre.name}
                </span>
                <span className="col-span-3 text-[13px] truncate">
                  {cell.userRoles[0]?.user?.name ? (
                    <span style={{ color: "var(--brand-text)" }}>{cell.userRoles[0].user.name}</span>
                  ) : (
                    <span className="rounded-pill text-[11px] font-medium px-2 py-0.5"
                          style={{ background: "#FEF3DC", color: "#854F0B" }}>
                      Unassigned
                    </span>
                  )}
                </span>
                <div className="col-span-2"><CapacityBar count={cell._count.members} max={10} /></div>
                <div className="col-span-2"><CapacityBar count={cell._count.shepherds} max={2} /></div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ── Shepherds section ── */}
      {data.topShepherds.length > 0 && (
        <>
          <SectionDivider label="Shepherds by member count" />
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--brand-border)" }}>
            {data.topShepherds.map((s, i) => {
              const name       = shepherdName(s);
              const isAssigned = !!name;
              const hasLogin   = !!s.user;

              return (
                <div
                  key={s.id}
                  className="flex items-center gap-4 px-4 py-3 transition-colors"
                  style={{ borderBottom: i < data.topShepherds.length - 1 ? "1px solid var(--brand-border)" : "none" }}
                >
                  {/* Rank */}
                  <span className="text-[13px] font-semibold tabular-nums w-5 text-center shrink-0"
                        style={{ color: "var(--brand-muted)" }}>
                    {i + 1}
                  </span>

                  {/* Avatar */}
                  {isAssigned ? (
                    <div className="flex items-center justify-center rounded-lg shrink-0 text-[12px] font-semibold"
                         style={{ width: 32, height: 32, background: "var(--brand-navy)", color: "#fff" }}>
                      {name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center rounded-lg shrink-0"
                         style={{ width: 32, height: 32, background: "#F3F4F6" }}>
                      <UserCircle className="h-4 w-4" style={{ color: "var(--brand-muted)" }} />
                    </div>
                  )}

                  {/* Name + badges + cell + capacity — all share the flexible column so
                      nothing competes with it for width on narrow screens */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[14px] font-medium"
                         style={{ color: isAssigned ? "var(--brand-text)" : "var(--brand-muted)", fontStyle: isAssigned ? "normal" : "italic" }}>
                        {isAssigned ? name : "Unassigned shepherd"}
                      </p>
                      {!isAssigned && (
                        <Link href="/org"
                              className="rounded-pill text-[11px] font-medium px-2 py-0.5 hover:opacity-80 transition-opacity"
                              style={{ background: "var(--brand-navy-light)", color: "var(--brand-navy)" }}
                              onClick={(e) => e.stopPropagation()}>
                          Assign →
                        </Link>
                      )}
                      {isAssigned && !hasLogin && (
                        <span className="rounded-pill text-[11px] font-medium px-2 py-0.5"
                              style={{ background: "#FEF3DC", color: "#854F0B" }}>
                          no login
                        </span>
                      )}
                      {hasLogin && (
                        <span className="rounded-pill text-[11px] font-medium px-2 py-0.5"
                              style={{ background: "var(--brand-navy-light)", color: "var(--brand-navy)" }}>
                          system user
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3 mt-1.5">
                      <p className="text-[12px] truncate" style={{ color: "var(--brand-muted)" }}>
                        {s.cell.name}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-16 sm:w-28">
                          <CapacityBar count={s._count.members} max={5} />
                        </div>
                        <span className="text-[12px] sm:text-[13px] tabular-nums w-8 sm:w-10 text-right"
                              style={{ color: "var(--brand-muted)" }}>
                          {s._count.members}/5
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Org health cards ── */}
      <SectionDivider label="Org health" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl p-4 flex items-start gap-3" style={{ border: "1px solid var(--brand-border)" }}>
          <div className="rounded-lg p-2 shrink-0"
               style={{ background: data.unoccupiedShepherdSlots > 0 ? "#FEF3DC" : "#E0F4EC" }}>
            <UserCircle className="h-4 w-4"
                        style={{ color: data.unoccupiedShepherdSlots > 0 ? "#854F0B" : "#085041" }} />
          </div>
          <div>
            <p className="text-[20px] font-semibold leading-none mb-0.5" style={{ color: "var(--brand-text)" }}>
              {data.unoccupiedShepherdSlots}
            </p>
            <p className="text-[12px] font-medium" style={{ color: "var(--brand-muted)" }}>
              Unoccupied shepherd slots
            </p>
            {data.unoccupiedShepherdSlots > 0 && (
              <Link href="/org"
                    className="text-[12px] font-medium mt-1 flex items-center gap-0.5 hover:underline"
                    style={{ color: "var(--brand-navy)" }}>
                Assign from org tree <ChevronRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>

        <div className="rounded-xl p-4 flex items-start gap-3" style={{ border: "1px solid var(--brand-border)" }}>
          <div className="rounded-lg p-2 shrink-0"
               style={{ background: data.inactiveMembers > 0 ? "#FDECEA" : "#E0F4EC" }}>
            <Users className="h-4 w-4"
                   style={{ color: data.inactiveMembers > 0 ? "#791F1F" : "#085041" }} />
          </div>
          <div>
            <p className="text-[20px] font-semibold leading-none mb-0.5" style={{ color: "var(--brand-text)" }}>
              {data.inactiveMembers}
            </p>
            <p className="text-[12px] font-medium" style={{ color: "var(--brand-muted)" }}>
              Inactive members
            </p>
            {data.inactiveMembers > 0 && (
              <Link href="/members"
                    className="text-[12px] font-medium mt-1 flex items-center gap-0.5 hover:underline"
                    style={{ color: "var(--brand-navy)" }}>
                View members <ChevronRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>

        <div className="rounded-xl p-4 flex items-start gap-3" style={{ border: "1px solid var(--brand-border)" }}>
          <div className="rounded-lg p-2 shrink-0"
               style={{ background: data.totalOpenWarnings > 0 ? "#FEF3DC" : "#E0F4EC" }}>
            <ShieldAlert className="h-4 w-4"
                         style={{ color: data.totalOpenWarnings > 0 ? "#854F0B" : "#085041" }} />
          </div>
          <div>
            <p className="text-[20px] font-semibold leading-none mb-0.5" style={{ color: "var(--brand-text)" }}>
              {data.totalOpenWarnings}
            </p>
            <p className="text-[12px] font-medium" style={{ color: "var(--brand-muted)" }}>
              Open org warnings
            </p>
            {data.totalOpenWarnings > 0 && (
              <Link href="/org/warnings"
                    className="text-[12px] font-medium mt-1 flex items-center gap-0.5 hover:underline"
                    style={{ color: "var(--brand-navy)" }}>
                View warnings <ChevronRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
