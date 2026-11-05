"use client";

import { useState } from "react";
import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LeaderAttendancePicker } from "@/components/leader-attendance-picker";
import type { LeaderOption } from "@/lib/leader-attendance";

// The senior shepherds / MC pastors counted at an already-recorded service, with a way to correct them.

export type ServiceLeader = { visiting: boolean; member: { id: string; firstName: string; lastName: string; mcId: string | null } };

export function ServiceLeaders({ serviceId, cellId, type, date, leaders, onSaved }: {
  serviceId: string; cellId: string; type: string; date: string; leaders: ServiceLeader[]; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [options, setOptions] = useState<LeaderOption[]>([]);
  const [picked,  setPicked]  = useState<Set<string>>(new Set());
  const [busy,    setBusy]    = useState(false);

  async function startEdit() {
    setPicked(new Set(leaders.map((l) => l.member.id)));
    setEditing(true);
    const r = await fetch(`/api/attendance/leaders?cellId=${cellId}&type=${type}&date=${date.slice(0, 10)}&serviceId=${serviceId}`);
    setOptions(r.ok ? await r.json() : []);
  }

  async function save() {
    setBusy(true);
    const res = await fetch(`/api/services/${serviceId}/leaders`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leaders: Array.from(picked).map((memberId) => ({ memberId })) }),
    });
    setBusy(false);
    if (res.ok) { setEditing(false); onSaved(); toast({ title: "Leaders updated" }); }
    else { const d = await res.json().catch(() => ({})); toast({ title: "Couldn't update leaders", description: d.error, variant: "destructive" }); }
  }

  // Nothing to show or change for a service with no leaders and none who could be counted
  if (!editing && leaders.length === 0 && type !== "MGS" && type !== "LC_LIVE") return null;

  return (
    <div className="rounded-xl px-4 py-3 mb-4" style={{ background: "var(--surface)", border: "1px solid var(--brand-border)" }}>
      <div className="flex items-center gap-2">
        <Crown className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--brand-link)" }} />
        <span className="text-[13px] font-medium flex-1 min-w-0" style={{ color: "var(--brand-text)" }}>
          {leaders.length === 0 ? "No senior shepherds or pastors counted" : `${leaders.length} leader${leaders.length !== 1 ? "s" : ""} counted`}
        </span>
        {!editing && (
          <button className="text-[13px] font-medium h-8 px-2" style={{ color: "var(--brand-link)" }} onClick={startEdit}>
            {leaders.length === 0 ? "Add" : "Change"}
          </button>
        )}
      </div>

      {!editing && leaders.length > 0 && (
        <p className="text-[12px] mt-1.5" style={{ color: "var(--brand-muted)" }}>
          {leaders.map((l) => `${l.member.firstName} ${l.member.lastName}${l.visiting ? " (visiting)" : l.member.mcId ? " (MC pastor)" : ""}`).join(" · ")}
        </p>
      )}

      {editing && (
        <>
          {options.length === 0
            ? <p className="text-[12px] mt-2" style={{ color: "var(--brand-muted)" }}>No senior shepherds or pastors can be counted at this cell for this service. Set a home cell on their member profile.</p>
            : <LeaderAttendancePicker options={options} selected={picked} serviceType={type}
                onToggle={(id) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; })} />}
          <div className="flex gap-2 mt-3">
            <Button size="sm" disabled={busy} onClick={save} className="h-9 text-[13px]" style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}>
              {busy ? "Saving…" : "Save"}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(false)} className="h-9 text-[13px]">Cancel</Button>
          </div>
        </>
      )}
    </div>
  );
}
