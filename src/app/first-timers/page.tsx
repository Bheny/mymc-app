"use client";

import { useCallback, useEffect, useState } from "react";
import { useActiveRole } from "@/hooks/use-active-role";
import { Users, Phone, MapPin, ChevronDown } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ReachOutStatus = "GREEN" | "YELLOW" | "RED" | null;

type FirstTimer = {
  id:              string;
  firstName:       string;
  lastName:        string;
  phone:           string | null;
  location:        string | null;
  referredBy:      string | null;
  intent:          "JUST_VISITING" | "UNDECIDED" | "WANTS_TO_JOIN";
  reachOutStatus:  ReachOutStatus;
  reachOutNote:    string | null;
  reachedOutAt:    string | null;
  convertedToMemberId: string | null;
  createdAt:       string;
  cell:    { id: string; name: string };
  service: { date: string; type: string };
};

type Summary = { total: number; green: number; yellow: number; red: number; unreached: number };

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; color: string }> = {
  GREEN:    { label: "Committed",   dot: "#059669", bg: "#E0F4EC", color: "#085041" },
  YELLOW:   { label: "Promising",   dot: "#D97706", bg: "#FEF3DC", color: "#854F0B" },
  RED:      { label: "Not a fit",   dot: "#DC2626", bg: "#FDECEA", color: "#791F1F" },
  unreached:{ label: "Not reached", dot: "#9CA3AF", bg: "#F3F4F6", color: "#6B7280" },
};

const INTENT_LABEL: Record<string, string> = {
  WANTS_TO_JOIN: "Wants to join",
  UNDECIDED:     "Undecided",
  JUST_VISITING: "Just visiting",
};

const SVC_LABEL: Record<string, string> = {
  LC_LIVE: "LC Live", MGS: "MGS", SHEPHERDS_MEETING: "Shepherds Mtg", SPECIAL_MEETING: "Special",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Reach-out modal ─────────────────────────────────────────────────────────

const OUTCOME_OPTIONS: { status: ReachOutStatus; label: string; sub: string; dot: string; bg: string; color: string; border: string }[] = [
  {
    status: "GREEN", label: "Committed",
    sub:    "Expressed clear interest — likely to become a member",
    dot: "#059669", bg: "#E0F4EC", color: "#085041", border: "#86EFAC",
  },
  {
    status: "YELLOW", label: "Promising",
    sub:    "Shows potential — needs more follow-up before deciding",
    dot: "#D97706", bg: "#FEF3DC", color: "#854F0B", border: "#FCD34D",
  },
  {
    status: "RED", label: "Not a fit",
    sub:    "Not interested or unlikely to become a member right now",
    dot: "#DC2626", bg: "#FDECEA", color: "#791F1F", border: "#FCA5A5",
  },
];

function StatusSelector({
  current, onSelect,
}: {
  current: ReachOutStatus;
  onSelect: (s: ReachOutStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const cfg = current ? STATUS_CONFIG[current] : STATUS_CONFIG.unreached;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11px] font-semibold transition-opacity hover:opacity-80"
        style={{ background: cfg.bg, color: cfg.color }}
      >
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.dot }} />
        {cfg.label}
        <ChevronDown className="h-3 w-3" style={{ opacity: 0.6 }} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full rounded-2xl flex flex-col overflow-hidden"
            style={{ maxWidth: 420, background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--brand-border)" }}>
              <p className="text-[15px] font-semibold" style={{ color: "var(--brand-text)" }}>
                Mark reach-out result
              </p>
              <p className="text-[13px] mt-0.5" style={{ color: "var(--brand-muted)" }}>
                How did the follow-up go?
              </p>
            </div>

            {/* Outcome options */}
            <div className="flex flex-col gap-3 p-4">
              {OUTCOME_OPTIONS.map(({ status, label, sub, dot, bg, color, border }) => (
                <button
                  key={status}
                  onClick={() => { onSelect(status); setOpen(false); }}
                  className="text-left rounded-xl px-4 py-3.5 transition-all"
                  style={{
                    background:  bg,
                    border:      `2px solid ${current === status ? border : "transparent"}`,
                    outline:     "none",
                  }}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: dot }} />
                    <span className="text-[14px] font-semibold" style={{ color }}>
                      {label}
                    </span>
                    {current === status && (
                      <span className="text-[11px] font-medium rounded-pill px-1.5 py-0.5 ml-auto"
                            style={{ background: dot, color: "#fff" }}>
                        current
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] ml-5" style={{ color }}>{sub}</p>
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-4 pb-4">
              {current !== null && (
                <button
                  onClick={() => { onSelect(null); setOpen(false); }}
                  className="flex-1 h-10 rounded-lg text-[13px] font-medium transition-colors"
                  style={{ border: "1px solid var(--brand-border)", color: "var(--brand-muted)" }}
                >
                  Reset to not reached
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="flex-1 h-10 rounded-lg text-[13px] font-medium transition-colors"
                style={{ background: "var(--brand-navy)", color: "#fff" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── First Timer row ──────────────────────────────────────────────────────────

function FTRow({ ft, onUpdated }: { ft: FirstTimer; onUpdated: (id: string, status: ReachOutStatus, note: string | null) => void }) {
  const [note,    setNote]    = useState(ft.reachOutNote ?? "");
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);

  async function updateStatus(status: ReachOutStatus) {
    setSaving(true);
    const res = await fetch(`/api/first-timers/${ft.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reachOutStatus: status, reachOutNote: note || null }),
    });
    setSaving(false);
    if (res.ok) {
      const d = await res.json();
      onUpdated(ft.id, d.reachOutStatus, d.reachOutNote);
    }
  }

  async function saveNote() {
    setSaving(true);
    const res = await fetch(`/api/first-timers/${ft.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reachOutStatus: ft.reachOutStatus, reachOutNote: note || null }),
    });
    setSaving(false);
    if (res.ok) { setEditing(false); onUpdated(ft.id, ft.reachOutStatus, note || null); }
  }

  const rowBg =
    ft.reachOutStatus === "GREEN"  ? "#F0FDF4" :
    ft.reachOutStatus === "YELLOW" ? "#FFFBEB" :
    ft.reachOutStatus === "RED"    ? "#FFF5F5" : "#fff";

  return (
    <div className="flex flex-col" style={{ borderBottom: "1px solid var(--brand-border)", background: rowBg }}>
      {/* Main row */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Colour stripe */}
        <div className="w-1 self-stretch rounded-full shrink-0 mt-0.5"
             style={{ background: ft.reachOutStatus ? STATUS_CONFIG[ft.reachOutStatus].dot : "#E5E7EB" }} />

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-semibold" style={{ color: "var(--brand-text)" }}>
              {ft.firstName} {ft.lastName}
            </span>
            {ft.convertedToMemberId && (
              <span className="rounded-pill text-[10px] font-semibold px-2 py-0.5"
                    style={{ background: "#E0F4EC", color: "#085041" }}>✓ Member</span>
            )}
            <span className="rounded-pill text-[10px] font-medium px-1.5 py-0.5"
                  style={{ background: "var(--brand-navy-light)", color: "var(--brand-navy)" }}>
              {INTENT_LABEL[ft.intent]}
            </span>
          </div>
          <div className="flex flex-wrap gap-3 mt-1">
            {ft.phone && (
              <span className="flex items-center gap-1 text-[12px]" style={{ color: "var(--brand-muted)" }}>
                <Phone className="h-3 w-3" /> {ft.phone}
              </span>
            )}
            {ft.location && (
              <span className="flex items-center gap-1 text-[12px]" style={{ color: "var(--brand-muted)" }}>
                <MapPin className="h-3 w-3" /> {ft.location}
              </span>
            )}
            <span className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
              {SVC_LABEL[ft.service.type] ?? ft.service.type} · {fmt(ft.service.date)}
            </span>
            {ft.referredBy && (
              <span className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
                Brought by: {ft.referredBy}
              </span>
            )}
          </div>
          {/* Note preview */}
          {ft.reachOutNote && !editing && (
            <p className="text-[12px] mt-1.5 italic" style={{ color: "var(--brand-muted)" }}>
              &ldquo;{ft.reachOutNote}&rdquo;
            </p>
          )}
          {/* Note edit */}
          {editing && (
            <div className="flex gap-2 mt-2">
              <input
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note about this first timer…"
                className="flex-1 h-8 px-2 text-[13px] rounded-lg"
                style={{ border: "1px solid var(--brand-border)", outline: "none", background: "#fff" }}
                onKeyDown={(e) => { if (e.key === "Enter") saveNote(); if (e.key === "Escape") setEditing(false); }}
              />
              <button onClick={saveNote} disabled={saving}
                      className="h-8 px-3 text-[12px] font-medium rounded-lg"
                      style={{ background: "var(--brand-navy)", color: "#fff" }}>
                {saving ? "…" : "Save"}
              </button>
            </div>
          )}
        </div>

        {/* Right: status + note button */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <StatusSelector current={ft.reachOutStatus} onSelect={updateStatus} />
          <button onClick={() => setEditing((e) => !e)}
                  className="text-[11px]" style={{ color: "var(--brand-muted)" }}>
            {editing ? "cancel" : ft.reachOutNote ? "edit note" : "+ note"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const FILTERS: { key: string; label: string }[] = [
  { key: "all",      label: "All"         },
  { key: "unreached",label: "Not Reached" },
  { key: "GREEN",    label: "Committed"   },
  { key: "YELLOW",   label: "Promising"   },
  { key: "RED",      label: "Not a Fit"   },
];

export default function FirstTimersPage() {
  const { activeView, ready } = useActiveRole();
  const actingCellId      = activeView?.isActing && activeView.cellId      ? activeView.cellId      : null;
  const actingBuscentreId = activeView?.isActing && activeView.buscentreId ? activeView.buscentreId : null;

  const [filter,      setFilter]      = useState("unreached");
  const [firstTimers, setFirstTimers] = useState<FirstTimer[]>([]);
  const [summary,     setSummary]     = useState<Summary>({ total: 0, green: 0, yellow: 0, red: 0, unreached: 0 });
  const [loading,     setLoading]     = useState(true);

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    const params = new URLSearchParams({ take: "100" });
    if (filter !== "all") params.set("status", filter);
    if (actingCellId)      params.set("actingCellId",      actingCellId);
    if (actingBuscentreId) params.set("actingBuscentreId", actingBuscentreId);
    const res = await fetch(`/api/first-timers?${params}`);
    if (res.ok) {
      const d = await res.json();
      setFirstTimers(d.firstTimers ?? []);
      setSummary(d.summary ?? { total: 0, green: 0, yellow: 0, red: 0, unreached: 0 });
    }
    setLoading(false);
  }, [ready, filter, actingCellId, actingBuscentreId]);

  useEffect(() => { load(); }, [load]);

  function handleUpdated(id: string, status: ReachOutStatus, note: string | null) {
    setFirstTimers((prev) => prev.map((ft) =>
      ft.id === id ? { ...ft, reachOutStatus: status, reachOutNote: note } : ft
    ));
    // Refresh summary counts after a status change
    load();
  }

  const summaryCards = [
    { label: "Total",       value: summary.total,     dot: "#6B7280", bg: "#F9FAFB" },
    { label: "Not Reached", value: summary.unreached,  dot: "#9CA3AF", bg: "#F3F4F6" },
    { label: "Promising",   value: summary.yellow,     dot: "#D97706", bg: "#FEF3DC" },
    { label: "Committed",   value: summary.green,      dot: "#059669", bg: "#E0F4EC" },
    { label: "Not a Fit",   value: summary.red,        dot: "#DC2626", bg: "#FDECEA" },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[900px] mx-auto pb-20 lg:pb-8">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold" style={{ color: "var(--brand-text)" }}>
          First Timers
        </h1>
        <p className="text-[14px] mt-0.5" style={{ color: "var(--brand-muted)" }}>
          Track reach-outs and follow-ups for new visitors
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {summaryCards.map(({ label, value, dot, bg }) => (
          <div key={label} className="rounded-xl px-4 py-3 flex flex-col gap-1"
               style={{ border: "1px solid var(--brand-border)", background: bg }}>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot }} />
              <span className="text-[11px] font-medium uppercase tracking-[0.05em]"
                    style={{ color: "var(--brand-muted)" }}>
                {label}
              </span>
            </div>
            <span className="text-[28px] font-bold leading-none" style={{ color: "var(--brand-text)" }}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className="px-3 py-1.5 rounded-pill text-[13px] font-medium transition-colors"
            style={filter === key
              ? { background: "var(--brand-navy)", color: "#fff" }
              : { background: "#fff", color: "var(--brand-muted)", border: "1px solid var(--brand-border)" }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
      ) : firstTimers.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ border: "1px solid var(--brand-border)" }}>
          <Users style={{ width: 40, height: 40, color: "var(--brand-muted)", margin: "0 auto 12px" }} />
          <p className="text-[14px] font-medium mb-1" style={{ color: "var(--brand-text)" }}>
            {filter === "unreached" ? "Everyone has been reached out to!" : "No first timers in this category"}
          </p>
          <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>
            {filter === "unreached" ? "Great work! Switch to All to see everyone." : "Try a different filter."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--brand-border)" }}>
          {/* Column headers */}
          <div className="px-4 py-2.5 flex items-center"
               style={{ background: "#F9FAFB", borderBottom: "1px solid var(--brand-border)" }}>
            <span className="flex-1 text-[11px] font-medium uppercase tracking-[0.05em]"
                  style={{ color: "var(--brand-muted)" }}>
              {firstTimers.length} first timer{firstTimers.length !== 1 ? "s" : ""}
            </span>
            <span className="text-[11px] font-medium uppercase tracking-[0.05em]"
                  style={{ color: "var(--brand-muted)" }}>
              Reach-out status
            </span>
          </div>
          {firstTimers.map((ft) => (
            <FTRow key={ft.id} ft={ft} onUpdated={handleUpdated} />
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 rounded-xl px-5 py-4 flex flex-wrap gap-4"
           style={{ background: "var(--brand-navy-light)", border: "1px solid var(--brand-border)" }}>
        <p className="text-[12px] font-semibold w-full" style={{ color: "var(--brand-text)" }}>
          Colour guide
        </p>
        {[
          { dot: "#059669", label: "Green — Expressed interest, likely to become a member" },
          { dot: "#D97706", label: "Yellow — Shows promise, needs more follow-up" },
          { dot: "#DC2626", label: "Red — Not a fit or not interested at this time" },
          { dot: "#9CA3AF", label: "Grey — Not yet reached out to" },
        ].map(({ dot, label }) => (
          <div key={label} className="flex items-center gap-2 text-[12px]" style={{ color: "var(--brand-muted)" }}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: dot }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
