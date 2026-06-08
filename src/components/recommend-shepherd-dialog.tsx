"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Award, Loader2, CheckCircle2 } from "lucide-react";

type Props = {
  memberId:   string;
  memberName: string;
  onDone:     () => void;
};

/**
 * Lets a cell shepherd put a member forward as a shepherd candidate.
 * Surfaces to every level above the cell so they can later certify them as
 * ready (a separate step — recommending here doesn't make anyone a shepherd).
 */
export function RecommendShepherdDialog({ memberId, memberName, onDone }: Props) {
  const [open,    setOpen]    = useState(false);
  const [notes,   setNotes]   = useState("");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState(false);

  function close() {
    setOpen(false);
    setNotes(""); setError(""); setSuccess(false);
  }

  async function submit() {
    setSaving(true); setError("");
    const res = await fetch("/api/org/shepherd-candidates", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ memberId, notes: notes.trim() || undefined }),
    });
    setSaving(false);

    if (res.ok) {
      setSuccess(true);
      onDone();
      setTimeout(close, 1200);
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed to submit recommendation.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors hover:opacity-80 shrink-0"
        style={{ background: "#EAF3EE", color: "#1A8C6C" }}
      >
        <Award className="h-3 w-3" /> Recommend as shepherd
      </button>

      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-[440px]">
          {success ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="h-10 w-10" style={{ color: "var(--brand-success)" }} />
              <p className="text-[15px] font-semibold" style={{ color: "var(--brand-text)" }}>Recommendation submitted</p>
              <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>
                Buscentre, MC and branch leadership can now see {memberName} is ready to be considered.
              </p>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Recommend {memberName} as a shepherd</DialogTitle>
                <DialogDescription>
                  This flags them to everyone above you in the chain of command as ready to be
                  considered for shepherding — it doesn&apos;t place them in a role by itself.
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-1.5 py-2">
                <label className="text-[12px] font-medium uppercase tracking-[0.04em]" style={{ color: "var(--brand-muted)" }}>
                  Notes <span style={{ color: "var(--brand-muted)", textTransform: "none", fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="What have you observed — outreach involvement, informal mentoring, faithfulness…"
                  className="w-full px-3 py-2 text-[13px] rounded-lg resize-none"
                  style={{ border: "1px solid var(--brand-border)", color: "var(--brand-text)", background: "#fff" }}
                />
              </div>

              {error && <p className="text-[13px]" style={{ color: "var(--brand-danger)" }}>{error}</p>}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={close} className="h-9 text-[13px]" style={{ borderRadius: 8 }}>
                  Cancel
                </Button>
                <Button onClick={submit} disabled={saving} className="h-9 text-[13px]"
                        style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Submit recommendation"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
