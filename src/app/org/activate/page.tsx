"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { activateUser } from "@/app/actions/activate-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, UserCheck, Info } from "lucide-react";
import { Role } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type Member = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  isUser: boolean;
  cell: { id: string; name: string; buscentre: { id: string; name: string; mcId: string; mc: { branchId: string } } } | null;
};

type ScopeOption  = { id: string; name: string };
type ShepherdSlot = { id: string; user: { name: string } | null; _count: { members: number } };

// ─── Role metadata ────────────────────────────────────────────────────────────

const ROLE_OPTIONS: { value: Role; label: string; description: string }[] = [
  { value: "mc_pastor",      label: "MC Pastor",       description: "Leads a whole MegaChurch." },
  { value: "buscentre_head", label: "Buscentre Head",  description: "Oversees all cells in a Buscentre." },
  { value: "cell_shepherd",  label: "Cell Shepherd",   description: "Leads a Cell and all its shepherds." },
  { value: "shepherd",       label: "Shepherd",        description: "Oversees up to 5 members in a Cell. Occupies a Shepherd slot." },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-[12px] font-medium" style={{ color: "var(--brand-muted)" }}>
      {children}{required && <span style={{ color: "var(--brand-danger)" }}> *</span>}
    </label>
  );
}

function ScopeSelect({
  label, value, onChange, options, disabled, required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: ScopeOption[]; disabled?: boolean; required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label required={required}>{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || options.length === 0}
        className="h-10 px-3 text-[14px] rounded-lg disabled:opacity-40"
        style={{ border: "1px solid var(--brand-border)", color: "var(--brand-text)", background: "#fff" }}
      >
        <option value="">— Select {label} —</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ActivatePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Step 1 — member search
  const [query,    setQuery]   = useState("");
  const [members,  setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Member | null>(null);

  // Step 2 — access details
  const [email, setEmail] = useState("");
  const [role,  setRole]  = useState<Role>("cell_shepherd");

  // Step 3 — scope cascade
  const [branches,    setBranches]    = useState<ScopeOption[]>([]);
  const [mcs,         setMCs]         = useState<ScopeOption[]>([]);
  const [buscentres,  setBuscentres]  = useState<ScopeOption[]>([]);
  const [cells,       setCells]       = useState<ScopeOption[]>([]);
  const [shepherds,   setShepherds]   = useState<ShepherdSlot[]>([]);
  const [branchId,    setBranchId]    = useState("");
  const [mcId,        setMcId]        = useState("");
  const [buscentreId, setBuscentreId] = useState("");
  const [cellId,      setCellId]      = useState("");
  const [shepherdId,  setShepherdId]  = useState("");

  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState(false);

  // ── Member search ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (query.length < 2) { setMembers([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/org/members?q=${encodeURIComponent(query)}&isUser=false`);
      setMembers(await res.json());
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // ── Scope cascade ─────────────────────────────────────────────────────────────
  useEffect(() => { fetch("/api/org/branches").then((r) => r.json()).then(setBranches); }, []);

  useEffect(() => {
    if (!branchId) { setMCs([]); setMcId(""); return; }
    fetch(`/api/org/mega-churches?branchId=${branchId}`).then((r) => r.json()).then(setMCs);
    setMcId(""); setBuscentreId(""); setCellId(""); setShepherdId("");
  }, [branchId]);

  useEffect(() => {
    if (!mcId) { setBuscentres([]); setBuscentreId(""); return; }
    fetch(`/api/org/buscentres?mcId=${mcId}`).then((r) => r.json()).then(setBuscentres);
    setBuscentreId(""); setCellId(""); setShepherdId("");
  }, [mcId]);

  useEffect(() => {
    if (!buscentreId) { setCells([]); setCellId(""); return; }
    fetch(`/api/org/cells?buscentreId=${buscentreId}`).then((r) => r.json()).then(setCells);
    setCellId(""); setShepherdId("");
  }, [buscentreId]);

  // Load shepherd slots whenever cellId changes AND role is shepherd
  useEffect(() => {
    setShepherds([]); setShepherdId("");
    if (!cellId || role !== "shepherd") return;
    fetch(`/api/org/shepherds?cellId=${cellId}`).then((r) => r.json()).then(setShepherds);
  }, [cellId, role]);

  // Also reload shepherds if role switches to shepherd and cellId is already set
  useEffect(() => {
    setShepherds([]); setShepherdId("");
    if (!cellId || role !== "shepherd") return;
    fetch(`/api/org/shepherds?cellId=${cellId}`).then((r) => r.json()).then(setShepherds);
  }, [role]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Select a member — pre-fill scope from their cell ─────────────────────────
  function handleSelect(m: Member) {
    setSelected(m);
    setEmail(m.email ?? "");
    setQuery(`${m.firstName} ${m.lastName}`);
    setMembers([]);

    // Pre-fill scope from the member's existing cell if available
    if (m.cell?.buscentre?.mc?.branchId) {
      setBranchId(m.cell.buscentre.mc.branchId);
      // Trigger cascade via state — deeper levels will be set once options load
      // Store the IDs to auto-select once options arrive
      sessionStorage.setItem("_prefill_mcId",        m.cell.buscentre.mcId);
      sessionStorage.setItem("_prefill_buscentreId", m.cell.buscentre.id);
      sessionStorage.setItem("_prefill_cellId",      m.cell.id);
    }
  }

  // Apply prefill once cascade options load
  useEffect(() => {
    const target = sessionStorage.getItem("_prefill_mcId");
    if (target && mcs.find((mc) => mc.id === target)) {
      setMcId(target);
      sessionStorage.removeItem("_prefill_mcId");
    }
  }, [mcs]);

  useEffect(() => {
    const target = sessionStorage.getItem("_prefill_buscentreId");
    if (target && buscentres.find((b) => b.id === target)) {
      setBuscentreId(target);
      sessionStorage.removeItem("_prefill_buscentreId");
    }
  }, [buscentres]);

  useEffect(() => {
    const target = sessionStorage.getItem("_prefill_cellId");
    if (target && cells.find((c) => c.id === target)) {
      setCellId(target);
      sessionStorage.removeItem("_prefill_cellId");
    }
  }, [cells]);

  // ── Submit ────────────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!selected) { setError("Select a member first."); return; }
    if (!email)    { setError("Email is required."); return; }
    if (!branchId) { setError("Select a branch scope."); return; }
    if (role === "shepherd" && !cellId) {
      setError("Select a cell for this shepherd."); return;
    }

    startTransition(async () => {
      try {
        await activateUser({
          memberId:    selected.id,
          email,
          role,
          branchId,
          mcId:        mcId        || undefined,
          buscentreId: buscentreId || undefined,
          cellId:      cellId      || undefined,
          shepherdId:  shepherdId  || undefined, // optional — created automatically if blank
        });
        setSuccess(true);
        setTimeout(() => router.push("/org"), 2500);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  // ── Success screen ────────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[600px] mx-auto">
        <div className="rounded-xl p-10 text-center" style={{ border: "1px solid var(--brand-border)" }}>
          <UserCheck style={{ width: 40, height: 40, color: "var(--brand-success)", margin: "0 auto 12px" }} />
          <h2 className="text-[18px] font-semibold mb-1" style={{ color: "var(--brand-text)" }}>
            Account activated
          </h2>
          <p className="text-[14px]" style={{ color: "var(--brand-muted)" }}>
            A temporary password has been logged (or emailed in production). Redirecting to org tree…
          </p>
        </div>
      </div>
    );
  }

  const selectedRole = ROLE_OPTIONS.find((r) => r.value === role);
  const unoccupiedSlots = shepherds.filter((s) => !s.user);
  const occupiedSlots   = shepherds.filter((s) =>  s.user);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[600px] mx-auto pb-20 lg:pb-8">
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold" style={{ color: "var(--brand-text)" }}>
          Activate member
        </h1>
        <p className="mt-0.5 text-[14px]" style={{ color: "var(--brand-muted)" }}>
          Give a member system access with a role. They remain a member of their cell.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* ── Step 1: Member ── */}
        <fieldset className="rounded-xl p-5 flex flex-col gap-4"
                  style={{ border: "1px solid var(--brand-border)" }}>
          <legend className="text-[12px] font-medium uppercase tracking-[0.04em] px-1"
                  style={{ color: "var(--brand-muted)" }}>
            1 · Member
          </legend>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                    style={{ color: "var(--brand-muted)" }} />
            <Input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
              placeholder="Search by name…"
              className="pl-9 h-10 text-[14px]"
              style={{ borderColor: "var(--brand-border)" }}
            />
          </div>

          {members.length > 0 && (
            <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--brand-border)" }}>
              {members.map((m) => (
                <button key={m.id} type="button" onClick={() => handleSelect(m)}
                  className="w-full text-left px-4 py-2.5 text-[14px] hover:bg-[var(--brand-navy-light)] transition-colors"
                  style={{ borderBottom: "1px solid var(--brand-border)", color: "var(--brand-text)" }}>
                  {m.firstName} {m.lastName}
                  {m.cell && (
                    <span className="ml-2 text-[12px]" style={{ color: "var(--brand-muted)" }}>
                      · {m.cell.name}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--brand-success)" }}>
              <UserCheck className="h-4 w-4" />
              {selected.firstName} {selected.lastName} selected
              {selected.cell && (
                <span style={{ color: "var(--brand-muted)" }}>· scope pre-filled from their cell</span>
              )}
            </div>
          )}
        </fieldset>

        {/* ── Step 2: Role + email ── */}
        <fieldset className="rounded-xl p-5 flex flex-col gap-4"
                  style={{ border: "1px solid var(--brand-border)" }}>
          <legend className="text-[12px] font-medium uppercase tracking-[0.04em] px-1"
                  style={{ color: "var(--brand-muted)" }}>
            2 · Role &amp; access
          </legend>

          <div className="flex flex-col gap-1.5">
            <Label required>Role</Label>
            <select
              value={role}
              onChange={(e) => { setRole(e.target.value as Role); setShepherdId(""); }}
              className="h-10 px-3 text-[14px] rounded-lg"
              style={{ border: "1px solid var(--brand-border)", color: "var(--brand-text)", background: "#fff" }}
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {/* Role explanation */}
            {selectedRole && (
              <div className="flex items-start gap-2 rounded-lg px-3 py-2 mt-1"
                   style={{ background: "var(--brand-navy-light)" }}>
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: "var(--brand-navy)" }} />
                <p className="text-[12px]" style={{ color: "var(--brand-navy)" }}>
                  {selectedRole.description}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label required>Login email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="their@email.com" required className="h-10 text-[14px]"
              style={{ borderColor: "var(--brand-border)" }} />
          </div>
        </fieldset>

        {/* ── Step 3: Scope ── */}
        <fieldset className="rounded-xl p-5 flex flex-col gap-4"
                  style={{ border: "1px solid var(--brand-border)" }}>
          <legend className="text-[12px] font-medium uppercase tracking-[0.04em] px-1"
                  style={{ color: "var(--brand-muted)" }}>
            3 · Scope
          </legend>

          <ScopeSelect label="Branch"      value={branchId}    onChange={setBranchId}    options={branches}   required />
          <ScopeSelect label="MegaChurch"  value={mcId}        onChange={setMcId}        options={mcs}        disabled={!branchId} />
          <ScopeSelect label="Buscentre"   value={buscentreId} onChange={setBuscentreId} options={buscentres} disabled={!mcId} />
          <ScopeSelect label="Cell"        value={cellId}      onChange={setCellId}      options={cells}      disabled={!buscentreId}
            required={role === "cell_shepherd" || role === "shepherd"} />

          {/* Shepherd slot picker — only when role = shepherd AND cell is chosen */}
          {role === "shepherd" && cellId && (
            <div className="flex flex-col gap-1.5">
              <Label>Shepherd slot</Label>

              {shepherds.length === 0 ? (
                <div className="rounded-lg px-3 py-2.5 text-[13px]"
                     style={{ background: "var(--brand-navy-light)", color: "var(--brand-navy)" }}>
                  No shepherd slots in this cell yet — one will be created automatically on activation.
                </div>
              ) : (
                <select
                  value={shepherdId}
                  onChange={(e) => setShepherdId(e.target.value)}
                  className="h-10 px-3 text-[14px] rounded-lg"
                  style={{ border: "1px solid var(--brand-border)", color: "var(--brand-text)", background: "#fff" }}
                >
                  <option value="">— Create new slot automatically —</option>

                  {unoccupiedSlots.length > 0 && (
                    <optgroup label="Available slots">
                      {unoccupiedSlots.map((s) => (
                        <option key={s.id} value={s.id}>
                          Empty slot ({s._count.members} members assigned)
                        </option>
                      ))}
                    </optgroup>
                  )}

                  {occupiedSlots.length > 0 && (
                    <optgroup label="Already occupied">
                      {occupiedSlots.map((s) => (
                        <option key={s.id} value={s.id} disabled>
                          {s.user!.name} — occupied
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              )}

              <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
                Leave blank to create a new shepherd slot in this cell automatically.
              </p>
            </div>
          )}
        </fieldset>

        {error && (
          <p className="text-[13px]" style={{ color: "var(--brand-danger)" }}>{error}</p>
        )}

        <Button
          type="submit"
          disabled={isPending || !selected}
          className="h-10 text-[14px] font-medium"
          style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}
        >
          {isPending ? "Activating…" : "Activate & send email"}
        </Button>
      </form>
    </div>
  );
}
