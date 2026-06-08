"use client";

import { useEffect, useState } from "react";
import { Award, CheckCircle2, GraduationCap, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useActiveRole } from "@/hooks/use-active-role";
import { useRoleGuard } from "@/hooks/use-role-guard";

// ─── Types ────────────────────────────────────────────────────────────────────

type Candidate = {
  id:               string;
  status:           "RECOMMENDED" | "CERTIFIED";
  notes:            string | null;
  recommendedAt:    string;
  certifiedAt:      string | null;
  wtgfStatus:       "NOT_TAKEN" | "SCHEDULED" | "PASSED" | "FAILED";
  wtgfDate:         string | null;
  member:           { id: string; firstName: string; lastName: string; gender: string | null };
  cell:             { id: string; name: string };
  recommendedBy:    { id: string; name: string };
  certifiedBy:      { id: string; name: string } | null;
  wtgfRecordedBy:   { id: string; name: string } | null;
};

const ROLE_RANK: Record<string, number> = {
  admin: 0, chief_shepherd: 1, mc_pastor: 2, buscentre_head: 3, cell_shepherd: 4, shepherd: 5,
};

const WTGF_OPTIONS: { value: Candidate["wtgfStatus"]; label: string }[] = [
  { value: "NOT_TAKEN", label: "Not yet taken" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "PASSED",    label: "Passed" },
  { value: "FAILED",    label: "Failed" },
];

function fmtDate(d: string | null): string | null {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Candidate["status"] }) {
  const isCertified = status === "CERTIFIED";
  return (
    <span
      className="rounded-pill text-[11px] font-medium px-2.5 py-1 inline-flex items-center gap-1"
      style={isCertified
        ? { background: "#E8F0FE", color: "#1D4ED8" }
        : { background: "#EAF3EE", color: "#1A8C6C" }}
    >
      {isCertified ? <ShieldCheck className="h-3 w-3" /> : <Award className="h-3 w-3" />}
      {isCertified ? "Certified" : "Recommended"}
    </span>
  );
}

const WTGF_BADGE_STYLE: Record<Candidate["wtgfStatus"], { bg: string; fg: string; label: string }> = {
  NOT_TAKEN: { bg: "#F1F2F4", fg: "var(--brand-muted)", label: "WTGF: not taken" },
  SCHEDULED: { bg: "#FEF3DC", fg: "#854F0B",            label: "WTGF: scheduled" },
  PASSED:    { bg: "#EAF3EE", fg: "#1A8C6C",            label: "WTGF: passed" },
  FAILED:    { bg: "#FDECEA", fg: "#791F1F",            label: "WTGF: failed" },
};

function WtgfBadge({ status }: { status: Candidate["wtgfStatus"] }) {
  const s = WTGF_BADGE_STYLE[status];
  return (
    <span className="rounded-pill text-[11px] font-medium px-2.5 py-1" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
}

// ─── Certify confirmation modal ───────────────────────────────────────────────

function CertifyDialog({ candidate, onCertified }: { candidate: Candidate; onCertified: () => void }) {
  const [open,    setOpen]    = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  async function confirm() {
    setSaving(true); setError("");
    const res = await fetch(`/api/org/shepherd-candidates/${candidate.id}/certify`, { method: "POST" });
    setSaving(false);
    if (res.ok) { setOpen(false); onCertified(); }
    else { const d = await res.json().catch(() => ({})); setError(d.error ?? "Failed to certify."); }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="h-8 px-3 text-[12px] font-medium shrink-0"
        style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}
      >
        Certify as ready
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!saving) { setOpen(o); if (!o) setError(""); } }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Certify {candidate.member.firstName} {candidate.member.lastName}?</DialogTitle>
            <DialogDescription>
              This marks them as certified and ready to be considered for a shepherd slot anywhere
              in the hierarchy. Make sure this isn&apos;t being done by mistake — it can&apos;t be undone here.
            </DialogDescription>
          </DialogHeader>

          {error && <p className="text-[13px]" style={{ color: "var(--brand-danger)" }}>{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}
                    className="h-9 text-[13px]" style={{ borderRadius: 8 }}>
              Cancel
            </Button>
            <Button onClick={confirm} disabled={saving} className="h-9 text-[13px]"
                    style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Yes, certify"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── WTGF editor ──────────────────────────────────────────────────────────────

function WtgfEditor({ candidate, onUpdated }: { candidate: Candidate; onUpdated: () => void }) {
  const [open,   setOpen]   = useState(false);
  const [status, setStatus] = useState<Candidate["wtgfStatus"]>(candidate.wtgfStatus);
  const [date,   setDate]   = useState(candidate.wtgfDate ? candidate.wtgfDate.slice(0, 10) : "");
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  function toggle() {
    setOpen((o) => !o);
    setStatus(candidate.wtgfStatus);
    setDate(candidate.wtgfDate ? candidate.wtgfDate.slice(0, 10) : "");
    setError("");
  }

  async function save() {
    setSaving(true); setError("");
    const res = await fetch(`/api/org/shepherd-candidates/${candidate.id}/wtgf`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ wtgfStatus: status, wtgfDate: date || null }),
    });
    setSaving(false);
    if (res.ok) { setOpen(false); onUpdated(); }
    else { const d = await res.json().catch(() => ({})); setError(d.error ?? "Failed to update."); }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={toggle}
        className="self-start flex items-center gap-1.5 text-[12px] font-medium hover:underline"
        style={{ color: "var(--brand-navy)" }}
      >
        <GraduationCap className="h-3.5 w-3.5" />
        {open ? "Cancel WTGF update" : "Update WTGF status"}
      </button>

      {open && (
        <div className="flex flex-col gap-2 rounded-lg p-3" style={{ background: "#FAFAFA", border: "1px solid var(--brand-border)" }}>
          <div className="flex flex-wrap gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Candidate["wtgfStatus"])}
              className="h-9 px-3 text-[13px] rounded-lg"
              style={{ border: "1px solid var(--brand-border)", color: "var(--brand-text)", background: "#fff" }}
            >
              {WTGF_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 px-3 text-[13px] rounded-lg"
              style={{ border: "1px solid var(--brand-border)", color: "var(--brand-text)", background: "#fff" }}
            />
            <button
              onClick={save}
              disabled={saving}
              className="h-9 px-4 text-[13px] font-medium rounded-lg disabled:opacity-40 transition-opacity shrink-0"
              style={{ background: "var(--brand-navy)", color: "#fff" }}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
            </button>
          </div>
          {error && <p className="text-[12px]" style={{ color: "var(--brand-danger)" }}>{error}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Candidate card ───────────────────────────────────────────────────────────

function CandidateCard({ candidate, canCertify, onChanged }: {
  candidate:  Candidate;
  canCertify: boolean;
  onChanged:  () => void;
}) {
  const { member, cell } = candidate;

  return (
    <div className="rounded-xl p-5 flex flex-col gap-3" style={{ border: "1px solid var(--brand-border)" }}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center rounded-lg text-[13px] font-semibold shrink-0"
               style={{ width: 36, height: 36, background: "var(--brand-navy)", color: "#fff" }}>
            {member.firstName[0]}{member.lastName[0]}
          </div>
          <div>
            <p className="text-[14px] font-semibold" style={{ color: "var(--brand-text)" }}>
              {member.firstName} {member.lastName}
            </p>
            <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>{cell.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={candidate.status} />
          <WtgfBadge status={candidate.wtgfStatus} />
        </div>
      </div>

      <div className="flex flex-col gap-1 text-[12px]" style={{ color: "var(--brand-muted)" }}>
        <p>
          Recommended by <strong style={{ color: "var(--brand-text)" }}>{candidate.recommendedBy.name}</strong>
          {" "}· {fmtDate(candidate.recommendedAt)}
        </p>
        {candidate.status === "CERTIFIED" && candidate.certifiedBy && (
          <p>
            Certified by <strong style={{ color: "var(--brand-text)" }}>{candidate.certifiedBy.name}</strong>
            {" "}· {fmtDate(candidate.certifiedAt)}
          </p>
        )}
        {candidate.wtgfRecordedBy && (
          <p>
            WTGF recorded by <strong style={{ color: "var(--brand-text)" }}>{candidate.wtgfRecordedBy.name}</strong>
            {candidate.wtgfDate && <> · sat {fmtDate(candidate.wtgfDate)}</>}
          </p>
        )}
      </div>

      {candidate.notes && (
        <p className="text-[13px] italic rounded-lg px-3 py-2" style={{ background: "var(--brand-navy-light)", color: "var(--brand-text)" }}>
          &ldquo;{candidate.notes}&rdquo;
        </p>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
        <WtgfEditor candidate={candidate} onUpdated={onChanged} />
        {canCertify && candidate.status !== "CERTIFIED" && (
          <CertifyDialog candidate={candidate} onCertified={onChanged} />
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Filter = "all" | "recommended" | "certified";

export default function ShepherdCandidatesPage() {
  const { isLoading: roleLoading } = useRoleGuard(
    ["admin", "chief_shepherd", "mc_pastor", "buscentre_head", "cell_shepherd"]
  );
  const { activeView } = useActiveRole();

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [filter,     setFilter]     = useState<Filter>("all");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/org/shepherd-candidates");
    if (res.ok) setCandidates(await res.json());
    else { const d = await res.json().catch(() => ({})); setError(d.error ?? "Failed to load candidates."); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  if (roleLoading || loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[900px] mx-auto">
        <div className="skeleton h-8 w-64 mb-2 rounded-lg" />
        <div className="skeleton h-4 w-96 mb-6 rounded-lg" />
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-32 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const role        = activeView?.role ?? null;
  const canCertify  = role != null && (ROLE_RANK[role] ?? 99) < ROLE_RANK.cell_shepherd;

  const filtered = candidates.filter((c) => {
    if (filter === "recommended") return c.status === "RECOMMENDED";
    if (filter === "certified")   return c.status === "CERTIFIED";
    return true;
  });

  const recommendedCount = candidates.filter((c) => c.status === "RECOMMENDED").length;
  const certifiedCount   = candidates.filter((c) => c.status === "CERTIFIED").length;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[900px] mx-auto pb-20 lg:pb-8">
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold" style={{ color: "var(--brand-text)" }}>
          Shepherd Candidates
        </h1>
        <p className="mt-0.5 text-[14px]" style={{ color: "var(--brand-muted)" }}>
          Members put forward by cell shepherds as ready to be considered for shepherding,
          and their Welcome to God&apos;s Family (WTGF) progress.
        </p>
      </div>

      {error && (
        <p className="text-[13px] mb-4" style={{ color: "var(--brand-danger)" }}>{error}</p>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-5">
        {([
          { key: "all",         label: `All (${candidates.length})` },
          { key: "recommended", label: `Recommended (${recommendedCount})` },
          { key: "certified",   label: `Certified (${certifiedCount})` },
        ] as { key: Filter; label: string }[]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className="rounded-pill text-[12px] font-medium px-3 py-1.5 transition-colors"
            style={filter === tab.key
              ? { background: "var(--brand-navy)", color: "#fff" }
              : { background: "var(--brand-navy-light)", color: "var(--brand-muted)" }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ border: "1px solid var(--brand-border)" }}>
          <CheckCircle2 style={{ width: 40, height: 40, color: "var(--brand-muted)", margin: "0 auto 12px" }} />
          <p className="text-[14px] font-medium" style={{ color: "var(--brand-text)" }}>
            No candidates {filter !== "all" ? `in this category` : "yet"}
          </p>
          <p className="text-[14px] mt-1" style={{ color: "var(--brand-muted)" }}>
            Cell shepherds can put members forward from their cell roster.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((c) => (
            <CandidateCard key={c.id} candidate={c} canCertify={canCertify} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}
