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
import { ExternalLink, UserCheck, AlertTriangle, UserCircle, Loader2, RefreshCw, UserMinus } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type NodeType = "cell" | "buscentre" | "mc" | "branch";

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
const ELIGIBLE_ACTING_ROLES: Record<NodeType, string[]> = {
  cell:      ["buscentre_head", "mc_pastor", "chief_shepherd", "admin"],
  buscentre: ["cell_shepherd", "buscentre_head", "mc_pastor", "chief_shepherd", "admin"],
  mc:        ["buscentre_head", "cell_shepherd", "chief_shepherd", "admin"],
  branch:    ["mc_pastor", "buscentre_head", "cell_shepherd", "admin"],
};

// Target role for each node type
const TARGET_ROLE: Record<NodeType, string> = {
  cell:      "cell_shepherd",
  buscentre: "buscentre_head",
  mc:        "mc_pastor",
  branch:    "chief_shepherd",
};

const NODE_LABEL: Record<NodeType, string> = {
  cell:      "Cell Shepherd",
  buscentre: "Buscentre Head",
  mc:        "MC Pastor",
  branch:    "Chief Shepherd",
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

type CurrentHead = {
  userId: string; name: string | null; email: string;
  primaryRole: string; isActing: boolean;
};

export function AssignHeadSheet({
  open, onClose, onAssigned,
  nodeType, nodeId, nodeName,
  branchId, mcId, buscentreId, cellId,
}: AssignHeadSheetProps) {
  const [mode,        setMode]        = useState<"permanent" | "acting">("permanent");
  const [users,       setUsers]       = useState<UserOption[]>([]);
  const [loadingUsers,setLoadingUsers] = useState(false);
  const [selectedId,  setSelectedId]  = useState("");
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");
  const [success,     setSuccess]     = useState(false);

  // Permanent reassign state
  const [allUsers,        setAllUsers]        = useState<UserOption[]>([]);
  const [loadingAllUsers, setLoadingAllUsers] = useState(false);
  const [reassignId,      setReassignId]      = useState("");
  const [reassigning,     setReassigning]     = useState(false);

  // Current head — fetched when sheet opens
  const [currentHead,    setCurrentHead]    = useState<CurrentHead | null>(null);
  const [loadingHead,    setLoadingHead]    = useState(false);
  const [removingActing, setRemovingActing] = useState(false);
  const [changing,       setChanging]       = useState(false); // show the assign UI to replace current

  const targetRole    = TARGET_ROLE[nodeType];
  const eligibleRoles = ELIGIBLE_ACTING_ROLES[nodeType];

  // Fetch current head whenever the sheet opens
  useEffect(() => {
    if (!open) return;
    setLoadingHead(true);
    setCurrentHead(null);
    setChanging(false);
    fetch(`/api/org/current-head?nodeType=${nodeType}&nodeId=${nodeId}`)
      .then((r) => r.json())
      .then((d) => { setCurrentHead(d.head ?? null); setLoadingHead(false); })
      .catch(() => setLoadingHead(false));
  }, [open, nodeType, nodeId]);

  // Fetch all active users for permanent reassignment
  useEffect(() => {
    if (!open) return;
    setLoadingAllUsers(true);
    fetch("/api/org/users")
      .then((r) => r.json())
      .then((d: UserOption[]) => { setAllUsers(d); setLoadingAllUsers(false); })
      .catch(() => setLoadingAllUsers(false));
  }, [open]);

  // Remove acting role
  async function handleRemoveActing() {
    if (!currentHead) return;
    setRemovingActing(true);
    await fetch("/api/org/acting", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentHead.userId, actingAs: targetRole, nodeId }),
    });
    setRemovingActing(false);
    setCurrentHead(null);
    onAssigned();
  }

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
      setReassignId("");
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

  async function assignPermanent() {
    if (!reassignId) { setError("Select a person."); return; }
    setReassigning(true); setError("");

    const res = await fetch("/api/org/reassign", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId:      reassignId,
        role:        targetRole,
        branchId:    branchId    ?? null,
        mcId:        mcId        ?? null,
        buscentreId: buscentreId ?? null,
        cellId:      cellId      ?? null,
      }),
    });

    setReassigning(false);
    if (res.ok) {
      setSuccess(true);
      setTimeout(() => { onAssigned(); onClose(); }, 1500);
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed to reassign role.");
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
            Assign {NODE_LABEL[nodeType]}
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
                {reassignId
                  ? "Role permanently assigned"
                  : selectedUser ? "Acting role assigned" : "Acting role removed"}
              </p>
              <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>
                {reassignId
                  ? `${allUsers.find((u) => u.id === reassignId)?.name ?? "User"} is now ${NODE_LABEL[nodeType]} for ${nodeName}.`
                  : selectedUser
                  ? `${selectedUser.name} can now switch to this role via the role switcher.`
                  : "The acting assignment has been cleared."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">

              {/* ── Current head banner ── */}
              {loadingHead ? (
                <div className="flex items-center gap-2 rounded-xl px-4 py-3"
                     style={{ background: "var(--brand-navy-light)", border: "1px solid var(--brand-border)" }}>
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" style={{ color: "var(--brand-muted)" }} />
                  <span className="text-[13px]" style={{ color: "var(--brand-muted)" }}>Checking current assignment…</span>
                </div>
              ) : currentHead && !changing ? (
                <div className="rounded-xl overflow-hidden"
                     style={{ border: "1px solid var(--brand-border)" }}>
                  {/* Header */}
                  <div className="px-4 py-2.5 flex items-center gap-2"
                       style={{ background: "#F9FAFB", borderBottom: "1px solid var(--brand-border)" }}>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.05em]"
                          style={{ color: "var(--brand-muted)" }}>
                      Currently serving
                    </span>
                    {currentHead.isActing && (
                      <span className="rounded-pill text-[10px] font-bold px-2 py-0.5"
                            style={{ background: "#FEF3DC", color: "#854F0B" }}>
                        acting
                      </span>
                    )}
                  </div>
                  {/* Person row */}
                  <div className="px-4 py-3 flex items-center gap-3">
                    <div className="flex items-center justify-center rounded-xl shrink-0 text-[13px] font-bold"
                         style={{ width: 40, height: 40, background: "var(--brand-navy)", color: "#fff" }}>
                      {(currentHead.name ?? currentHead.email).split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold" style={{ color: "var(--brand-text)" }}>
                        {currentHead.name ?? currentHead.email}
                      </p>
                      <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
                        Primary role: {currentHead.primaryRole}
                      </p>
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="px-4 pb-3 flex gap-2">
                    <button
                      onClick={() => setChanging(true)}
                      className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium transition-colors hover:opacity-80"
                      style={{ background: "var(--brand-navy)", color: "#fff" }}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      {currentHead.isActing ? "Reassign acting role" : "Change head"}
                    </button>
                    {currentHead.isActing && (
                      <button
                        onClick={handleRemoveActing}
                        disabled={removingActing}
                        className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium transition-colors hover:opacity-80 disabled:opacity-50"
                        style={{ background: "#FDECEA", color: "#791F1F", border: "1px solid #FCA5A5" }}
                      >
                        {removingActing
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <UserMinus className="h-3.5 w-3.5" />}
                        End acting role
                      </button>
                    )}
                  </div>
                </div>
              ) : !currentHead && !loadingHead ? (
                <div className="flex items-center gap-2 rounded-xl px-4 py-3"
                     style={{ background: "#F0FDF4", border: "1px solid #86EFAC" }}>
                  <UserCircle className="h-4 w-4 shrink-0" style={{ color: "#059669" }} />
                  <span className="text-[13px]" style={{ color: "#065F46" }}>
                    No one currently assigned — set one below
                  </span>
                </div>
              ) : null}

              {/* Show assignment form when no current head, or when changing */}
              {(!currentHead || changing) && (
                <>
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
                <div className="flex flex-col gap-5">

                  {/* Option A — reassign an existing user */}
                  <div className="flex flex-col gap-3">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.05em]"
                       style={{ color: "var(--brand-muted)" }}>
                      Reassign existing user
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {loadingAllUsers ? (
                        <div className="h-10 rounded-lg animate-pulse"
                             style={{ background: "var(--brand-border)" }} />
                      ) : (
                        <select
                          value={reassignId}
                          onChange={(e) => { setReassignId(e.target.value); setError(""); }}
                          className="h-10 px-3 text-[14px] rounded-lg"
                          style={{ border: "1px solid var(--brand-border)", color: "var(--brand-text)", background: "#fff" }}
                        >
                          <option value="">— Select person —</option>
                          {allUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name ?? u.email}
                              {u.role ? ` · ${ROLE_LABEL[u.role.role] ?? u.role.role}` : ""}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {reassignId && (() => {
                      const u = allUsers.find((x) => x.id === reassignId);
                      return u ? (
                        <div className="rounded-xl px-4 py-3 flex items-start gap-3"
                             style={{ background: "var(--brand-navy-light)", border: "1px solid var(--brand-border)" }}>
                          <div className="flex items-center justify-center rounded-lg text-[12px] font-semibold shrink-0"
                               style={{ width: 32, height: 32, background: "var(--brand-navy)", color: "#fff" }}>
                            {(u.name ?? u.email).slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-[14px] font-medium" style={{ color: "var(--brand-text)" }}>
                              {u.name ?? u.email}
                            </p>
                            <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
                              Current role: {u.role ? (ROLE_LABEL[u.role.role] ?? u.role.role) : "none"}
                            </p>
                            <p className="text-[12px] mt-0.5 font-medium" style={{ color: "var(--brand-navy)" }}>
                              New role: {NODE_LABEL[nodeType]} · {nodeName}
                            </p>
                          </div>
                        </div>
                      ) : null;
                    })()}

                    {error && (
                      <p className="text-[13px]" style={{ color: "var(--brand-danger)" }}>{error}</p>
                    )}

                    <Button
                      onClick={assignPermanent}
                      disabled={reassigning || !reassignId}
                      className="h-10 text-[14px] font-medium"
                      style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}
                    >
                      {reassigning ? "Reassigning…" : `Assign as ${NODE_LABEL[nodeType]}`}
                    </Button>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px" style={{ background: "var(--brand-border)" }} />
                    <span className="text-[12px]" style={{ color: "var(--brand-muted)" }}>or activate a new member</span>
                    <div className="flex-1 h-px" style={{ background: "var(--brand-border)" }} />
                  </div>

                  {/* Option B — activate a brand-new member */}
                  <div className="flex flex-col gap-3">
                    <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>
                      Use this if the person doesn&apos;t have a system login yet.
                    </p>
                    <Link href={activateUrl} onClick={onClose}>
                      <Button
                        variant="outline"
                        className="w-full h-10 text-[14px] font-medium"
                        style={{ borderRadius: 8, borderColor: "var(--brand-border)" }}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Go to Activate Member
                      </Button>
                    </Link>
                  </div>
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
                        No eligible users found. Only {eligibleRoles.map((r) => ROLE_LABEL[r] ?? r).join(", ")} can act as {NODE_LABEL[nodeType]}.
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
                          Will act as: {NODE_LABEL[nodeType]} · {nodeName}
                        </p>
                      </div>
                    </div>
                  )}

                  {error && (
                    <p className="text-[13px]" style={{ color: "var(--brand-danger)" }}>{error}</p>
                  )}
                </div>
              )}
                </>
              )}
            </div>
          )}
        </SheetBody>

        {!success && mode === "acting" && (!currentHead || changing) && (
          <SheetFooter>
            <Button type="button" variant="outline"
                    onClick={() => changing ? setChanging(false) : onClose()}
                    className="h-9 text-[13px]" style={{ borderRadius: 8 }}>
              {changing ? "Back" : "Cancel"}
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
