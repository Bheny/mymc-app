"use client";

import { Loader2 } from "lucide-react";

export const STAGE_LABELS: Record<string, string> = {
  NEW: "New", CONTACTED: "Contacted", INVITED: "Invited", ATTENDED: "Attended", CONVERTED: "Member",
  NOT_INTERESTED: "Not interested", UNREACHABLE: "Unreachable", OUT_OF_AREA: "Out of area", DO_NOT_CONTACT: "Do not contact",
};

export const OUTREACH_TYPES: Record<string, string> = {
  STREET: "Street", DOOR_TO_DOOR: "Door to door", CAMPUS: "Campus", MARKET: "Market",
  EVENT: "Event", ONLINE: "Online", OTHER: "Other",
};

export const RESPONSE_LABELS: Record<string, string> = {
  RECEIVED_CHRIST: "Received Christ", INTERESTED: "Interested", NEUTRAL: "Neutral", DECLINED: "Declined",
};

export const SERVICE_LABELS: Record<string, string> = { LC_LIVE: "LC Live (Wed)", MGS: "MGS (Sun)", SPECIAL_MEETING: "Special meeting" };

const TONES: Record<string, { bg: string; fg: string }> = {
  ok:      { bg: "var(--tint-ok-bg)",     fg: "var(--tint-ok-fg)" },
  warn:    { bg: "var(--tint-warn-bg)",   fg: "var(--tint-warn-fg)" },
  danger:  { bg: "var(--tint-danger-bg)", fg: "var(--tint-danger-fg)" },
  neutral: { bg: "var(--brand-navy-light)", fg: "var(--brand-muted)" },
  brand:   { bg: "var(--brand-navy-light)", fg: "var(--brand-link)" },
};

const STAGE_TONE: Record<string, string> = {
  NEW: "neutral", CONTACTED: "brand", INVITED: "warn", ATTENDED: "ok", CONVERTED: "ok",
  NOT_INTERESTED: "danger", UNREACHABLE: "danger", OUT_OF_AREA: "danger", DO_NOT_CONTACT: "danger",
};
const STATUS_TONE: Record<string, string> = { PLANNED: "brand", ONGOING: "warn", COMPLETED: "ok", CANCELLED: "danger" };

export function Badge({ label, tone }: { label: string; tone: keyof typeof TONES | string }) {
  const t = TONES[tone] ?? TONES.neutral;
  return (
    <span className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
          style={{ background: t.bg, color: t.fg }}>{label}</span>
  );
}
export const StageBadge  = ({ stage }:  { stage: string })  => <Badge label={STAGE_LABELS[stage] ?? stage} tone={STAGE_TONE[stage] ?? "neutral"} />;
export const StatusBadge = ({ status }: { status: string }) => <Badge label={status.charAt(0) + status.slice(1).toLowerCase()} tone={STATUS_TONE[status] ?? "neutral"} />;

export const inputStyle = { border: "1px solid var(--brand-border)", background: "var(--surface)", outline: "none" } as const;
export const inputCls   = "h-10 px-3 text-[14px] rounded-lg w-full";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-medium uppercase tracking-[0.04em]" style={{ color: "var(--brand-muted)" }}>{label}</label>
      {children}
    </div>
  );
}

export function PrimaryButton({ busy, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button {...rest} disabled={busy || rest.disabled}
            className={`h-10 px-5 text-[13px] font-medium rounded-lg disabled:opacity-50 inline-flex items-center justify-center gap-2 ${rest.className ?? ""}`}
            style={{ background: "var(--brand-navy)", color: "#fff" }}>
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}{children}
    </button>
  );
}

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
export const fullName = (p: { firstName: string; lastName?: string | null }) => [p.firstName, p.lastName].filter(Boolean).join(" ");

// Raw fetch for writes — we need the `code` and extra fields on 409s that
// fetchJson drops.
export async function api<T = Record<string, unknown>>(url: string, method: string, body?: unknown) {
  const res  = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string };
  return { ok: res.ok, status: res.status, data };
}
