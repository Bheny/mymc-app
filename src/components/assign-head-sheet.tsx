"use client";

/**
 * AssignHeadSheet — slide-in panel for assigning a head to a cell or buscentre.
 *
 * Two modes:
 *   Permanent → links to /org/activate with scope pre-filled (new activation)
 *   Acting    → inline assignment of a higher-level existing user (temporary cover)
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
  SheetBody, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ExternalLink, UserCheck, AlertTriangle, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type NodeType = "cell" | "buscentre";

export type AssignHeadSheetProps = {
  open:       boolean;
  onClose:    () => void;
  onAssigned: () => void;

  nodeType:   NodeType;
  nodeId:     string;
  nodeName:   string;

  // IDs for pre-filling the activate URL
  branchId?:    string;
  mcId?:        string;
  buscentreId?: string;
  cellId?:      string;
};

// Roles eligible to act in each head position.
// Includes both downward coverage (senior steps down) and upward stepping (junior steps up).
const ELIGIBLE_ACTING_ROLES: Record<NodeType, string[]> = {
  cell:      ["buscentre_head", "mc_pastor", "chief_shepherd", "admin"],
  buscentre: ["cell_shepherd", "mc_pastor", "chief_shepherd", "admin"],
};

// Target role for each node type
const TARGET_ROLE: Record<NodeType, string> = {
  cell:      "cell_shepherd",
  buscentre: "buscentre_head",
};

const ROLE_LABEL: Record<string, string> = {
  cell_shepherd:  "Cell Shepherd",
  buscentre_head: "Buscentre Head",
  mc_pastor:      "MC Pastor",
  chief_shepherd: "Chief Shepherd",
  admin:          "Admin",
};

type UserOption = {
  id:    string;
  name:  string | null;
  email: string;
  role:  { role: string } | null;
  // acting state for this user on this node
  isActing?: boolean;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function AssignHeadSheet({
  open, onClose, onAssigned,
  nodeType, nodeId, nodeName,
  branchId, mcId, buscentreId, cellId,
}: AssignHeadSheetProps) {
  const [mode,       setMode]       = useState<"permanent" | "acting">("permanent");
  const [users,      setUsers]      = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");
  const [success,    setSuccess]    = useState(false);

  const targetRole  = TARGET_ROLE[nodeType];
  const eligibleRoles = ELIGIBLE_ACTING_ROLES[nodeType];

  // Load eligible acting users when sheet opens
  useEffect(() => {
    if (!open || mode !== "acting") return;
    setLoadingUsers(true);
    setSelectedId("");
    setError("");

    fetch("/api/org/users")
      .then((r) => r.json())
      .then((all: UserOption[]) => {
        const eligible = all.filter((u) =>
          u.role && eligibleRoles.includes(u.role.role)
        );
        setUsers(eligible);
        setLoadingUsers(false);
      })
      .catch(() => setLoadingUsers(false));
  }, [open, mode, eligibleRoles]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setMode("permanent");
      setSelectedId("");
      setError("");
      setSuccess(false);
    }
  }, [open]);

  async function assignActing() {
    if (!selectedId) { setError("Select a person."); return; }
    setSaving(true); setError("");

    const res = await fetch("/api/org/acting", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId:   selectedId,
        actingAs: targetRole,
        nodeType: nodeType,
        nodeId:   nodeId,
        nodeName: nodeName,
      }),
    });

    setSaving(false);
    if (res.ok) {
      setSuccess(true);
      setTimeout(() => { onAssigned(); onClose(); }, 1500);
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed to assign acting role.");
    }
  }

  // Build the activate URL with scope pre-filled
  const activateParams = new URLSearchParams();
  if (branchId)    activateParams.set("branchId",    branchId);
  if (mcId)        activateParams.set("mcId",        mcId);
  if (buscentreId) activateParams.set("buscentreId", buscentreId);
  if (cellId)      activateParams.set("cellId",      cellId);
  activateParams.set("role", targetRole);
  const activateUrl = `/org/activate?${activateParams.toString()}`;

  const selectedUser = users.find((u) => u.id === selectedId);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent width={460}>
        <SheetHeader>
          <SheetTitle>
            Assign {nodeType === "cell" ? "Cell Shepherd" : "Buscentre Head"}
          </SheetTitle>
          <SheetDescription>
            {nodeName}
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          {success ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <UserCheck className="h-10 w-10" style={{ color: "var(--brand-success)" }} />
              <p className="text-[15px] font-semibold" style={{ color: "var(--brand-text)" }}>
                Acting role assigned
              </p>
              <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>
                {selectedUser?.name} can now switch to this role via the role switcher after re-logging in.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">

              {/* ── Mode toggle ── */}
              <div className="flex rounded-lg overflow-hidden"
                   style={{ border: "1px solid var(--brand-border)" }}>
                {(["permanent", "acting"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMode(m); setError(""); setSelectedId(""); }}
                    className="flex-1 py-2.5 text-[13px] font-medium transition-colors"
                    style={mode === m
                      ? { background: "var(--brand-navy)", color: "#fff" }
                      : { background: "#fff", color: "var(--brand-muted)" }}
                  >
                    {m === "permanent" ? "Permanent" : "Acting (temporary)"}
                  </button>
                ))}
              </div>

              {/* ── Permanent mode ── */}
              {mode === "permanent" && (
                <div className="flex flex-col gap-4">
                  <div className="rounded-xl p-4"
                       style={{ background: "var(--brand-navy-light)", border: "1px solid var(--brand-border)" }}>
                    <p className="text-[14px] font-medium mb-1" style={{ color: "var(--brand-text)" }}>
                      Activate a member as {nodeType === "cell" ? "Cell Shepherd" : "Buscentre Head"}
                    </p>
                    <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>
                      This gives them a permanent system login with the appropriate role scoped to {nodeName}.
                      Use this when you have a confirmed permanent appointment.
                    </p>
                  </div>

                  <Link href={activateUrl} onClick={onClose}>
                    <Button
                      className="w-full h-10 text-[14px] font-medium"
                      style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Go to Activate Member
                    </Button>
                  </Link>
                </div>
              )}

              {/* ── Acting mode ── */}
              {mode === "acting" && (
                <div className="flex flex-col gap-4">
                  <div className="rounded-xl p-4"
                       style={{ background: "#FEF3DC", border: "1px solid #F5D9A0" }}>
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#854F0B" }} />
                      <div>
                        <p className="text-[13px] font-medium" style={{ color: "#854F0B" }}>
                          Temporary coverage
                        </p>
                        <p className="text-[12px] mt-0.5" style={{ color: "#B87015" }}>
                          The assigned person keeps their primary role. They can switch between roles
                          via the role switcher. An acting-up flag will be logged.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-medium uppercase tracking-[0.04em]"
                           style={{ color: "var(--brand-muted)" }}>
                      Assign person <span style={{ color: "var(--brand-danger)" }}>*</span>
                    </label>

                    {loadingUsers ? (
                      <div className="h-10 rounded-lg animate-pulse"
                           style={{ background: "var(--brand-border)" }} />
                    ) : users.length === 0 ? (
                      <div className="rounded-lg px-3 py-2.5 text-[13px]"
                           style={{ background: "#FDECEA", color: "#791F1F" }}>
                        No eligible users found. Only {eligibleRoles.map((r) => ROLE_LABEL[r] ?? r).join(", ")} can act as {nodeType === "cell" ? "Cell Shepherd" : "Buscentre Head"}.
                      </div>
                    ) : (
                      <select
                        value={selectedId}
                        onChange={(e) => { setSelectedId(e.target.value); setError(""); }}
                        className="h-10 px-3 text-[14px] rounded-lg"
                        style={{ border: "1px solid var(--brand-border)", color: "var(--brand-text)", background: "#fff" }}
                      >
                        <option value="">— Select person —</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name ?? u.email}
                            {u.role ? ` · ${ROLE_LABEL[u.role.role] ?? u.role.role}` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {selectedUser && (
                    <div className="rounded-xl px-4 py-3 flex items-start gap-3"
                         style={{ background: "var(--brand-navy-light)" }}>
                      <div className="flex items-center justify-center rounded-lg text-[12px] font-semibold shrink-0"
                           style={{ width: 32, height: 32, background: "var(--brand-navy)", color: "#fff" }}>
                        {(selectedUser.name ?? selectedUser.email).slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[14px] font-medium" style={{ color: "var(--brand-text)" }}>
                          {selectedUser.name ?? selectedUser.email}
                        </p>
                        <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
                          Primary role: {selectedUser.role ? (ROLE_LABEL[selectedUser.role.role] ?? selectedUser.role.role) : "—"}
                        </p>
                        <p className="text-[12px] mt-0.5" style={{ color: "var(--brand-muted)" }}>
                          Will act as: {nodeType === "cell" ? "Cell Shepherd" : "Buscentre Head"} · {nodeName}
                        </p>
                      </div>
                    </div>
                  )}

                  {error && (
                    <p className="text-[13px]" style={{ color: "var(--brand-danger)" }}>{error}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </SheetBody>

        {!success && mode === "acting" && (
          <SheetFooter>
            <Button type="button" variant="outline" onClick={onClose}
                    className="h-9 text-[13px]" style={{ borderRadius: 8 }}>
              Cancel
            </Button>
            <Button
              onClick={assignActing}
              disabled={saving || !selectedId}
              className="h-9 text-[13px]"
              style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}
            >
              {saving ? "Assigning…" : "Assign acting role"}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
