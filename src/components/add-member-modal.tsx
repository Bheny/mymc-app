"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
  SheetBody, SheetFooter, SheetTrigger,
} from "@/components/ui/sheet";
import { UserPlus, Plus, Loader2, Lock } from "lucide-react";
import { useActiveRole } from "@/hooks/use-active-role";
import { DepartmentPicker } from "@/components/department-picker";

// ─── Types ────────────────────────────────────────────────────────────────────

type MemberLevel = "shepherd" | "cell" | "buscentre" | "mc";

type Option       = { id: string; name: string };
type ShepherdSlot = {
  id:     string;
  user:   { name: string } | null;
  person: { firstName: string; lastName: string } | null;
  _count: { members: number };
};
type ScopeContext = {
  mc:        { id: string; name: string } | null;
  buscentre: { id: string; name: string } | null;
  cell:      { id: string; name: string } | null;
};

const LEVELS: { value: MemberLevel; label: string; description: string }[] = [
  { value: "shepherd",  label: "Regular member",  description: "Belongs to a shepherd within a cell." },
  { value: "cell",      label: "Cell level",       description: "Attached to a cell directly (e.g. acting cell shepherd, not yet activated)." },
  { value: "buscentre", label: "Buscentre level",  description: "Senior leader not in a cell — e.g. Buscentre Head." },
  { value: "mc",        label: "MC level",         description: "MC-wide leader not in a buscentre — e.g. MC Pastor." },
];

const GENDERS = ["Male", "Female", "Other"] as const;

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium uppercase tracking-[0.04em]"
             style={{ color: "var(--brand-muted)" }}>
        {label}{required && <span style={{ color: "var(--brand-danger)" }}> *</span>}
      </label>
      {children}
    </div>
  );
}

function NativeSelect({
  value, onChange, disabled, placeholder, options, displayFn,
}: {
  value: string; onChange: (v: string) => void; disabled?: boolean;
  placeholder: string; options: { id: string }[];
  displayFn: (o: { id: string }) => string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
      className="h-10 px-3 text-[14px] rounded-lg disabled:opacity-40"
      style={{ border: "1px solid var(--brand-border)", color: "var(--brand-text)", background: "#fff" }}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.id} value={o.id}>{displayFn(o)}</option>)}
    </select>
  );
}

// Read-only display for pre-filled scope fields
function LockedField({ name }: { name: string }) {
  return (
    <div className="h-10 px-3 flex items-center justify-between rounded-lg text-[14px]"
         style={{ border: "1px solid var(--brand-border)", background: "#F9FAFB", color: "var(--brand-text)" }}>
      <span>{name}</span>
      <Lock className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--brand-muted)" }} />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AddMemberModal({ onAdded }: { onAdded?: () => void }) {
  const { data: session } = useSession();
  const { activeView }    = useActiveRole();

  const [open, setOpen] = useState(false);

  // Level
  const [level, setLevel] = useState<MemberLevel>("shepherd");

  // Cascade scope
  const [mcs,         setMCs]         = useState<Option[]>([]);
  const [buscentres,  setBuscentres]  = useState<Option[]>([]);
  const [cells,       setCells]       = useState<Option[]>([]);
  const [shepherds,   setShepherds]   = useState<ShepherdSlot[]>([]);
  const [mcId,        setMcId]        = useState("");
  const [buscentreId, setBuscentreId] = useState("");
  const [cellId,      setCellId]      = useState("");
  const [shepherdId,  setShepherdId]  = useState("");

  // Pre-filled context from the active role
  const [scopeCtx, setScopeCtx] = useState<ScopeContext | null>(null);

  // Member fields
  const [firstName,  setFirstName]  = useState("");
  const [lastName,   setLastName]   = useState("");
  const [phone,      setPhone]      = useState("");
  const [email,      setEmail]      = useState("");
  const [gender,     setGender]     = useState("");
  const [joinedDate, setJoinedDate] = useState("");
  const [departments,   setDepartments]   = useState<Option[]>([]);
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);

  // UI
  const [busy,             setBusy]             = useState(false);
  const [creatingShepherd, setCreatingShepherd] = useState(false);
  const [shepherdWarning,  setShepherdWarning]  = useState("");
  const [error,            setError]            = useState("");

  // ── Derive acting params and active role ─────────────────────────────────────
  const activeRole        = activeView?.role ?? session?.user?.role ?? null;
  const actingCellId      = activeView?.isActing && activeView.cellId      ? activeView.cellId      : null;
  const actingBuscentreId = activeView?.isActing && activeView.buscentreId ? activeView.buscentreId : null;

  // Fields that are pre-filled and not editable for this role
  const lockedMc        = (activeRole === "buscentre_head" || activeRole === "cell_shepherd") && !!scopeCtx?.mc;
  const lockedBuscentre = (activeRole === "buscentre_head" || activeRole === "cell_shepherd") && !!scopeCtx?.buscentre;
  const lockedCell      = activeRole === "cell_shepherd" && !!scopeCtx?.cell;

  // ── On open: fetch MC list + scope context ────────────────────────────────────
  useEffect(() => {
    if (!open) return;

    fetch("/api/org/mega-churches")
      .then((r) => r.json()).then(setMCs).catch(() => {});

    fetch("/api/org/departments")
      .then((r) => r.json())
      .then((d) => setDepartments(Array.isArray(d.departments) ? d.departments : []))
      .catch(() => {});

    const params = new URLSearchParams();
    if (actingBuscentreId) params.set("actingBuscentreId", actingBuscentreId);
    if (actingCellId)      params.set("actingCellId",      actingCellId);

    fetch(`/api/me/context?${params}`)
      .then((r) => r.json())
      .then((ctx: ScopeContext) => {
        setScopeCtx(ctx);
        // Pre-fill scope — effects for mcId/buscentreId handle cascade guards
        if (ctx.mc?.id)        setMcId(ctx.mc.id);
        if (ctx.buscentre?.id) setBuscentreId(ctx.buscentre.id);
        if (ctx.cell?.id)      setCellId(ctx.cell.id);
      })
      .catch(() => {});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cascade MC → buscentres (skip when buscentre is locked) ──────────────────
  useEffect(() => {
    if (lockedBuscentre) return;
    setBuscentres([]); setBuscentreId(""); setCells([]); setCellId("");
    setShepherds([]); setShepherdId(""); setShepherdWarning("");
    if (!mcId) return;
    fetch(`/api/org/buscentres?mcId=${mcId}`)
      .then((r) => r.json()).then(setBuscentres).catch(() => {});
  }, [mcId, lockedBuscentre]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cascade buscentre → cells (skip when cell is locked) ─────────────────────
  useEffect(() => {
    if (lockedCell) return;
    setCells([]); setCellId(""); setShepherds([]); setShepherdId(""); setShepherdWarning("");
    if (!buscentreId) return;
    fetch(`/api/org/cells?buscentreId=${buscentreId}`)
      .then((r) => r.json()).then(setCells).catch(() => {});
  }, [buscentreId, lockedCell]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cascade cell → shepherds ──────────────────────────────────────────────────
  useEffect(() => {
    setShepherds([]); setShepherdId(""); setShepherdWarning("");
    if (!cellId || level !== "shepherd") return;
    fetch(`/api/org/shepherds?cellId=${cellId}`)
      .then((r) => r.json()).then(setShepherds).catch(() => {});
  }, [cellId, level]);

  // ── Reset shepherds when level changes ────────────────────────────────────────
  useEffect(() => {
    setShepherdId(""); setShepherdWarning("");
    if (cellId && level === "shepherd") {
      fetch(`/api/org/shepherds?cellId=${cellId}`).then((r) => r.json()).then(setShepherds).catch(() => {});
    } else {
      setShepherds([]);
    }
  }, [level]); // eslint-disable-line react-hooks/exhaustive-deps

  async function reloadShepherds(forCellId: string) {
    const data = await fetch(`/api/org/shepherds?cellId=${forCellId}`).then((r) => r.json());
    setShepherds(data);
    return data as ShepherdSlot[];
  }

  async function createShepherd() {
    if (!cellId) return;
    setCreatingShepherd(true); setError(""); setShepherdWarning("");
    const res = await fetch("/api/org/shepherds", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cellId }),
    });
    if (res.ok) {
      const newShepherd = await res.json();
      if (newShepherd.warning) setShepherdWarning(newShepherd.warning);
      const updated = await reloadShepherds(cellId);
      const match = updated.find((s) => s.id === newShepherd.id);
      if (match) setShepherdId(match.id);
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Could not create shepherd slot.");
    }
    setCreatingShepherd(false);
  }

  function resetForm() {
    setLevel("shepherd");
    // Restore locked fields from context; clear editable ones
    setMcId(        lockedMc        ? (scopeCtx?.mc?.id        ?? "") : "");
    setBuscentreId( lockedBuscentre ? (scopeCtx?.buscentre?.id ?? "") : "");
    setCellId(      lockedCell      ? (scopeCtx?.cell?.id      ?? "") : "");
    setShepherdId("");
    setFirstName(""); setLastName(""); setPhone("");
    setEmail(""); setGender(""); setJoinedDate(""); setDepartmentIds([]);
    setShepherdWarning(""); setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (!firstName.trim() || !lastName.trim()) { setError("First and last name are required."); return; }

    const validation: Record<MemberLevel, () => string | null> = {
      shepherd:  () => !shepherdId  ? "Please select a shepherd."  : null,
      cell:      () => !cellId      ? "Please select a cell."      : null,
      buscentre: () => !buscentreId ? "Please select a buscentre." : null,
      mc:        () => !mcId        ? "Please select an MC."       : null,
    };
    const err = validation[level]();
    if (err) { setError(err); return; }

    setBusy(true);
    const res = await fetch("/api/members", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level,
        shepherdId:  level === "shepherd"                    ? shepherdId  : undefined,
        cellId:      level === "shepherd" || level === "cell" ? cellId     : undefined,
        buscentreId: level === "buscentre"                   ? buscentreId : undefined,
        mcId:        level === "mc"                          ? mcId        : undefined,
        firstName: firstName.trim(), lastName: lastName.trim(),
        phone: phone || null, email: email || null,
        gender: gender || null, joinedDate: joinedDate || null,
        departmentIds,
      }),
    });
    setBusy(false);

    if (res.ok) { resetForm(); setOpen(false); onAdded?.(); }
    else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed to add member.");
    }
  }

  const selectedLevelMeta = LEVELS.find((l) => l.value === level)!;

  // Whether the MC selector is visible for this level
  const showMc        = true; // all levels need MC (entry point of the cascade)
  const showBuscentre = level !== "mc";
  const showCell      = level === "cell" || level === "shepherd";
  const showShepherd  = level === "shepherd";

  return (
    <Sheet open={open} onOpenChange={(o) => {
      setOpen(o);
      if (!o) { resetForm(); setScopeCtx(null); }
    }}>
      <SheetTrigger asChild>
        <Button className="h-9 px-4 text-[14px] font-medium"
                style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}>
          <UserPlus className="mr-2 h-4 w-4" /> Add Member
        </Button>
      </SheetTrigger>

      <SheetContent width={500}>
        <SheetHeader>
          <SheetTitle>Add Member</SheetTitle>
        </SheetHeader>

        <SheetBody>
        <form id="add-member-form" onSubmit={handleSubmit} className="flex flex-col gap-4">

          {/* ── Membership level ── */}
          <Field label="Membership level" required>
            <div className="grid grid-cols-2 gap-2">
              {LEVELS.map((l) => (
                <button
                  key={l.value} type="button"
                  onClick={() => setLevel(l.value)}
                  className="text-left px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors"
                  style={level === l.value
                    ? { background: "var(--brand-navy)", color: "#fff", border: "1px solid var(--brand-navy)" }
                    : { background: "#fff", color: "var(--brand-text)", border: "1px solid var(--brand-border)" }}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <p className="text-[12px] mt-1" style={{ color: "var(--brand-muted)" }}>
              {selectedLevelMeta.description}
            </p>
          </Field>

          <div className="h-px" style={{ background: "var(--brand-border)" }} />

          <p className="text-[11px] font-medium uppercase tracking-[0.06em]"
             style={{ color: "var(--brand-muted)" }}>
            Assignment
          </p>

          {/* ── MC ── always first */}
          {showMc && (
            <Field label="MegaChurch" required={level === "mc"}>
              {lockedMc && scopeCtx?.mc ? (
                <LockedField name={scopeCtx.mc.name} />
              ) : (
                <NativeSelect value={mcId} onChange={setMcId}
                  placeholder="— Select MC —" options={mcs}
                  displayFn={(o) => (o as Option).name} />
              )}
            </Field>
          )}

          {/* ── Buscentre ── */}
          {showBuscentre && (
            <Field label="Buscentre" required={level === "buscentre"}>
              {lockedBuscentre && scopeCtx?.buscentre ? (
                <LockedField name={scopeCtx.buscentre.name} />
              ) : (
                <NativeSelect value={buscentreId} onChange={setBuscentreId}
                  placeholder={!mcId ? "Select an MC first" : buscentres.length === 0 ? "No buscentres" : "— Select buscentre —"}
                  options={buscentres}
                  disabled={!mcId || buscentres.length === 0}
                  displayFn={(o) => (o as Option).name} />
              )}
            </Field>
          )}

          {/* ── Cell ── */}
          {showCell && (
            <Field label="Cell" required>
              {lockedCell && scopeCtx?.cell ? (
                <LockedField name={scopeCtx.cell.name} />
              ) : (
                <NativeSelect value={cellId} onChange={setCellId}
                  disabled={!buscentreId || cells.length === 0}
                  placeholder={!buscentreId ? "Select a buscentre first" : cells.length === 0 ? "No cells yet" : "— Select cell —"}
                  options={cells}
                  displayFn={(o) => (o as Option).name} />
              )}
            </Field>
          )}

          {/* ── Shepherd slot ── */}
          {showShepherd && (
            <Field label="Shepherd" required>
              {!cellId ? (
                <div className="h-10 px-3 flex items-center rounded-lg text-[14px]"
                     style={{ border: "1px solid var(--brand-border)", color: "var(--brand-muted)" }}>
                  Select a cell first
                </div>
              ) : shepherds.length === 0 ? (
                <div className="rounded-lg p-4 flex flex-col gap-3 items-start"
                     style={{ background: "var(--brand-navy-light)", border: "1px solid var(--brand-border)" }}>
                  <p className="text-[13px]" style={{ color: "var(--brand-text)" }}>
                    No shepherd slots in this cell. Create one to continue.
                  </p>
                  <button type="button" onClick={createShepherd} disabled={creatingShepherd}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium"
                    style={{ background: "var(--brand-navy)", color: "#fff" }}>
                    {creatingShepherd
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating…</>
                      : <><Plus className="h-3.5 w-3.5" /> Create shepherd slot</>}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <NativeSelect value={shepherdId} onChange={setShepherdId}
                    placeholder="— Select shepherd —" options={shepherds}
                    displayFn={(o) => {
                      const s = o as ShepherdSlot;
                      const name = s.user?.name
                        ?? (s.person ? `${s.person.firstName} ${s.person.lastName}` : null)
                        ?? "Unassigned shepherd";
                      return `${name} (${s._count.members}/5 members)`;
                    }} />
                  {shepherdWarning && (
                    <p className="text-[12px]" style={{ color: "var(--brand-warning)" }}>
                      ⚠ {shepherdWarning}. Warning logged.
                    </p>
                  )}
                  <button type="button" onClick={createShepherd} disabled={creatingShepherd}
                    className="flex items-center gap-1.5 text-[12px] font-medium self-start"
                    style={{ color: "var(--brand-navy)" }}>
                    {creatingShepherd ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    Add another shepherd slot
                  </button>
                </div>
              )}
            </Field>
          )}

          <div className="h-px" style={{ background: "var(--brand-border)" }} />

          {/* ── Personal details ── */}
          <p className="text-[11px] font-medium uppercase tracking-[0.06em]"
             style={{ color: "var(--brand-muted)" }}>
            Personal details
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" required>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. John" className="h-10 text-[14px]"
                style={{ borderColor: "var(--brand-border)" }} />
            </Field>
            <Field label="Last name" required>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Doe" className="h-10 text-[14px]"
                style={{ borderColor: "var(--brand-border)" }} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="+233 …" className="h-10 text-[14px]"
                style={{ borderColor: "var(--brand-border)" }} />
            </Field>
            <Field label="Gender">
              <NativeSelect value={gender} onChange={setGender}
                placeholder="— Select —"
                options={GENDERS.map((g) => ({ id: g, name: g }))}
                displayFn={(o) => (o as { id: string; name: string }).name} />
            </Field>
          </div>

          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="optional" className="h-10 text-[14px]"
              style={{ borderColor: "var(--brand-border)" }} />
          </Field>

          <Field label="Date joined">
            <Input type="date" value={joinedDate} onChange={(e) => setJoinedDate(e.target.value)}
              className="h-10 text-[14px]" style={{ borderColor: "var(--brand-border)" }} />
          </Field>

          <Field label="Departments">
            <DepartmentPicker departments={departments} selected={departmentIds} onChange={setDepartmentIds} />
          </Field>

          {error && <p className="text-[13px]" style={{ color: "var(--brand-danger)" }}>{error}</p>}
        </form>
        </SheetBody>

        <SheetFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}
                  className="h-9 text-[13px]" style={{ borderRadius: 8 }}>Cancel</Button>
          <Button type="submit" form="add-member-form" disabled={busy} className="h-9 text-[13px]"
                  style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}>
            {busy ? "Saving…" : "Add Member"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
