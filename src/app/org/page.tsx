"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Plus, AlertTriangle, Users, Network, Pencil, UserPlus } from "lucide-react";
import { AssignHeadSheet, type AssignHeadSheetProps } from "@/components/assign-head-sheet";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
  SheetBody, SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";

// ─── Types ────────────────────────────────────────────────────────────────────

type ShepherdNode = {
  id:     string;
  user:   { id: string; name: string } | null;
  person: { id: string; firstName: string; lastName: string } | null;
  _count: { members: number };
};

function shepherdDisplayName(sh: ShepherdNode): string {
  if (sh.user)   return sh.user.name;
  if (sh.person) return `${sh.person.firstName} ${sh.person.lastName}`;
  return "Unassigned";
}

type CellNode = {
  id: string;
  name: string;
  shepherds: ShepherdNode[];
  _count: { shepherds: number; members: number };
  userRoles: { user: { id: string; name: string } }[];
};

type BuscentreNode = {
  id: string;
  name: string;
  location: string | null;
  cells: CellNode[];
  _count: { cells: number };
  userRoles: { user: { id: string; name: string } }[];
};

type MCNode = {
  id: string;
  name: string;
  buscentres: BuscentreNode[];
  _count: { buscentres: number };
  userRoles: { user: { id: string; name: string } }[];
};

type BranchNode = {
  id: string;
  name: string;
  megaChurches: MCNode[];
};

type Flag  = { nodeId: string; severity: string; actingAs: string };
type Warn  = { parentId: string; level: string; currentCount: number; maxCount: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CAPACITY: Record<string, number> = { buscentre: 4, cell: 4, shepherd: 2, member: 5 };

function capacityColor(count: number, max: number) {
  const ratio = count / max;
  if (ratio >= 1)    return { bg: "#FDECEA", color: "#791F1F", label: `${count}/${max}` };
  if (ratio >= 0.75) return { bg: "#FEF3DC", color: "#854F0B", label: `${count}/${max}` };
  return               { bg: "#E0F4EC",  color: "#085041", label: `${count}/${max}` };
}

function CapacityBadge({ count, max }: { count: number; max: number }) {
  const { bg, color, label } = capacityColor(count, max);
  return (
    <span className="rounded-pill text-[11px] font-medium px-2 py-0.5" style={{ background: bg, color }}>
      {label}
    </span>
  );
}

function ActingUpBadge({ severity }: { severity: string }) {
  const isRed = severity === "red";
  return (
    <span
      className="flex items-center gap-1 rounded-pill text-[11px] font-medium px-2 py-0.5"
      style={{ background: isRed ? "#FDECEA" : "#FEF3DC", color: isRed ? "#791F1F" : "#854F0B" }}
    >
      <AlertTriangle style={{ width: 10, height: 10 }} />
      Acting up
    </span>
  );
}

function AssignedTo({ name }: { name?: string | null }) {
  if (!name) return <span style={{ color: "var(--brand-muted)", fontSize: 12 }}>Unassigned</span>;
  return <span style={{ color: "var(--brand-muted)", fontSize: 12 }}>{name}</span>;
}

// ─── Collapsible row ──────────────────────────────────────────────────────────

function TreeRow({
  label, assigned, badges, depth = 0, children, defaultOpen = false,
}: {
  label:       string;
  assigned?:   string | null;
  badges?:     React.ReactNode;
  depth?:      number;
  children?:   React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasChildren = !!children;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-2.5 pr-3 cursor-pointer select-none hover:bg-[var(--brand-navy-light)] transition-colors rounded-lg"
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={() => hasChildren && setOpen((o) => !o)}
      >
        {hasChildren
          ? open
            ? <ChevronDown style={{ width: 14, height: 14, color: "var(--brand-muted)", flexShrink: 0 }} />
            : <ChevronRight style={{ width: 14, height: 14, color: "var(--brand-muted)", flexShrink: 0 }} />
          : <span style={{ width: 14, flexShrink: 0 }} />
        }
        <span className="text-[13px] font-medium flex-1 min-w-0 truncate" style={{ color: "var(--brand-text)" }}>
          {label}
        </span>
        {assigned !== undefined && (
          <span className="hidden sm:block shrink-0" style={{ color: "var(--brand-muted)", fontSize: 12 }}>
            {assigned ?? "Unassigned"}
          </span>
        )}
        <div className="flex flex-wrap items-center gap-1 shrink-0">{badges}</div>
      </div>
      {open && children && <div>{children}</div>}
    </div>
  );
}

// ─── Add-node inline form ─────────────────────────────────────────────────────

function AddNodeRow({
  label, onAdd,
}: {
  label: string;
  onAdd: (name: string) => Promise<void>;
}) {
  const [open, setOpen]   = useState(false);
  const [name, setName]   = useState("");
  const [busy, setBusy]   = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    await onAdd(name.trim());
    setName("");
    setBusy(false);
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-[12px] font-medium py-1.5 px-3 rounded-lg transition-colors"
        style={{ color: "var(--brand-navy)", marginLeft: 14 }}
      >
        <Plus style={{ width: 12, height: 12 }} /> {label}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 py-1.5 px-3">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name..."
        className="h-8 px-3 text-[13px] rounded-lg flex-1 min-w-0"
        style={{ border: "1px solid var(--brand-border)", outline: "none" }}
      />
      <Button type="submit" disabled={busy} className="h-8 text-[12px] px-3 shrink-0"
        style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}>
        {busy ? "…" : "Add"}
      </Button>
      <button type="button" onClick={() => setOpen(false)}
        className="h-8 px-2 text-[12px] shrink-0" style={{ color: "var(--brand-muted)" }}>
        Cancel
      </button>
    </form>
  );
}

// ─── Edit MC dialog ───────────────────────────────────────────────────────────

type EditingMC = { id: string; name: string; currentPastorId?: string };
type UserOption = { id: string; name: string | null; email: string; role: { role: string } | null };

function EditMCDialog({
  mc,
  onClose,
  onSaved,
}: {
  mc: EditingMC | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name,        setName]       = useState("");
  const [pastorId,    setPastorId]   = useState<string>("");
  const [users,       setUsers]      = useState<UserOption[]>([]);
  const [loadingUsers,setLoadingUsers] = useState(false);
  const [busy,        setBusy]       = useState(false);
  const [error,       setError]      = useState("");

  // Reset and load users whenever the dialog opens
  useEffect(() => {
    if (!mc) return;
    setName(mc.name);
    setPastorId(mc.currentPastorId ?? "");
    setError("");
    setLoadingUsers(true);
    fetch("/api/org/users?eligible=mc_pastor")
      .then((r) => r.json())
      .then((data) => { setUsers(data); setLoadingUsers(false); })
      .catch(() => setLoadingUsers(false));
  }, [mc]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required."); return; }
    setBusy(true);

    const res = await fetch(`/api/org/mega-churches/${mc!.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        // Send null to unassign, a user ID to assign, or omit if unchanged
        assignedPastorUserId: pastorId === "" ? null : pastorId,
      }),
    });

    setBusy(false);
    if (res.ok) { onSaved(); onClose(); }
    else { const d = await res.json(); setError(d.error ?? "Save failed."); }
  }

  return (
    <Sheet open={!!mc} onOpenChange={(o) => !o && onClose()}>
      <SheetContent width={440}>
        <SheetHeader>
          <SheetTitle>Edit MegaChurch</SheetTitle>
        </SheetHeader>

        <SheetBody>
          <form id="edit-mc-form" onSubmit={handleSave} className="flex flex-col gap-4">
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium uppercase tracking-[0.04em]"
                     style={{ color: "var(--brand-muted)" }}>
                Name <span style={{ color: "var(--brand-danger)" }}>*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. DUNAMIS MC"
                className="h-10 text-[14px]"
                style={{ borderColor: "var(--brand-border)" }}
                autoFocus
              />
            </div>

            {/* Assigned Pastor */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium uppercase tracking-[0.04em]"
                     style={{ color: "var(--brand-muted)" }}>
                Assigned Pastor
              </label>
              <select
                value={pastorId}
                onChange={(e) => setPastorId(e.target.value)}
                disabled={loadingUsers}
                className="h-10 px-3 text-[14px] rounded-lg disabled:opacity-40"
                style={{ border: "1px solid var(--brand-border)", color: "var(--brand-text)", background: "#fff" }}
              >
                <option value="">— None / Unassign —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name ?? u.email}
                    {u.role ? ` (${u.role.role.replace(/_/g, " ")})` : ""}
                  </option>
                ))}
              </select>
              {loadingUsers && (
                <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>Loading users…</p>
              )}
            </div>

            {error && (
              <p className="text-[13px]" style={{ color: "var(--brand-danger)" }}>{error}</p>
            )}
          </form>
        </SheetBody>

        <SheetFooter>
          <Button type="button" variant="outline" onClick={onClose}
                  className="h-9 text-[13px]" style={{ borderRadius: 8 }}>
            Cancel
          </Button>
          <Button type="submit" form="edit-mc-form" disabled={busy}
                  className="h-9 text-[13px]"
                  style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Shepherd row with inline quick-assign ────────────────────────────────────

type MemberOption = { id: string; firstName: string; lastName: string };

function ShepherdRow({
  shepherd, onAssigned,
}: {
  shepherd:   ShepherdNode;
  onAssigned: () => void;
}) {
  const isAssigned   = !!(shepherd.user || shepherd.person);
  const displayName  = shepherdDisplayName(shepherd);
  const hasLogin     = !!shepherd.user;

  const [assigning,   setAssigning]   = useState(false);
  const [query,       setQuery]        = useState("");
  const [results,     setResults]      = useState<MemberOption[]>([]);
  const [saving,      setSaving]       = useState(false);
  const [error,       setError]        = useState("");

  // Debounced member search
  useEffect(() => {
    if (!assigning || query.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/org/members?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.slice(0, 8));
    }, 300);
    return () => clearTimeout(t);
  }, [query, assigning]);

  async function handleAssign(memberId: string) {
    setSaving(true); setError("");
    const res = await fetch(`/api/org/shepherds/${shepherd.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ memberId }),
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

  async function handleUnassign() {
    setSaving(true);
    await fetch(`/api/org/shepherds/${shepherd.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ memberId: null }),
    });
    setSaving(false);
    onAssigned();
  }

  return (
    <div>
      {/* ── Shepherd row ── */}
      <div
        className="flex items-center gap-2 py-2.5 pr-3 rounded-lg"
        style={{ paddingLeft: 8 + 3 * 16 }}
      >
        <span style={{ width: 14, flexShrink: 0 }} />

        {/* Name + status */}
        <span className="text-[14px] flex-1" style={{
          color:      isAssigned ? "var(--brand-text)" : "var(--brand-muted)",
          fontStyle:  isAssigned ? "normal" : "italic",
          fontWeight: hasLogin ? 500 : 400,
        }}>
          {displayName}
          {shepherd.person && !shepherd.user && (
            <span className="ml-1.5 text-[11px] font-medium rounded-pill px-1.5 py-0.5"
                  style={{ background: "#FEF3DC", color: "#854F0B" }}>
              no login
            </span>
          )}
          {shepherd.user && (
            <span className="ml-1.5 text-[11px] font-medium rounded-pill px-1.5 py-0.5"
                  style={{ background: "var(--brand-navy-light)", color: "var(--brand-navy)" }}>
              system user
            </span>
          )}
        </span>

        {/* Capacity badge */}
        <CapacityBadge count={shepherd._count.members} max={5} />

        {/* Action buttons */}
        {!assigning && !shepherd.user && (
          isAssigned ? (
            <button
              onClick={handleUnassign}
              disabled={saving}
              className="text-[11px] font-medium px-2 py-0.5 rounded-lg hover:opacity-80 transition-opacity"
              style={{ color: "var(--brand-danger)" }}
              title="Unassign shepherd"
            >
              {saving ? "…" : "Unassign"}
            </button>
          ) : (
            <button
              onClick={() => setAssigning(true)}
              className="flex items-center gap-1 text-[12px] font-medium px-2 py-0.5 rounded-lg transition-colors"
              style={{ color: "var(--brand-navy)", background: "var(--brand-navy-light)" }}
            >
              Assign
            </button>
          )
        )}
      </div>

      {/* ── Inline assign form ── */}
      {assigning && (
        <div
          className="mb-2 mx-3 rounded-xl p-4 flex flex-col gap-3"
          style={{
            border: "1px solid var(--brand-border)",
            background: "var(--brand-navy-light)",
          }}
        >
          <p className="text-[12px] font-medium" style={{ color: "var(--brand-navy)" }}>
            Search for a member to assign as shepherd:
          </p>
          <div className="relative">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a name…"
              className="w-full h-9 px-3 text-[13px] rounded-lg"
              style={{ border: "1px solid var(--brand-border)", outline: "none", background: "#fff" }}
            />
          </div>

          {results.length > 0 && (
            <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--brand-border)" }}>
              {results.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={saving}
                  onClick={() => handleAssign(m.id)}
                  className="w-full text-left px-3 py-2 text-[13px] hover:bg-white transition-colors"
                  style={{
                    borderBottom: "1px solid var(--brand-border)",
                    color: "var(--brand-text)",
                  }}
                >
                  {m.firstName} {m.lastName}
                </button>
              ))}
            </div>
          )}

          {query.length >= 2 && results.length === 0 && (
            <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
              No members found for &ldquo;{query}&rdquo;
            </p>
          )}

          {error && (
            <p className="text-[12px]" style={{ color: "var(--brand-danger)" }}>{error}</p>
          )}

          <button
            type="button"
            onClick={() => { setAssigning(false); setQuery(""); setResults([]); setError(""); }}
            className="text-[12px] self-start"
            style={{ color: "var(--brand-muted)" }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Edit Buscentre sheet ─────────────────────────────────────────────────────

type EditingBuscentre = { id: string; name: string; location: string | null };

function EditBuscentreSheet({
  bc, onClose, onSaved,
}: {
  bc: EditingBuscentre | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name,     setName]     = useState("");
  const [location, setLocation] = useState("");
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState("");

  useEffect(() => {
    if (!bc) return;
    setName(bc.name);
    setLocation(bc.location ?? "");
    setError("");
  }, [bc]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required."); return; }
    setBusy(true);
    const res = await fetch(`/api/org/buscentres/${bc!.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), location: location || null }),
    });
    setBusy(false);
    if (res.ok) { onSaved(); onClose(); }
    else { const d = await res.json(); setError(d.error ?? "Save failed."); }
  }

  return (
    <Sheet open={!!bc} onOpenChange={(o) => !o && onClose()}>
      <SheetContent width={420}>
        <SheetHeader>
          <SheetTitle>Edit Buscentre</SheetTitle>
        </SheetHeader>
        <SheetBody>
          <form id="edit-bc-form" onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium uppercase tracking-[0.04em]"
                     style={{ color: "var(--brand-muted)" }}>
                Name <span style={{ color: "var(--brand-danger)" }}>*</span>
              </label>
              <Input value={name} onChange={(e) => setName(e.target.value)}
                     placeholder="e.g. Agape" className="h-10 text-[14px]"
                     style={{ borderColor: "var(--brand-border)" }} autoFocus />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium uppercase tracking-[0.04em]"
                     style={{ color: "var(--brand-muted)" }}>Location</label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)}
                     placeholder="e.g. East Legon" className="h-10 text-[14px]"
                     style={{ borderColor: "var(--brand-border)" }} />
            </div>
            {error && <p className="text-[13px]" style={{ color: "var(--brand-danger)" }}>{error}</p>}
          </form>
        </SheetBody>
        <SheetFooter>
          <Button type="button" variant="outline" onClick={onClose}
                  className="h-9 text-[13px]" style={{ borderRadius: 8 }}>Cancel</Button>
          <Button type="submit" form="edit-bc-form" disabled={busy}
                  className="h-9 text-[13px]"
                  style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Edit Cell sheet ──────────────────────────────────────────────────────────

type EditingCell = { id: string; name: string; location?: string | null };

function EditCellSheet({
  cell, onClose, onSaved,
}: {
  cell: EditingCell | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name,     setName]     = useState("");
  const [location, setLocation] = useState("");
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState("");

  useEffect(() => {
    if (!cell) return;
    setName(cell.name);
    setLocation(cell.location ?? "");
    setError("");
  }, [cell]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required."); return; }
    setBusy(true);
    const res = await fetch(`/api/org/cells/${cell!.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), location: location || null }),
    });
    setBusy(false);
    if (res.ok) { onSaved(); onClose(); }
    else { const d = await res.json(); setError(d.error ?? "Save failed."); }
  }

  return (
    <Sheet open={!!cell} onOpenChange={(o) => !o && onClose()}>
      <SheetContent width={400}>
        <SheetHeader>
          <SheetTitle>Edit Cell</SheetTitle>
        </SheetHeader>
        <SheetBody>
          <form id="edit-cell-form" onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium uppercase tracking-[0.04em]"
                     style={{ color: "var(--brand-muted)" }}>
                Name <span style={{ color: "var(--brand-danger)" }}>*</span>
              </label>
              <Input value={name} onChange={(e) => setName(e.target.value)}
                     placeholder="e.g. Power Cell" className="h-10 text-[14px]"
                     style={{ borderColor: "var(--brand-border)" }} autoFocus />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium uppercase tracking-[0.04em]"
                     style={{ color: "var(--brand-muted)" }}>Location</label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)}
                     placeholder="e.g. Achimota" className="h-10 text-[14px]"
                     style={{ borderColor: "var(--brand-border)" }} />
            </div>
            {error && <p className="text-[13px]" style={{ color: "var(--brand-danger)" }}>{error}</p>}
          </form>
        </SheetBody>
        <SheetFooter>
          <Button type="button" variant="outline" onClick={onClose}
                  className="h-9 text-[13px]" style={{ borderRadius: 8 }}>Cancel</Button>
          <Button type="submit" form="edit-cell-form" disabled={busy}
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

export default function OrgPage() {
  const [branches, setBranches]       = useState<BranchNode[]>([]);
  const [flags, setFlags]             = useState<Flag[]>([]);
  const [warnings, setWarnings]       = useState<Warn[]>([]);
  const [loading, setLoading]         = useState(true);
  const [openWarnings, setOpenWarnings] = useState(0);
  const [editingMC,         setEditingMC]         = useState<EditingMC | null>(null);
  const [editingBuscentre,  setEditingBuscentre]  = useState<EditingBuscentre | null>(null);
  const [editingCell,       setEditingCell]        = useState<EditingCell | null>(null);
  const [assigningHead, setAssigningHead] = useState<Omit<AssignHeadSheetProps, "open" | "onClose" | "onAssigned"> | null>(null);

  async function loadTree() {
    const res = await fetch("/api/org/tree");
    const data = await res.json();
    setBranches(data.branches ?? []);
    setFlags(data.actingUpFlags ?? []);
    setWarnings(data.capacityWarnings ?? []);
    setOpenWarnings((data.actingUpFlags ?? []).length + (data.capacityWarnings ?? []).length);
    setLoading(false);
  }

  useEffect(() => { loadTree(); }, []);

  function hasFlag(nodeId: string) {
    return flags.find((f) => f.nodeId === nodeId);
  }

  async function addBuscentre(mcId: string, name: string) {
    await fetch("/api/org/buscentres", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mcId, name }),
    });
    loadTree();
  }

  async function addCell(buscentreId: string, name: string) {
    await fetch("/api/org/cells", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buscentreId, name }),
    });
    loadTree();
  }

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1200px] mx-auto">
        <div className="skeleton h-8 w-40 mb-4 rounded-lg" />
        <div className="skeleton h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1200px] mx-auto pb-20 lg:pb-8">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[24px] font-semibold" style={{ color: "var(--brand-text)" }}>
            Organisation
          </h1>
          <p className="mt-0.5 text-[13px] hidden sm:block" style={{ color: "var(--brand-muted)" }}>
            Branch → MC → Buscentre → Cell → Shepherd → Member
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {openWarnings > 0 && (
            <Link href="/org/warnings">
              <button
                className="flex items-center gap-1.5 rounded-pill text-[12px] font-medium px-3 py-1.5"
                style={{ background: "#FEF3DC", color: "#854F0B" }}
              >
                <AlertTriangle style={{ width: 13, height: 13 }} />
                {openWarnings} warning{openWarnings !== 1 ? "s" : ""}
              </button>
            </Link>
          )}
          <Link href="/org/chart" className="hidden sm:block">
            <Button variant="outline" className="h-9 px-4 text-[14px] font-medium"
              style={{ borderRadius: 8, borderColor: "var(--brand-border)" }}>
              Organogram
            </Button>
          </Link>
          <Link href="/org/activate">
            <Button className="h-9 px-4 text-[14px] font-medium"
              style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}>
              Activate member
            </Button>
          </Link>
        </div>
      </div>

      {/* Tree */}
      {branches.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ border: "1px solid var(--brand-border)" }}>
          <Network style={{ width: 40, height: 40, color: "var(--brand-muted)", margin: "0 auto 12px" }} />
          <p className="text-[14px] font-medium" style={{ color: "var(--brand-text)" }}>No branches yet</p>
          <p className="text-[14px] mt-1" style={{ color: "var(--brand-muted)" }}>
            Run <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">npm run seed</code> to create the initial structure.
          </p>
        </div>
      ) : (
        branches.map((branch) => (
          <div
            key={branch.id}
            className="rounded-xl mb-4 overflow-hidden"
            style={{ border: "1px solid var(--brand-border)" }}
          >
            {/* Branch header */}
            <div className="px-5 py-3 flex items-center gap-2"
                 style={{ background: "var(--brand-navy)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              <Network style={{ width: 16, height: 16, color: "rgba(255,255,255,0.7)" }} />
              <span className="text-[14px] font-semibold text-white">{branch.name}</span>
              <span className="text-[12px] ml-auto" style={{ color: "rgba(255,255,255,0.5)" }}>
                {branch.megaChurches.length} MC{branch.megaChurches.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* MegaChurches */}
            <div className="p-2">
              {branch.megaChurches.map((mc) => (
                <TreeRow
                  key={mc.id}
                  label={mc.name}
                  assigned={mc.userRoles[0]?.user?.name}
                  defaultOpen
                  badges={
                    <>
                      <CapacityBadge count={mc._count.buscentres} max={999} />
                      {hasFlag(mc.id) && <ActingUpBadge severity={hasFlag(mc.id)!.severity} />}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingMC({
                            id:               mc.id,
                            name:             mc.name,
                            currentPastorId:  mc.userRoles[0]?.user?.id,
                          });
                        }}
                        className="p-1 rounded hover:bg-white/60 transition-colors"
                        aria-label={`Edit ${mc.name}`}
                      >
                        <Pencil style={{ width: 13, height: 13, color: "var(--brand-muted)" }} />
                      </button>
                    </>
                  }
                >
                  {/* Buscentres */}
                  {mc.buscentres.map((bc) => (
                    <TreeRow
                      key={bc.id}
                      label={bc.name}
                      assigned={bc.userRoles[0]?.user?.name}
                      depth={1}
                      defaultOpen
                      badges={
                        <>
                          <CapacityBadge count={bc._count.cells} max={CAPACITY.cell} />
                          {hasFlag(bc.id) && <ActingUpBadge severity={hasFlag(bc.id)!.severity} />}
                          {/* Assign Buscentre Head */}
                          {!bc.userRoles[0]?.user && (
                            <button
                              onClick={(e) => { e.stopPropagation();
                                setAssigningHead({ nodeType: "buscentre", nodeId: bc.id, nodeName: bc.name,
                                  branchId: branch.id, mcId: mc.id, buscentreId: bc.id }); }}
                              className="flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[11px] font-medium transition-colors hover:opacity-80"
                              style={{ background: "#FEF3DC", color: "#854F0B" }}
                              aria-label={`Assign head for ${bc.name}`}
                            >
                              <UserPlus style={{ width: 10, height: 10 }} /> Assign head
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingBuscentre({ id: bc.id, name: bc.name, location: bc.location }); }}
                            className="p-1 rounded hover:bg-[var(--brand-navy-light)] transition-colors"
                            aria-label={`Edit ${bc.name}`}
                          >
                            <Pencil style={{ width: 13, height: 13, color: "var(--brand-muted)" }} />
                          </button>
                        </>
                      }
                    >
                      {/* Cells */}
                      {bc.cells.map((cell) => (
                        <TreeRow
                          key={cell.id}
                          label={cell.name}
                          assigned={cell.userRoles[0]?.user?.name}
                          depth={2}
                          badges={
                            <>
                              <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--brand-muted)" }}>
                                <Users style={{ width: 11, height: 11 }} /> {cell._count.members}
                              </span>
                              <CapacityBadge count={cell._count.shepherds} max={CAPACITY.shepherd} />
                              {hasFlag(cell.id) && <ActingUpBadge severity={hasFlag(cell.id)!.severity} />}
                              {/* Assign Cell Shepherd */}
                              {!cell.userRoles[0]?.user && (
                                <button
                                  onClick={(e) => { e.stopPropagation();
                                    setAssigningHead({ nodeType: "cell", nodeId: cell.id, nodeName: cell.name,
                                      branchId: branch.id, mcId: mc.id, buscentreId: bc.id, cellId: cell.id }); }}
                                  className="flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[11px] font-medium transition-colors hover:opacity-80"
                                  style={{ background: "#FEF3DC", color: "#854F0B" }}
                                  aria-label={`Assign shepherd for ${cell.name}`}
                                >
                                  <UserPlus style={{ width: 10, height: 10 }} /> Assign head
                                </button>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingCell({ id: cell.id, name: cell.name, location: cell.location }); }}
                                className="p-1 rounded hover:bg-[var(--brand-navy-light)] transition-colors"
                                aria-label={`Edit ${cell.name}`}
                              >
                                <Pencil style={{ width: 13, height: 13, color: "var(--brand-muted)" }} />
                              </button>
                            </>
                          }
                        >
                          {/* Shepherds */}
                          {cell.shepherds.map((sh) => (
                            <ShepherdRow
                              key={sh.id}
                              shepherd={sh}
                              onAssigned={loadTree}
                            />
                          ))}
                        </TreeRow>
                      ))}

                      {/* Add cell */}
                      <AddNodeRow label="Add cell" onAdd={(name) => addCell(bc.id, name)} />
                    </TreeRow>
                  ))}

                  {/* Add buscentre */}
                  <AddNodeRow label="Add buscentre" onAdd={(name) => addBuscentre(mc.id, name)} />
                </TreeRow>
              ))}
            </div>
          </div>
        ))
      )}

      <EditMCDialog
        mc={editingMC}
        onClose={() => setEditingMC(null)}
        onSaved={loadTree}
      />
      <EditBuscentreSheet
        bc={editingBuscentre}
        onClose={() => setEditingBuscentre(null)}
        onSaved={loadTree}
      />
      <EditCellSheet
        cell={editingCell}
        onClose={() => setEditingCell(null)}
        onSaved={loadTree}
      />
      {assigningHead && (
        <AssignHeadSheet
          {...assigningHead}
          open={!!assigningHead}
          onClose={() => setAssigningHead(null)}
          onAssigned={() => { setAssigningHead(null); loadTree(); }}
        />
      )}
    </div>
  );
}
