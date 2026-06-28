"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import {
  Users, UserCheck, UserX, Plus, Pencil, Trash2, Loader2, Briefcase,
  ChevronRight, Search, X,
} from "lucide-react";
import { SummaryCard } from "@/components/summary-card";
import { Button } from "@/components/ui/button";
import { useRoleGuard } from "@/hooks/use-role-guard";

type LeaderMember = { leaderId: string; id: string; firstName: string; lastName: string };
type DepartmentRow = {
  id: string; name: string; memberCount: number;
  head: LeaderMember | null;
  assistants: LeaderMember[];
};
type MemberOption = { id: string; firstName: string; lastName: string };

type DepartmentsResponse = {
  departments:      DepartmentRow[];
  totalMembers:     number;
  withDepartment:   number;
  withoutDepartment: number;
};

function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-4 py-3 text-[13px] shadow-lg"
         style={{ background: "#fff", border: "1px solid var(--brand-border)" }}>
      <p className="font-semibold mb-1" style={{ color: "var(--brand-text)" }}>{label}</p>
      <p style={{ color: "var(--brand-muted)" }}>
        {payload[0].value} member{payload[0].value !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

// ─── Leadership ───────────────────────────────────────────────────────────────

function RemoveLeaderButton({
  departmentId, leaderId, onChanged,
}: { departmentId: string; leaderId: string; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  async function remove() {
    setBusy(true);
    await fetch(`/api/org/departments/${departmentId}/leaders/${leaderId}`, { method: "DELETE" });
    setBusy(false);
    onChanged();
  }
  return (
    <button onClick={remove} disabled={busy} className="text-[11px] font-medium shrink-0 disabled:opacity-50"
            style={{ color: "var(--brand-danger)" }}>
      {busy ? "…" : "Remove"}
    </button>
  );
}

// A single assignable slot — shows the current member + remove, or an
// "Assign" trigger with debounced member search when empty.
function LeaderSlot({
  departmentId, role, label, onChanged,
}: {
  departmentId: string;
  role:         "HEAD" | "ASSISTANT";
  label:        string;
  onChanged:    () => void;
}) {
  const [assigning, setAssigning] = useState(false);
  const [query,     setQuery]     = useState("");
  const [results,   setResults]   = useState<MemberOption[]>([]);
  const [busy,      setBusy]      = useState(false);
  const [error,     setError]     = useState("");

  useEffect(() => {
    if (!assigning || query.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/org/members?q=${encodeURIComponent(query)}`);
      const data = await res.json().catch(() => []);
      setResults(Array.isArray(data) ? data.slice(0, 8) : []);
    }, 300);
    return () => clearTimeout(t);
  }, [query, assigning]);

  async function assign(memberId: string) {
    setBusy(true); setError("");
    const res = await fetch(`/api/org/departments/${departmentId}/leaders`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, role }),
    });
    setBusy(false);
    if (res.ok) { setAssigning(false); setQuery(""); setResults([]); onChanged(); }
    else { const d = await res.json().catch(() => ({})); setError(d.error ?? "Failed to assign."); }
  }

  if (!assigning) {
    return (
      <button onClick={() => setAssigning(true)}
              className="flex items-center gap-1 text-[12px] font-medium self-start"
              style={{ color: "var(--brand-navy)" }}>
        <Plus className="h-3 w-3" /> {label}
      </button>
    );
  }

  return (
    <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: "#F0F4FA", border: "1px solid var(--brand-border)" }}>
      <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ background: "#fff", border: "1px solid var(--brand-border)" }}>
        <Search className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--brand-muted)" }} />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search member by name…"
          className="flex-1 text-[13px] outline-none bg-transparent"
          style={{ color: "var(--brand-text)" }}
        />
        <button onClick={() => { setAssigning(false); setQuery(""); setResults([]); setError(""); }}>
          <X className="h-3.5 w-3.5" style={{ color: "var(--brand-muted)" }} />
        </button>
      </div>
      {error && <p className="text-[12px]" style={{ color: "var(--brand-danger)" }}>{error}</p>}
      {busy && (
        <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--brand-muted)" }}>
          <Loader2 className="h-3 w-3 animate-spin" /> Assigning…
        </div>
      )}
      {results.length > 0 && (
        <div className="flex flex-col rounded-lg overflow-hidden" style={{ border: "1px solid var(--brand-border)" }}>
          {results.map((m, i) => (
            <button key={m.id} onClick={() => assign(m.id)}
                    className="text-left px-3 py-2 text-[13px] hover:bg-[var(--brand-navy-light)] transition-colors"
                    style={{ borderBottom: i < results.length - 1 ? "1px solid var(--brand-border)" : "none", color: "var(--brand-text)" }}>
              {m.firstName} {m.lastName}
            </button>
          ))}
        </div>
      )}
      {query.length >= 2 && results.length === 0 && !busy && (
        <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>No members found.</p>
      )}
    </div>
  );
}

function DepartmentLeadership({ department, onChanged }: { department: DepartmentRow; onChanged: () => void }) {
  return (
    <div className="flex flex-col gap-4 pt-3">
      {/* Head */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.04em]" style={{ color: "var(--brand-muted)" }}>
          Head
        </span>
        {department.head ? (
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium flex-1" style={{ color: "var(--brand-text)" }}>
              {department.head.firstName} {department.head.lastName}
            </span>
            <RemoveLeaderButton departmentId={department.id} leaderId={department.head.leaderId} onChanged={onChanged} />
          </div>
        ) : (
          <LeaderSlot departmentId={department.id} role="HEAD" label="Assign head" onChanged={onChanged} />
        )}
      </div>

      {/* Assistants */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.04em]" style={{ color: "var(--brand-muted)" }}>
          Assistants ({department.assistants.length}/2)
        </span>
        {department.assistants.map((a) => (
          <div key={a.leaderId} className="flex items-center gap-2">
            <span className="text-[13px] flex-1" style={{ color: "var(--brand-text)" }}>
              {a.firstName} {a.lastName}
            </span>
            <RemoveLeaderButton departmentId={department.id} leaderId={a.leaderId} onChanged={onChanged} />
          </div>
        ))}
        {department.assistants.length < 2 && (
          <LeaderSlot departmentId={department.id} role="ASSISTANT" label="Add assistant" onChanged={onChanged} />
        )}
      </div>
    </div>
  );
}

function DepartmentRowItem({
  department, isLast, onChanged,
}: {
  department: DepartmentRow;
  isLast:     boolean;
  onChanged:  () => void;
}) {
  const [editing,  setEditing]  = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [name,     setName]     = useState(department.name);
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState("");

  async function save() {
    if (!name.trim()) return;
    setBusy(true); setError("");
    const res = await fetch(`/api/org/departments/${department.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setBusy(false);
    if (res.ok) { setEditing(false); onChanged(); }
    else { const d = await res.json().catch(() => ({})); setError(d.error ?? "Failed to rename."); }
  }

  async function remove() {
    if (!confirm(`Delete "${department.name}"? Members will be unassigned from it.`)) return;
    setBusy(true);
    const res = await fetch(`/api/org/departments/${department.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) onChanged();
    else { const d = await res.json().catch(() => ({})); setError(d.error ?? "Failed to delete."); }
  }

  return (
    <div style={{ borderTop: isLast ? "none" : "1px solid var(--brand-border)" }}>
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-[var(--brand-navy-light)] transition-colors"
           onClick={() => !editing && setExpanded((o) => !o)}>
        {editing ? (
          <>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              className="flex-1 h-9 px-3 text-[13px] rounded-lg"
              style={{ border: "1px solid var(--brand-border)", color: "var(--brand-text)" }}
            />
            <button onClick={save} disabled={busy}
                    className="h-9 px-3 text-[12px] font-medium rounded-lg shrink-0"
                    style={{ background: "var(--brand-navy)", color: "#fff" }}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
            </button>
            <button onClick={() => { setEditing(false); setName(department.name); setError(""); }}
                    className="h-9 px-3 text-[12px] shrink-0" style={{ color: "var(--brand-muted)" }}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <ChevronRight className="h-4 w-4 shrink-0 transition-transform"
              style={{ color: "var(--brand-muted)", transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }} />
            <span className="flex-1 text-[13.5px] font-medium" style={{ color: "var(--brand-text)" }}>
              {department.name}
            </span>
            {department.head && (
              <span className="text-[11px] hidden sm:block" style={{ color: "var(--brand-muted)" }}>
                Head: {department.head.firstName} {department.head.lastName}
              </span>
            )}
            <span className="text-[12px] font-medium rounded-pill px-2 py-0.5 shrink-0"
                  style={{ background: "var(--brand-navy-light)", color: "var(--brand-navy)" }}>
              {department.memberCount} member{department.memberCount !== 1 ? "s" : ""}
            </span>
            <button onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                    className="p-1.5 rounded hover:bg-white transition-colors shrink-0">
              <Pencil className="h-3.5 w-3.5" style={{ color: "var(--brand-muted)" }} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); remove(); }} disabled={busy}
                    className="p-1.5 rounded hover:bg-[#FDECEA] transition-colors shrink-0">
              <Trash2 className="h-3.5 w-3.5" style={{ color: "var(--brand-danger)" }} />
            </button>
          </>
        )}
      </div>
      {error && <p className="text-[12px] px-4 pb-2" style={{ color: "var(--brand-danger)" }}>{error}</p>}
      {expanded && !editing && (
        <div className="px-4 pb-4" style={{ background: "#FAFAFA" }}>
          <DepartmentLeadership department={department} onChanged={onChanged} />
        </div>
      )}
    </div>
  );
}

export default function DepartmentsPage() {
  const { isLoading: roleLoading } = useRoleGuard(["admin", "chief_shepherd"]);

  const [data,    setData]    = useState<DepartmentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/org/departments");
    if (res.ok) setData(await res.json());
    else { const d = await res.json().catch(() => ({})); setError(d.error ?? "Failed to load departments."); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createDepartment(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true); setCreateError("");
    const res = await fetch("/api/org/departments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setCreating(false);
    if (res.ok) { setNewName(""); load(); }
    else { const d = await res.json().catch(() => ({})); setCreateError(d.error ?? "Failed to create department."); }
  }

  if (roleLoading || loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[900px] mx-auto">
        <div className="skeleton h-8 w-56 mb-2 rounded-lg" />
        <div className="skeleton h-4 w-80 mb-6 rounded-lg" />
        <div className="skeleton h-48 w-full rounded-xl" />
      </div>
    );
  }

  const pctWith = data && data.totalMembers > 0 ? Math.round((data.withDepartment / data.totalMembers) * 100) : 0;
  const chartData = (data?.departments ?? []).map((d) => ({ name: d.name, members: d.memberCount }));

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[900px] mx-auto pb-20 lg:pb-8">
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold" style={{ color: "var(--brand-text)" }}>
          Departments
        </h1>
        <p className="mt-0.5 text-[14px]" style={{ color: "var(--brand-muted)" }}>
          Ministry teams members can serve in — Choir, Ushering, Media, Protocol, etc.
        </p>
      </div>

      {error && <p className="text-[13px] mb-4" style={{ color: "var(--brand-danger)" }}>{error}</p>}

      {/* ── Stats ── */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <SummaryCard title="Total Members" value={data.totalMembers} icon={<Users className="h-4 w-4" />} />
          <SummaryCard title="In a Department" value={data.withDepartment} icon={<UserCheck className="h-4 w-4" />}
            subtitle={`${pctWith}% of total`} />
          <SummaryCard title="Not in Any Department" value={data.withoutDepartment} icon={<UserX className="h-4 w-4" />}
            subtitle={data.withoutDepartment > 0 ? "Encourage them to join one" : "Everyone is serving"} />
        </div>
      )}

      {/* ── Breakdown chart ── */}
      {chartData.length > 0 && (
        <div className="rounded-xl p-5 mb-6" style={{ border: "1px solid var(--brand-border)", background: "#fff" }}>
          <p className="text-[13px] font-semibold mb-4" style={{ color: "var(--brand-text)" }}>
            Members per department
          </p>
          <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 44)} >
            <BarChart data={chartData} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--brand-border)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--brand-muted)" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12, fill: "var(--brand-text)" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="members" radius={[0, 4, 4, 0]} barSize={20}>
                {chartData.map((_, i) => <Cell key={i} fill="var(--brand-navy)" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Create department ── */}
      <form onSubmit={createDepartment} className="flex items-center gap-2 mb-4">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New department name…"
          className="flex-1 h-10 px-3 text-[14px] rounded-lg"
          style={{ border: "1px solid var(--brand-border)", color: "var(--brand-text)" }}
        />
        <Button type="submit" disabled={creating} className="h-10 px-4 text-[13px]"
                style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="mr-1.5 h-4 w-4" /> Add</>}
        </Button>
      </form>
      {createError && <p className="text-[13px] mb-3" style={{ color: "var(--brand-danger)" }}>{createError}</p>}

      {/* ── List ── */}
      {!data || data.departments.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ border: "1px solid var(--brand-border)" }}>
          <Briefcase style={{ width: 36, height: 36, color: "var(--brand-muted)", margin: "0 auto 10px" }} />
          <p className="text-[14px]" style={{ color: "var(--brand-muted)" }}>No departments yet — add one above.</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--brand-border)" }}>
          {data.departments.map((d, i) => (
            <DepartmentRowItem key={d.id} department={d} isLast={i === data.departments.length - 1} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}
