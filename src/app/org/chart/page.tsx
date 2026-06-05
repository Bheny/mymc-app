"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Users, UserCircle, AlertTriangle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ShepherdNode = {
  id:     string;
  user:   { name: string } | null;
  person: { firstName: string; lastName: string } | null;
  _count: { members: number };
};

type CellNode = {
  id:        string;
  name:      string;
  shepherds: ShepherdNode[];
  _count:    { shepherds: number; members: number };
  userRoles: { user: { name: string } }[];
};

type BuscentreNode = {
  id:        string;
  name:      string;
  location:  string | null;
  cells:     CellNode[];
  _count:    { cells: number };
  userRoles: { user: { name: string } }[];
};

type MCNode = {
  id:         string;
  name:       string;
  buscentres: BuscentreNode[];
  _count:     { buscentres: number };
  userRoles:  { user: { name: string } }[];
};

type BranchNode = {
  id:           string;
  name:         string;
  megaChurches: MCNode[];
};

type Flag = { nodeId: string; severity: string };

// ─── Level config ─────────────────────────────────────────────────────────────

const LEVEL = {
  branch:    { label: "Branch",      color: "#0F1F3D", bg: "#0F1F3D",   text: "#fff",     indent: 0  },
  mc:        { label: "MC",          color: "#1A3260", bg: "#1A3260",   text: "#fff",     indent: 1  },
  buscentre: { label: "Buscentre",   color: "var(--brand-navy)", bg: "#fff", text: "var(--brand-navy)", indent: 2 },
  cell:      { label: "Cell",        color: "#1A8C6C", bg: "#fff",      text: "var(--brand-text)", indent: 3 },
  shepherd:  { label: "Shepherd",    color: "#B87015", bg: "#FFFBEB",   text: "var(--brand-text)", indent: 4 },
};

function shepherdName(s: ShepherdNode): string {
  if (s.user)   return s.user.name;
  if (s.person) return `${s.person.firstName} ${s.person.lastName}`;
  return "Unassigned";
}

// ─── TreeRow ──────────────────────────────────────────────────────────────────

function TreeRow({
  level, title, subtitle, meta, flag,
  expandable, expanded, onToggle, children,
}: {
  level:      keyof typeof LEVEL;
  title:      string;
  subtitle?:  string | null;
  meta?:      React.ReactNode;
  flag?:      Flag;
  expandable: boolean;
  expanded:   boolean;
  onToggle:   () => void;
  children?:  React.ReactNode;
}) {
  const cfg    = LEVEL[level];
  const indent = cfg.indent * 16;
  const isDark = level === "branch" || level === "mc";

  return (
    <div>
      <button
        type="button"
        onClick={expandable ? onToggle : undefined}
        className="w-full flex items-center gap-3 text-left transition-opacity hover:opacity-90 active:opacity-75"
        style={{
          paddingLeft:   16 + indent,
          paddingRight:  16,
          paddingTop:    12,
          paddingBottom: 12,
          background:    isDark ? cfg.color : cfg.bg,
          borderLeft:    `4px solid ${cfg.color}`,
          borderBottom:  "1px solid rgba(0,0,0,0.06)",
          cursor:        expandable ? "pointer" : "default",
        }}
      >
        {/* Level tag */}
        <span
          className="text-[9px] font-bold uppercase tracking-[0.08em] rounded px-1.5 py-0.5 shrink-0"
          style={{
            background: isDark ? "rgba(255,255,255,0.15)" : `${cfg.color}18`,
            color:      isDark ? "rgba(255,255,255,0.75)" : cfg.color,
          }}
        >
          {cfg.label}
        </span>

        {/* Name + subtitle */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[14px] font-semibold truncate"
               style={{ color: isDark ? "#fff" : "var(--brand-text)" }}>
              {title}
            </p>
            {flag && (
              <AlertTriangle
                className="h-3 w-3 shrink-0"
                style={{ color: flag.severity === "red" ? "var(--brand-danger)" : "var(--brand-warning)" }}
              />
            )}
          </div>
          {subtitle && (
            <p className="text-[12px] truncate"
               style={{ color: isDark ? "rgba(255,255,255,0.6)" : "var(--brand-muted)" }}>
              {subtitle}
            </p>
          )}
        </div>

        {/* Meta counts */}
        {meta && (
          <div className="shrink-0 text-right"
               style={{ color: isDark ? "rgba(255,255,255,0.5)" : "var(--brand-muted)" }}>
            {meta}
          </div>
        )}

        {/* Expand chevron */}
        {expandable && (
          <ChevronRight
            className="h-4 w-4 shrink-0 transition-transform duration-200"
            style={{
              color:     isDark ? "rgba(255,255,255,0.5)" : "var(--brand-muted)",
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            }}
          />
        )}
      </button>

      {/* Children */}
      {expanded && children && (
        <div>{children}</div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrgChartPage() {
  const [branches,           setBranches]           = useState<BranchNode[]>([]);
  const [flags,              setFlags]              = useState<Flag[]>([]);
  const [loading,            setLoading]            = useState(true);
  const [expandedBranches,   setExpandedBranches]   = useState<Set<string>>(new Set());
  const [expandedMCs,        setExpandedMCs]        = useState<Set<string>>(new Set());
  const [expandedBuscentres, setExpandedBuscentres] = useState<Set<string>>(new Set());
  const [expandedCells,      setExpandedCells]      = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/org/tree")
      .then((r) => r.json())
      .then((d) => {
        const data: BranchNode[] = d.branches ?? [];
        setBranches(data);
        setFlags(d.actingUpFlags ?? []);
        setExpandedBranches(new Set(data.map((b) => b.id)));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function toggle(set: Set<string>, setFn: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    setFn(next);
  }

  function expandAll() {
    const b = new Set<string>(), m = new Set<string>(),
          bc = new Set<string>(), c = new Set<string>();
    branches.forEach((branch) => {
      b.add(branch.id);
      branch.megaChurches.forEach((mc) => {
        m.add(mc.id);
        mc.buscentres.forEach((buscentre) => {
          bc.add(buscentre.id);
          buscentre.cells.forEach((cell) => { if (cell.shepherds.length) c.add(cell.id); });
        });
      });
    });
    setExpandedBranches(b); setExpandedMCs(m);
    setExpandedBuscentres(bc); setExpandedCells(c);
  }

  function collapseAll() {
    setExpandedMCs(new Set());
    setExpandedBuscentres(new Set());
    setExpandedCells(new Set());
  }

  const flagMap = Object.fromEntries(flags.map((f) => [f.nodeId, f]));

  return (
    <div className="pb-20 lg:pb-8">

      {/* ── Header ── */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 max-w-[800px] mx-auto">
        <Link href="/org"
              className="flex items-center gap-1.5 text-[13px] mb-3 w-fit hover:underline"
              style={{ color: "var(--brand-muted)" }}>
          <ArrowLeft className="h-3.5 w-3.5" /> Org tree
        </Link>

        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[22px] font-semibold" style={{ color: "var(--brand-text)" }}>
            Organogram
          </h1>
          <div className="flex items-center gap-2">
            <button onClick={expandAll}
                    className="text-[12px] font-medium px-3 py-1.5 rounded-lg"
                    style={{ background: "var(--brand-navy)", color: "#fff" }}>
              Expand all
            </button>
            <button onClick={collapseAll}
                    className="text-[12px] font-medium px-3 py-1.5 rounded-lg"
                    style={{ border: "1px solid var(--brand-border)", color: "var(--brand-muted)" }}>
              Collapse
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
          {(Object.entries(LEVEL) as [keyof typeof LEVEL, typeof LEVEL[keyof typeof LEVEL]][]).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className="rounded-sm shrink-0"
                   style={{
                     width: 10, height: 10,
                     background: key === "buscentre" ? "#fff" : cfg.color,
                     border: key === "buscentre" ? `2px solid ${cfg.color}` : "none",
                   }} />
              <span className="text-[11px]" style={{ color: "var(--brand-muted)" }}>{cfg.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3" style={{ color: "var(--brand-warning)" }} />
            <span className="text-[11px]" style={{ color: "var(--brand-muted)" }}>Acting-up</span>
          </div>
        </div>
      </div>

      {/* ── Tree ── */}
      {loading ? (
        <div className="flex justify-center py-20 text-[14px]" style={{ color: "var(--brand-muted)" }}>
          Loading…
        </div>
      ) : branches.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3">
          <p className="text-[14px]" style={{ color: "var(--brand-muted)" }}>No org structure yet.</p>
          <Link href="/org" className="text-[13px] font-medium hover:underline"
                style={{ color: "var(--brand-navy)" }}>
            Build it from the Org tree →
          </Link>
        </div>
      ) : (
        <div className="max-w-[800px] mx-auto rounded-xl overflow-hidden"
             style={{ border: "1px solid var(--brand-border)", marginLeft: "max(0px, calc(50% - 400px))", marginRight: "max(0px, calc(50% - 400px))", margin: "0 16px" }}>
          {branches.map((branch) => (
            <TreeRow
              key={branch.id}
              level="branch"
              title={branch.name}
              subtitle={`${branch.megaChurches.length} MC${branch.megaChurches.length !== 1 ? "s" : ""}`}
              expandable={branch.megaChurches.length > 0}
              expanded={expandedBranches.has(branch.id)}
              onToggle={() => toggle(expandedBranches, setExpandedBranches, branch.id)}
            >
              {branch.megaChurches.map((mc) => (
                <TreeRow
                  key={mc.id}
                  level="mc"
                  title={mc.name}
                  subtitle={mc.userRoles[0]?.user?.name ?? "No pastor assigned"}
                  flag={flagMap[mc.id]}
                  meta={<span className="text-[11px]">{mc._count.buscentres} buscentre{mc._count.buscentres !== 1 ? "s" : ""}</span>}
                  expandable={mc.buscentres.length > 0}
                  expanded={expandedMCs.has(mc.id)}
                  onToggle={() => toggle(expandedMCs, setExpandedMCs, mc.id)}
                >
                  {mc.buscentres.map((bc) => (
                    <TreeRow
                      key={bc.id}
                      level="buscentre"
                      title={bc.name}
                      subtitle={bc.userRoles[0]?.user?.name ?? "No head assigned"}
                      flag={flagMap[bc.id]}
                      meta={<span className="text-[11px]">{bc._count.cells} cell{bc._count.cells !== 1 ? "s" : ""}</span>}
                      expandable={bc.cells.length > 0}
                      expanded={expandedBuscentres.has(bc.id)}
                      onToggle={() => toggle(expandedBuscentres, setExpandedBuscentres, bc.id)}
                    >
                      {bc.cells.map((cell) => (
                        <TreeRow
                          key={cell.id}
                          level="cell"
                          title={cell.name}
                          subtitle={cell.userRoles[0]?.user?.name ?? "No cell shepherd"}
                          flag={flagMap[cell.id]}
                          meta={
                            <div className="flex items-center gap-2 text-[11px]">
                              <span className="flex items-center gap-0.5">
                                <Users className="h-3 w-3" /> {cell._count.members}
                              </span>
                              <span className="flex items-center gap-0.5">
                                <UserCircle className="h-3 w-3" /> {cell._count.shepherds}
                              </span>
                            </div>
                          }
                          expandable={cell.shepherds.length > 0}
                          expanded={expandedCells.has(cell.id)}
                          onToggle={() => toggle(expandedCells, setExpandedCells, cell.id)}
                        >
                          {cell.shepherds.map((sh) => (
                            <TreeRow
                              key={sh.id}
                              level="shepherd"
                              title={shepherdName(sh)}
                              subtitle={
                                !sh.user && sh.person ? "No system login" :
                                !sh.user && !sh.person ? "Slot unassigned" : undefined
                              }
                              flag={flagMap[sh.id]}
                              meta={<span className="text-[11px]">{sh._count.members}/5 members</span>}
                              expandable={false}
                              expanded={false}
                              onToggle={() => {}}
                            />
                          ))}
                        </TreeRow>
                      ))}
                    </TreeRow>
                  ))}
                </TreeRow>
              ))}
            </TreeRow>
          ))}
        </div>
      )}
    </div>
  );
}
