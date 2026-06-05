"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Users, UserCircle, AlertTriangle, LayoutList, Network } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ShepherdNode = {
  id:     string;
  user:   { name: string } | null;
  person: { firstName: string; lastName: string } | null;
  _count: { members: number };
};
type CellNode = {
  id: string; name: string; shepherds: ShepherdNode[];
  _count: { shepherds: number; members: number };
  userRoles: { user: { name: string } }[];
};
type BuscentreNode = {
  id: string; name: string; location: string | null; cells: CellNode[];
  _count: { cells: number }; userRoles: { user: { name: string } }[];
};
type MCNode = {
  id: string; name: string; buscentres: BuscentreNode[];
  _count: { buscentres: number }; userRoles: { user: { name: string } }[];
};
type BranchNode = { id: string; name: string; megaChurches: MCNode[] };
type Flag = { nodeId: string; severity: string };

// ─── Shared helpers ───────────────────────────────────────────────────────────

function shepherdName(s: ShepherdNode) {
  if (s.user)   return s.user.name;
  if (s.person) return `${s.person.firstName} ${s.person.lastName}`;
  return "Unassigned";
}

function ActingDot({ severity }: { severity: string }) {
  return (
    <AlertTriangle
      className="inline h-3 w-3 ml-1 align-middle shrink-0"
      style={{ color: severity === "red" ? "var(--brand-danger)" : "var(--brand-warning)" }}
    />
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TREE VIEW  (horizontal — desktop default)
// ══════════════════════════════════════════════════════════════════════════════

const TREE_CSS = `
.org-branch { display:flex; flex-direction:column; align-items:center; }
.org-connector { width:1px; background:#E5E7EB; flex-shrink:0; }
.org-row { display:flex; gap:0; }
.org-child { display:flex; flex-direction:column; align-items:center; padding:0 10px; position:relative; }
.org-child::before { content:''; position:absolute; top:0; right:50%; width:50%; height:1px; background:#E5E7EB; }
.org-child::after  { content:''; position:absolute; top:0; left:50%;  width:50%; height:1px; background:#E5E7EB; }
.org-child:first-child::before,
.org-child:only-child::before,
.org-child:only-child::after { display:none; }
.org-child:last-child::after  { display:none; }
`;

function Connector({ h = 24 }: { h?: number }) {
  return <div className="org-connector" style={{ height: h }} />;
}

function BranchCard({ name, count, expanded, onToggle }: { name: string; count: number; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-xl px-5 py-3 text-center cursor-pointer select-none hover:opacity-90 transition-opacity"
         style={{ background: "var(--brand-navy)", color: "#fff", minWidth: 160, boxShadow: "0 2px 8px rgba(15,31,61,.18)" }}
         onClick={onToggle}>
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] mb-1 opacity-60">Branch</p>
      <p className="text-[15px] font-semibold">{name}</p>
      <div className="flex items-center justify-center gap-1 mt-1.5">
        <p className="text-[10px] opacity-50">{count} MC{count !== 1 ? "s" : ""}</p>
        {count > 0 && <ChevronRight style={{ width: 10, height: 10, opacity: .6, transform: expanded ? "rotate(90deg)" : "none" }} />}
      </div>
    </div>
  );
}

function MCCard({ mc, flag, expanded, onToggle }: { mc: MCNode; flag?: Flag; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-xl px-4 py-3 text-center cursor-pointer select-none hover:opacity-90 transition-opacity"
         style={{ background: "#1A3260", color: "#fff", minWidth: 148, boxShadow: "0 2px 6px rgba(15,31,61,.15)" }}
         onClick={onToggle}>
      <p className="text-[10px] font-medium uppercase tracking-[0.07em] mb-1 opacity-50">MC</p>
      <p className="text-[14px] font-semibold">{mc.name}{flag && <ActingDot severity={flag.severity} />}</p>
      <p className="text-[11px] mt-0.5 opacity-70">{mc.userRoles[0]?.user?.name ?? "No pastor"}</p>
      <div className="flex items-center justify-center gap-1 mt-1.5">
        <p className="text-[10px] opacity-50">{mc._count.buscentres} buscentre{mc._count.buscentres !== 1 ? "s" : ""}</p>
        {mc.buscentres.length > 0 && <ChevronRight style={{ width: 10, height: 10, opacity: .6, transform: expanded ? "rotate(90deg)" : "none" }} />}
      </div>
    </div>
  );
}

function BuscentreCard({ bc, flag, expanded, onToggle }: { bc: BuscentreNode; flag?: Flag; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-xl px-4 py-3 text-center cursor-pointer select-none hover:shadow-sm transition-shadow"
         style={{ background: "#fff", border: "2px solid var(--brand-navy)", minWidth: 136 }}
         onClick={onToggle}>
      <p className="text-[10px] font-medium uppercase tracking-[0.07em] mb-1" style={{ color: "var(--brand-muted)" }}>Buscentre</p>
      <p className="text-[13px] font-semibold" style={{ color: "var(--brand-text)" }}>{bc.name}{flag && <ActingDot severity={flag.severity} />}</p>
      <p className="text-[11px] mt-0.5" style={{ color: "var(--brand-muted)" }}>{bc.userRoles[0]?.user?.name ?? "No head"}</p>
      <div className="flex items-center justify-center gap-1 mt-1.5">
        <p className="text-[10px]" style={{ color: "var(--brand-muted)" }}>{bc._count.cells} cell{bc._count.cells !== 1 ? "s" : ""}</p>
        {bc.cells.length > 0 && <ChevronRight style={{ width: 10, height: 10, color: "var(--brand-muted)", transform: expanded ? "rotate(90deg)" : "none" }} />}
      </div>
    </div>
  );
}

function CellCard({ cell, flag, open, onToggle }: { cell: CellNode; flag?: Flag; open: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-xl px-4 py-3 text-center cursor-pointer select-none hover:shadow-sm transition-shadow"
         style={{ background: "#fff", border: "1px solid #1A8C6C", borderLeft: "4px solid #1A8C6C", minWidth: 128 }}
         onClick={onToggle}>
      <p className="text-[10px] font-medium uppercase tracking-[0.07em] mb-1" style={{ color: "#1A8C6C" }}>Cell</p>
      <p className="text-[13px] font-semibold" style={{ color: "var(--brand-text)" }}>{cell.name}{flag && <ActingDot severity={flag.severity} />}</p>
      <p className="text-[11px] mt-0.5" style={{ color: "var(--brand-muted)" }}>{cell.userRoles[0]?.user?.name ?? "No shepherd"}</p>
      <div className="flex items-center justify-center gap-2 mt-1.5">
        <span className="flex items-center gap-0.5 text-[10px]" style={{ color: "var(--brand-muted)" }}><Users style={{ width: 10, height: 10 }} />{cell._count.members}</span>
        <span className="flex items-center gap-0.5 text-[10px]" style={{ color: "var(--brand-muted)" }}><UserCircle style={{ width: 10, height: 10 }} />{cell._count.shepherds}</span>
        {cell.shepherds.length > 0 && <ChevronRight style={{ width: 10, height: 10, color: "var(--brand-muted)", transform: open ? "rotate(90deg)" : "none" }} />}
      </div>
    </div>
  );
}

function ShepherdCard({ shepherd, flag }: { shepherd: ShepherdNode; flag?: Flag }) {
  const name = shepherdName(shepherd);
  const assigned = !!(shepherd.user || shepherd.person);
  return (
    <div className="rounded-xl px-3 py-2.5 text-center"
         style={{ background: "#FEF9EE", border: assigned ? "1px solid #B87015" : "1px dashed #D4B896", minWidth: 112 }}>
      <p className="text-[10px] font-medium uppercase tracking-[0.07em] mb-1" style={{ color: "#B87015" }}>Shepherd</p>
      <p className="text-[12px] font-medium" style={{ color: assigned ? "var(--brand-text)" : "var(--brand-muted)", fontStyle: assigned ? "normal" : "italic" }}>
        {name}{flag && <ActingDot severity={flag.severity} />}
      </p>
      {!shepherd.user && shepherd.person && <p className="text-[9px] mt-0.5" style={{ color: "#B87015" }}>no login</p>}
      <p className="text-[10px] mt-1" style={{ color: "var(--brand-muted)" }}>{shepherd._count.members}/5 members</p>
    </div>
  );
}

function TreeView({ branches, flags, expandedBranches, expandedMCs, expandedBuscentres, expandedCells, toggle, toggleBranch, toggleMC, toggleBuscentre, toggleCell }: {
  branches: BranchNode[]; flags: Flag[];
  expandedBranches: Set<string>; expandedMCs: Set<string>;
  expandedBuscentres: Set<string>; expandedCells: Set<string>;
  toggle: (set: Set<string>, setFn: (s: Set<string>) => void, id: string) => void;
  toggleBranch: (id: string) => void; toggleMC: (id: string) => void;
  toggleBuscentre: (id: string) => void; toggleCell: (id: string) => void;
}) {
  const flagMap = Object.fromEntries(flags.map((f) => [f.nodeId, f]));
  return (
    <>
      <style>{TREE_CSS}</style>
      <div className="overflow-x-auto pb-8">
        <div style={{ minWidth: "max-content", padding: "24px 40px" }}>
          {branches.map((branch) => (
            <div key={branch.id} className="org-branch" style={{ marginBottom: 48 }}>
              <BranchCard name={branch.name} count={branch.megaChurches.length}
                expanded={expandedBranches.has(branch.id)} onToggle={() => toggleBranch(branch.id)} />
              {expandedBranches.has(branch.id) && branch.megaChurches.length > 0 && (
                <div className="org-branch">
                  <Connector h={28} />
                  <div className="org-row">
                    {branch.megaChurches.map((mc) => (
                      <div key={mc.id} className="org-child">
                        <Connector h={28} />
                        <div className="org-branch">
                          <MCCard mc={mc} flag={flagMap[mc.id]} expanded={expandedMCs.has(mc.id)} onToggle={() => toggleMC(mc.id)} />
                          {expandedMCs.has(mc.id) && mc.buscentres.length > 0 && (
                            <div className="org-branch">
                              <Connector />
                              <div className="org-row">
                                {mc.buscentres.map((bc) => (
                                  <div key={bc.id} className="org-child">
                                    <Connector />
                                    <div className="org-branch">
                                      <BuscentreCard bc={bc} flag={flagMap[bc.id]} expanded={expandedBuscentres.has(bc.id)} onToggle={() => toggleBuscentre(bc.id)} />
                                      {expandedBuscentres.has(bc.id) && bc.cells.length > 0 && (
                                        <div className="org-branch">
                                          <Connector />
                                          <div className="org-row">
                                            {bc.cells.map((cell) => (
                                              <div key={cell.id} className="org-child">
                                                <Connector />
                                                <div className="org-branch">
                                                  <CellCard cell={cell} flag={flagMap[cell.id]} open={expandedCells.has(cell.id)} onToggle={() => toggleCell(cell.id)} />
                                                  {expandedCells.has(cell.id) && cell.shepherds.length > 0 && (
                                                    <div className="org-branch">
                                                      <Connector />
                                                      <div className="org-row">
                                                        {cell.shepherds.map((sh) => (
                                                          <div key={sh.id} className="org-child">
                                                            <Connector />
                                                            <ShepherdCard shepherd={sh} flag={flagMap[sh.id]} />
                                                          </div>
                                                        ))}
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LIST VIEW  (vertical accordion — mobile default)
// ══════════════════════════════════════════════════════════════════════════════

const LEVEL_CFG = {
  branch:    { label: "Branch",    color: "#0F1F3D", dark: true,  indent: 0 },
  mc:        { label: "MC",        color: "#1A3260", dark: true,  indent: 1 },
  buscentre: { label: "Buscentre", color: "var(--brand-navy)", dark: false, indent: 2 },
  cell:      { label: "Cell",      color: "#1A8C6C", dark: false, indent: 3 },
  shepherd:  { label: "Shepherd",  color: "#B87015", dark: false, indent: 4 },
};

function ListRow({ level, title, subtitle, meta, flag, expandable, expanded, onToggle, children }: {
  level: keyof typeof LEVEL_CFG; title: string; subtitle?: string | null;
  meta?: React.ReactNode; flag?: Flag; expandable: boolean;
  expanded: boolean; onToggle: () => void; children?: React.ReactNode;
}) {
  const cfg = LEVEL_CFG[level];
  return (
    <div>
      <button type="button" onClick={expandable ? onToggle : undefined}
              className="w-full flex items-center gap-3 text-left transition-opacity hover:opacity-90"
              style={{
                paddingLeft: 16 + cfg.indent * 16, paddingRight: 16,
                paddingTop: 12, paddingBottom: 12,
                background: cfg.dark ? cfg.color : "#fff",
                borderLeft: `4px solid ${cfg.color}`,
                borderBottom: "1px solid rgba(0,0,0,0.06)",
                cursor: expandable ? "pointer" : "default",
              }}>
        <span className="text-[9px] font-bold uppercase tracking-[0.08em] rounded px-1.5 py-0.5 shrink-0"
              style={{
                background: cfg.dark ? "rgba(255,255,255,0.15)" : `${cfg.color}18`,
                color:      cfg.dark ? "rgba(255,255,255,0.75)" : cfg.color,
              }}>
          {cfg.label}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-[14px] font-semibold truncate"
               style={{ color: cfg.dark ? "#fff" : "var(--brand-text)" }}>{title}</p>
            {flag && <ActingDot severity={flag.severity} />}
          </div>
          {subtitle && (
            <p className="text-[12px] truncate"
               style={{ color: cfg.dark ? "rgba(255,255,255,0.6)" : "var(--brand-muted)" }}>{subtitle}</p>
          )}
        </div>
        {meta && <div className="shrink-0" style={{ color: cfg.dark ? "rgba(255,255,255,0.5)" : "var(--brand-muted)" }}>{meta}</div>}
        {expandable && (
          <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200"
                        style={{ color: cfg.dark ? "rgba(255,255,255,0.5)" : "var(--brand-muted)", transform: expanded ? "rotate(90deg)" : "none" }} />
        )}
      </button>
      {expanded && children}
    </div>
  );
}

function ListView({ branches, flags, expandedBranches, expandedMCs, expandedBuscentres, expandedCells, toggleBranch, toggleMC, toggleBuscentre, toggleCell }: {
  branches: BranchNode[]; flags: Flag[];
  expandedBranches: Set<string>; expandedMCs: Set<string>;
  expandedBuscentres: Set<string>; expandedCells: Set<string>;
  toggleBranch: (id: string) => void; toggleMC: (id: string) => void;
  toggleBuscentre: (id: string) => void; toggleCell: (id: string) => void;
}) {
  const flagMap = Object.fromEntries(flags.map((f) => [f.nodeId, f]));
  return (
    <div className="rounded-xl overflow-hidden mx-4" style={{ border: "1px solid var(--brand-border)" }}>
      {branches.map((branch) => (
        <ListRow key={branch.id} level="branch" title={branch.name}
          subtitle={`${branch.megaChurches.length} MC${branch.megaChurches.length !== 1 ? "s" : ""}`}
          expandable={branch.megaChurches.length > 0}
          expanded={expandedBranches.has(branch.id)} onToggle={() => toggleBranch(branch.id)}>
          {branch.megaChurches.map((mc) => (
            <ListRow key={mc.id} level="mc" title={mc.name}
              subtitle={mc.userRoles[0]?.user?.name ?? "No pastor assigned"} flag={flagMap[mc.id]}
              meta={<span className="text-[11px]">{mc._count.buscentres} bc</span>}
              expandable={mc.buscentres.length > 0}
              expanded={expandedMCs.has(mc.id)} onToggle={() => toggleMC(mc.id)}>
              {mc.buscentres.map((bc) => (
                <ListRow key={bc.id} level="buscentre" title={bc.name}
                  subtitle={bc.userRoles[0]?.user?.name ?? "No head assigned"} flag={flagMap[bc.id]}
                  meta={<span className="text-[11px]">{bc._count.cells} cells</span>}
                  expandable={bc.cells.length > 0}
                  expanded={expandedBuscentres.has(bc.id)} onToggle={() => toggleBuscentre(bc.id)}>
                  {bc.cells.map((cell) => (
                    <ListRow key={cell.id} level="cell" title={cell.name}
                      subtitle={cell.userRoles[0]?.user?.name ?? "No cell shepherd"} flag={flagMap[cell.id]}
                      meta={
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="flex items-center gap-0.5"><Users className="h-3 w-3" />{cell._count.members}</span>
                          <span className="flex items-center gap-0.5"><UserCircle className="h-3 w-3" />{cell._count.shepherds}</span>
                        </div>
                      }
                      expandable={cell.shepherds.length > 0}
                      expanded={expandedCells.has(cell.id)} onToggle={() => toggleCell(cell.id)}>
                      {cell.shepherds.map((sh) => (
                        <ListRow key={sh.id} level="shepherd" title={shepherdName(sh)}
                          subtitle={!sh.user && sh.person ? "No system login" : !sh.user && !sh.person ? "Slot unassigned" : undefined}
                          flag={flagMap[sh.id]}
                          meta={<span className="text-[11px]">{sh._count.members}/5</span>}
                          expandable={false} expanded={false} onToggle={() => {}} />
                      ))}
                    </ListRow>
                  ))}
                </ListRow>
              ))}
            </ListRow>
          ))}
        </ListRow>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════════════════════════

export default function OrgChartPage() {
  const [branches,           setBranches]           = useState<BranchNode[]>([]);
  const [flags,              setFlags]              = useState<Flag[]>([]);
  const [loading,            setLoading]            = useState(true);
  const [view,               setView]               = useState<"tree" | "list">("list");
  const [expandedBranches,   setExpandedBranches]   = useState<Set<string>>(new Set());
  const [expandedMCs,        setExpandedMCs]        = useState<Set<string>>(new Set());
  const [expandedBuscentres, setExpandedBuscentres] = useState<Set<string>>(new Set());
  const [expandedCells,      setExpandedCells]      = useState<Set<string>>(new Set());

  // Default view based on screen size
  useEffect(() => {
    setView(window.innerWidth >= 1024 ? "tree" : "list");
  }, []);

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
  const toggleBranch    = (id: string) => toggle(expandedBranches,   setExpandedBranches,   id);
  const toggleMC        = (id: string) => toggle(expandedMCs,        setExpandedMCs,        id);
  const toggleBuscentre = (id: string) => toggle(expandedBuscentres, setExpandedBuscentres, id);
  const toggleCell      = (id: string) => toggle(expandedCells,      setExpandedCells,      id);

  function expandAll() {
    const b = new Set<string>(), m = new Set<string>(), bc = new Set<string>(), c = new Set<string>();
    branches.forEach((branch) => { b.add(branch.id);
      branch.megaChurches.forEach((mc) => { m.add(mc.id);
        mc.buscentres.forEach((buscentre) => { bc.add(buscentre.id);
          buscentre.cells.forEach((cell) => { if (cell.shepherds.length) c.add(cell.id); });
        });
      });
    });
    setExpandedBranches(b); setExpandedMCs(m); setExpandedBuscentres(bc); setExpandedCells(c);
  }
  function collapseAll() {
    setExpandedMCs(new Set()); setExpandedBuscentres(new Set()); setExpandedCells(new Set());
  }

  const sharedProps = { branches, flags, expandedBranches, expandedMCs, expandedBuscentres, expandedCells, toggleBranch, toggleMC, toggleBuscentre, toggleCell };

  return (
    <div className="pb-20 lg:pb-8">
      {/* Header */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 max-w-[900px] mx-auto">
        <Link href="/org" className="flex items-center gap-1.5 text-[13px] mb-3 w-fit hover:underline"
              style={{ color: "var(--brand-muted)" }}>
          <ArrowLeft className="h-3.5 w-3.5" /> Org tree
        </Link>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h1 className="text-[22px] font-semibold" style={{ color: "var(--brand-text)" }}>Organogram</h1>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--brand-border)" }}>
              <button
                onClick={() => setView("tree")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium transition-colors"
                style={{ background: view === "tree" ? "var(--brand-navy)" : "#fff",
                         color:      view === "tree" ? "#fff" : "var(--brand-muted)" }}>
                <Network className="h-3.5 w-3.5" /> Tree
              </button>
              <button
                onClick={() => setView("list")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium transition-colors"
                style={{ background: view === "list" ? "var(--brand-navy)" : "#fff",
                         color:      view === "list" ? "#fff" : "var(--brand-muted)",
                         borderLeft: "1px solid var(--brand-border)" }}>
                <LayoutList className="h-3.5 w-3.5" /> List
              </button>
            </div>

            <button onClick={expandAll} className="text-[12px] font-medium px-3 py-1.5 rounded-lg"
                    style={{ background: "var(--brand-navy)", color: "#fff" }}>
              Expand all
            </button>
            <button onClick={collapseAll} className="text-[12px] font-medium px-3 py-1.5 rounded-lg"
                    style={{ border: "1px solid var(--brand-border)", color: "var(--brand-muted)" }}>
              Collapse
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
          {([
            { color: "#0F1F3D", label: "Branch" },
            { color: "#1A3260", label: "MC" },
            { color: "var(--brand-navy)", label: "Buscentre", outline: true },
            { color: "#1A8C6C", label: "Cell" },
            { color: "#B87015", label: "Shepherd" },
          ] as const).map(({ color, label, outline }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="rounded-sm shrink-0"
                   style={{ width: 10, height: 10, background: outline ? "#fff" : color,
                            border: outline ? `2px solid ${color}` : "none" }} />
              <span className="text-[11px]" style={{ color: "var(--brand-muted)" }}>{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3" style={{ color: "var(--brand-warning)" }} />
            <span className="text-[11px]" style={{ color: "var(--brand-muted)" }}>Acting-up</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div className="flex justify-center py-20 text-[14px]" style={{ color: "var(--brand-muted)" }}>Loading…</div>
      ) : branches.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3">
          <p className="text-[14px]" style={{ color: "var(--brand-muted)" }}>No org structure yet.</p>
          <Link href="/org" className="text-[13px] font-medium hover:underline" style={{ color: "var(--brand-navy)" }}>
            Build it from the Org tree →
          </Link>
        </div>
      ) : view === "tree" ? (
        <TreeView {...sharedProps} toggle={toggle} />
      ) : (
        <ListView {...sharedProps} />
      )}
    </div>
  );
}
