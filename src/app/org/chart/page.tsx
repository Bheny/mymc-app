"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Users, UserCircle, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shepherdLabel(s: ShepherdNode): string {
  if (s.user)   return s.user.name;
  if (s.person) return `${s.person.firstName} ${s.person.lastName}`;
  return "Unassigned";
}

// ─── Node cards ───────────────────────────────────────────────────────────────

function ActingUpDot({ severity }: { severity: string }) {
  return (
    <span
      className="inline-block rounded-full ml-1"
      style={{
        width: 7, height: 7,
        background: severity === "red" ? "var(--brand-danger)" : "var(--brand-warning)",
        verticalAlign: "middle",
      }}
      title={`Acting-up (${severity})`}
    />
  );
}

function BranchCard({
  name, mcCount, expanded, onToggle,
}: {
  name: string; mcCount: number; expanded: boolean; onToggle: () => void;
}) {
  return (
    <div
      className="rounded-xl px-5 py-3 text-center cursor-pointer select-none transition-opacity hover:opacity-90"
      style={{ background: "var(--brand-navy)", color: "#fff", minWidth: 160, boxShadow: "0 2px 8px rgba(15,31,61,0.18)" }}
      onClick={onToggle}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] mb-1 opacity-60">Branch</p>
      <p className="text-[15px] font-semibold">{name}</p>
      <div className="flex items-center justify-center gap-1.5 mt-1.5">
        <p className="text-[10px] opacity-50">
          {mcCount} MC{mcCount !== 1 ? "s" : ""}
        </p>
        {mcCount > 0 && (
          expanded
            ? <ChevronDown  style={{ width: 10, height: 10, opacity: 0.6 }} />
            : <ChevronRight style={{ width: 10, height: 10, opacity: 0.6 }} />
        )}
      </div>
    </div>
  );
}

function MCCard({
  mc, flag, expanded, onToggle,
}: {
  mc: MCNode; flag?: Flag; expanded: boolean; onToggle: () => void;
}) {
  const pastor = mc.userRoles[0]?.user?.name;
  return (
    <div
      className="rounded-xl px-4 py-3 text-center cursor-pointer select-none transition-opacity hover:opacity-90"
      style={{
        background: "#1A3260",
        color:      "#fff",
        minWidth:   148,
        boxShadow:  "0 2px 6px rgba(15,31,61,0.15)",
      }}
      onClick={onToggle}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.07em] mb-1 opacity-50">MC</p>
      <p className="text-[14px] font-semibold">{mc.name}{flag && <ActingUpDot severity={flag.severity} />}</p>
      <p className="text-[11px] mt-0.5 opacity-70">{pastor ?? "No pastor"}</p>
      <div className="flex items-center justify-center gap-1.5 mt-1.5">
        <p className="text-[10px] opacity-50">
          {mc._count.buscentres} buscentre{mc._count.buscentres !== 1 ? "s" : ""}
        </p>
        {mc.buscentres.length > 0 && (
          expanded
            ? <ChevronDown  style={{ width: 10, height: 10, opacity: 0.6 }} />
            : <ChevronRight style={{ width: 10, height: 10, opacity: 0.6 }} />
        )}
      </div>
    </div>
  );
}

function BuscentreCard({
  bc, flag, expanded, onToggle,
}: {
  bc: BuscentreNode; flag?: Flag; expanded: boolean; onToggle: () => void;
}) {
  const head = bc.userRoles[0]?.user?.name;
  return (
    <div
      className="rounded-xl px-4 py-3 text-center cursor-pointer select-none hover:shadow-sm transition-shadow"
      style={{ background: "#fff", border: "2px solid var(--brand-navy)", minWidth: 136 }}
      onClick={onToggle}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.07em] mb-1"
         style={{ color: "var(--brand-muted)" }}>Buscentre</p>
      <p className="text-[13px] font-semibold" style={{ color: "var(--brand-text)" }}>
        {bc.name}{flag && <ActingUpDot severity={flag.severity} />}
      </p>
      <p className="text-[11px] mt-0.5" style={{ color: "var(--brand-muted)" }}>{head ?? "No head"}</p>
      <div className="flex items-center justify-center gap-1.5 mt-1.5">
        <p className="text-[10px]" style={{ color: "var(--brand-muted)" }}>
          {bc._count.cells} cell{bc._count.cells !== 1 ? "s" : ""}
        </p>
        {bc.cells.length > 0 && (
          expanded
            ? <ChevronDown  style={{ width: 10, height: 10, color: "var(--brand-muted)" }} />
            : <ChevronRight style={{ width: 10, height: 10, color: "var(--brand-muted)" }} />
        )}
      </div>
    </div>
  );
}

function CellCard({
  cell, flag, showShepherds, onToggle,
}: {
  cell:          CellNode;
  flag?:         Flag;
  showShepherds: boolean;
  onToggle:      () => void;
}) {
  const cellShepherd = cell.userRoles[0]?.user?.name;
  return (
    <div
      className="rounded-xl px-4 py-3 text-center cursor-pointer select-none hover:shadow-sm transition-shadow"
      style={{
        background:  "#fff",
        border:      "1px solid #1A8C6C",
        borderLeft:  "4px solid #1A8C6C",
        minWidth:    128,
      }}
      onClick={onToggle}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.07em] mb-1"
         style={{ color: "#1A8C6C" }}>Cell</p>
      <p className="text-[13px] font-semibold" style={{ color: "var(--brand-text)" }}>
        {cell.name}{flag && <ActingUpDot severity={flag.severity} />}
      </p>
      <p className="text-[11px] mt-0.5" style={{ color: "var(--brand-muted)" }}>
        {cellShepherd ?? "No cell shepherd"}
      </p>
      <div className="flex items-center justify-center gap-2 mt-1.5">
        <span className="flex items-center gap-0.5 text-[10px]" style={{ color: "var(--brand-muted)" }}>
          <Users style={{ width: 10, height: 10 }} /> {cell._count.members}
        </span>
        <span className="flex items-center gap-0.5 text-[10px]" style={{ color: "var(--brand-muted)" }}>
          <UserCircle style={{ width: 10, height: 10 }} /> {cell._count.shepherds}
        </span>
        {cell.shepherds.length > 0 && (
          showShepherds
            ? <ChevronDown style={{ width: 10, height: 10, color: "var(--brand-muted)" }} />
            : <ChevronRight style={{ width: 10, height: 10, color: "var(--brand-muted)" }} />
        )}
      </div>
    </div>
  );
}

function ShepherdCard({ shepherd, flag }: { shepherd: ShepherdNode; flag?: Flag }) {
  const name = shepherdLabel(shepherd);
  const isAssigned = shepherd.user || shepherd.person;
  return (
    <div
      className="rounded-xl px-3 py-2.5 text-center"
      style={{
        background:  "#FEF9EE",
        border:      isAssigned ? "1px solid #B87015" : "1px dashed #D4B896",
        minWidth:    112,
      }}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.07em] mb-1"
         style={{ color: "#B87015" }}>Shepherd</p>
      <p className="text-[12px] font-medium" style={{ color: isAssigned ? "var(--brand-text)" : "var(--brand-muted)", fontStyle: isAssigned ? "normal" : "italic" }}>
        {name}{flag && <ActingUpDot severity={flag.severity} />}
      </p>
      {!shepherd.user && shepherd.person && (
        <p className="text-[9px] mt-0.5" style={{ color: "#B87015" }}>no login</p>
      )}
      <p className="text-[10px] mt-1" style={{ color: "var(--brand-muted)" }}>
        {shepherd._count.members}/5 members
      </p>
    </div>
  );
}

// ─── Connector styles ─────────────────────────────────────────────────────────

const CSS = `
.org-branch { display:flex; flex-direction:column; align-items:center; }
.org-connector { width:1px; background:#E5E7EB; flex-shrink:0; }
.org-row { display:flex; gap:0; }
.org-child { display:flex; flex-direction:column; align-items:center; padding:0 10px; position:relative; }
.org-child::before {
  content:''; position:absolute; top:0; right:50%;
  width:50%; height:1px; background:#E5E7EB;
}
.org-child::after {
  content:''; position:absolute; top:0; left:50%;
  width:50%; height:1px; background:#E5E7EB;
}
.org-child:first-child::before { display:none; }
.org-child:last-child::after   { display:none; }
.org-child:only-child::before,
.org-child:only-child::after   { display:none; }
`;

// ─── Tree components ──────────────────────────────────────────────────────────

function Connector({ height = 24 }: { height?: number }) {
  return <div className="org-connector" style={{ height }} />;
}

function ShepherdLevel({ shepherds, flags }: { shepherds: ShepherdNode[]; flags: Flag[] }) {
  if (shepherds.length === 0) return null;
  const flagMap = Object.fromEntries(flags.map((f) => [f.nodeId, f]));

  return (
    <div className="org-branch">
      <Connector />
      <div className="org-row">
        {shepherds.map((sh) => (
          <div key={sh.id} className="org-child">
            <Connector />
            <ShepherdCard shepherd={sh} flag={flagMap[sh.id]} />
          </div>
        ))}
      </div>
    </div>
  );
}

function CellLevel({
  cells, flags, expandedCells, toggleCell,
}: {
  cells:         CellNode[];
  flags:         Flag[];
  expandedCells: Set<string>;
  toggleCell:    (id: string) => void;
}) {
  const flagMap = Object.fromEntries(flags.map((f) => [f.nodeId, f]));
  return (
    <div className="org-branch">
      <Connector />
      <div className="org-row">
        {cells.map((cell) => (
          <div key={cell.id} className="org-child">
            <Connector />
            <div className="org-branch">
              <CellCard
                cell={cell}
                flag={flagMap[cell.id]}
                showShepherds={expandedCells.has(cell.id)}
                onToggle={() => toggleCell(cell.id)}
              />
              {expandedCells.has(cell.id) && (
                <ShepherdLevel shepherds={cell.shepherds} flags={flags} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BuscentreLevel({
  buscentres, flags, expandedBuscentres, toggleBuscentre, expandedCells, toggleCell,
}: {
  buscentres:         BuscentreNode[];
  flags:              Flag[];
  expandedBuscentres: Set<string>;
  toggleBuscentre:    (id: string) => void;
  expandedCells:      Set<string>;
  toggleCell:         (id: string) => void;
}) {
  const flagMap = Object.fromEntries(flags.map((f) => [f.nodeId, f]));
  return (
    <div className="org-branch">
      <Connector />
      <div className="org-row">
        {buscentres.map((bc) => (
          <div key={bc.id} className="org-child">
            <Connector />
            <div className="org-branch">
              <BuscentreCard
                bc={bc}
                flag={flagMap[bc.id]}
                expanded={expandedBuscentres.has(bc.id)}
                onToggle={() => toggleBuscentre(bc.id)}
              />
              {expandedBuscentres.has(bc.id) && bc.cells.length > 0 && (
                <CellLevel
                  cells={bc.cells}
                  flags={flags}
                  expandedCells={expandedCells}
                  toggleCell={toggleCell}
                />
              )}
            </div>
          </div>
        ))}
      </div>
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
        // Default: branches open so you can see the MC list
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
    const allBranches   = new Set<string>();
    const allMCs        = new Set<string>();
    const allBuscentres = new Set<string>();
    const allCells      = new Set<string>();
    branches.forEach((b) => {
      allBranches.add(b.id);
      b.megaChurches.forEach((mc) => {
        allMCs.add(mc.id);
        mc.buscentres.forEach((bc) => {
          allBuscentres.add(bc.id);
          bc.cells.forEach((c) => c.shepherds.length > 0 && allCells.add(c.id));
        });
      });
    });
    setExpandedBranches(allBranches);
    setExpandedMCs(allMCs);
    setExpandedBuscentres(allBuscentres);
    setExpandedCells(allCells);
  }

  function collapseAll() {
    // Keep branches open so you don't lose the top level
    setExpandedMCs(new Set());
    setExpandedBuscentres(new Set());
    setExpandedCells(new Set());
  }

  const hasExpandable = branches.some((b) => b.megaChurches.length > 0);

  return (
    <>
      <style>{CSS}</style>

      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-none pb-20 lg:pb-8">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6 max-w-[1200px] mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/org"
                  className="flex items-center gap-1.5 text-[13px] font-medium hover:underline"
                  style={{ color: "var(--brand-muted)" }}>
              <ArrowLeft className="h-3.5 w-3.5" /> Org tree
            </Link>
            <span style={{ color: "var(--brand-border)" }}>·</span>
            <h1 className="text-[20px] font-semibold" style={{ color: "var(--brand-text)" }}>
              Organogram
            </h1>
          </div>

          {hasExpandable && (
            <div className="flex items-center gap-2">
              <button onClick={expandAll}
                      className="text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors"
                      style={{ background: "var(--brand-navy-light)", color: "var(--brand-navy)" }}>
                Expand all
              </button>
              <button onClick={collapseAll}
                      className="text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors"
                      style={{ border: "1px solid var(--brand-border)", color: "var(--brand-muted)" }}>
                Collapse
              </button>
            </div>
          )}
        </div>

        {/* ── Legend ── */}
        <div className="max-w-[1200px] mx-auto mb-6 flex items-center gap-4 flex-wrap">
          {[
            { color: "var(--brand-navy)",  label: "Branch" },
            { color: "#1A3260",            label: "MegaChurch" },
            { color: "var(--brand-navy)",  label: "Buscentre",  outline: true },
            { color: "#1A8C6C",            label: "Cell" },
            { color: "#B87015",            label: "Shepherd" },
          ].map(({ color, label, outline }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="rounded"
                   style={{
                     width: 12, height: 12,
                     background: outline ? "#fff" : color,
                     border:     outline ? `2px solid ${color}` : "none",
                   }}
              />
              <span className="text-[12px]" style={{ color: "var(--brand-muted)" }}>{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 ml-2">
            <AlertTriangle className="h-3 w-3" style={{ color: "var(--brand-warning)" }} />
            <span className="text-[12px]" style={{ color: "var(--brand-muted)" }}>Acting-up flag</span>
          </div>
          <p className="text-[12px] ml-auto" style={{ color: "var(--brand-muted)" }}>
            Click any node to expand or collapse its children
          </p>
        </div>

        {/* ── Chart ── */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-[14px]" style={{ color: "var(--brand-muted)" }}>Loading chart…</div>
          </div>
        ) : branches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <p className="text-[14px]" style={{ color: "var(--brand-muted)" }}>
              No org structure yet.
            </p>
            <Link href="/org" className="text-[13px] font-medium hover:underline"
                  style={{ color: "var(--brand-navy)" }}>
              Build it from the Org tree →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto pb-8">
            <div style={{ minWidth: "max-content", padding: "24px 40px" }}>
              {branches.map((branch) => (
                <div key={branch.id} className="org-branch" style={{ marginBottom: 48 }}>

                  {/* Branch */}
                  <BranchCard
                    name={branch.name}
                    mcCount={branch.megaChurches.length}
                    expanded={expandedBranches.has(branch.id)}
                    onToggle={() => toggleBranch(branch.id)}
                  />

                  {/* MegaChurches — only when branch is expanded */}
                  {expandedBranches.has(branch.id) && branch.megaChurches.length > 0 && (
                    <div className="org-branch">
                      <Connector height={28} />
                      <div className="org-row">
                        {branch.megaChurches.map((mc) => {
                          const mcFlag   = flags.find((f) => f.nodeId === mc.id);
                          const mcOpen   = expandedMCs.has(mc.id);
                          return (
                            <div key={mc.id} className="org-child">
                              <Connector height={28} />
                              <div className="org-branch">
                                <MCCard
                                  mc={mc}
                                  flag={mcFlag}
                                  expanded={mcOpen}
                                  onToggle={() => toggleMC(mc.id)}
                                />

                                {/* Buscentres — only shown when MC is expanded */}
                                {mcOpen && mc.buscentres.length > 0 && (
                                  <BuscentreLevel
                                    buscentres={mc.buscentres}
                                    flags={flags}
                                    expandedBuscentres={expandedBuscentres}
                                    toggleBuscentre={toggleBuscentre}
                                    expandedCells={expandedCells}
                                    toggleCell={toggleCell}
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
