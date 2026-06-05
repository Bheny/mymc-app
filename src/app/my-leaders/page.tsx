"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useActiveRole } from "@/hooks/use-active-role";
import { Phone, Mail, Users } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Leader = {
  id:        string | null;
  name:      string | null;
  email:     string | null;
  rank:      string | null;
  phone:     string | null;
  roleLabel: string | null;
  roleKey:   string | null;
  scope:     string | null;
  vacant:    boolean;
};

// ─── Role style map ────────────────────────────────────────────────────────────

const ROLE_STYLE: Record<string, { bg: string; color: string; avatarBg: string }> = {
  chief_shepherd: { bg: "#FEF3DC", color: "#854F0B", avatarBg: "#D97706" },
  mc_pastor:      { bg: "#E0F4EC", color: "#085041", avatarBg: "#059669" },
  buscentre_head: { bg: "var(--brand-navy-light)", color: "var(--brand-navy)", avatarBg: "var(--brand-navy)" },
  cell_shepherd:  { bg: "#EEF2FF", color: "#4338CA", avatarBg: "#4338CA" },
  shepherd:       { bg: "#F3EFF9", color: "#7C3AED", avatarBg: "#7C3AED" },
};

const ROLE_LABELS: Record<string, string> = {
  chief_shepherd: "Chief Shepherd",
  mc_pastor:      "MC Pastor",
  buscentre_head: "Buscentre Head",
  cell_shepherd:  "Cell Shepherd",
  shepherd:       "Shepherd",
  admin:          "Admin",
};

// ─── Leader card ──────────────────────────────────────────────────────────────

function LeaderCard({ leader, isDirectLeader }: { leader: Leader; isDirectLeader: boolean }) {
  const style = leader.roleKey
    ? (ROLE_STYLE[leader.roleKey] ?? { bg: "#F9FAFB", color: "#374151", avatarBg: "#6B7280" })
    : { bg: "#F9FAFB", color: "#374151", avatarBg: "#6B7280" };

  // Vacant position
  if (leader.vacant) {
    return (
      <div className="rounded-2xl px-5 py-4 flex gap-4 items-center relative"
           style={{ border: "1.5px dashed var(--brand-border)", background: "#FAFAFA" }}>
        {isDirectLeader && (
          <span className="absolute -top-2.5 left-4 text-[10px] font-bold uppercase tracking-[0.06em] px-2 py-0.5 rounded-pill"
                style={{ background: "#FAFAFA", color: "var(--brand-muted)", border: "1px solid var(--brand-border)" }}>
            Your direct leader
          </span>
        )}
        <div className="flex items-center justify-center rounded-xl shrink-0 text-[18px]"
             style={{ width: 50, height: 50, background: "#E5E7EB", color: "#9CA3AF" }}>
          ?
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium italic" style={{ color: "var(--brand-muted)" }}>
            Not assigned yet
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="rounded-pill text-[11px] font-semibold px-2.5 py-0.5"
                  style={{ background: style.bg, color: style.color }}>
              {leader.roleLabel}
            </span>
            {leader.scope && (
              <span className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
                · {leader.scope}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  const initials = (leader.name ?? leader.email ?? "?")
    .split(" ").filter(Boolean).map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="rounded-2xl p-5 flex gap-4 relative"
         style={{ border: `1.5px solid ${isDirectLeader ? style.color : "var(--brand-border)"}`, background: "#fff" }}>

      {isDirectLeader && (
        <span className="absolute -top-2.5 left-4 text-[10px] font-bold uppercase tracking-[0.06em] px-2 py-0.5 rounded-pill bg-white"
              style={{ color: style.color, border: `1px solid ${style.color}` }}>
          Your direct leader
        </span>
      )}

      <div className="flex items-center justify-center rounded-xl shrink-0 text-[15px] font-bold mt-1"
           style={{ width: 50, height: 50, background: style.avatarBg, color: "#fff" }}>
        {initials}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap mb-1.5">
          <p className="text-[15px] font-semibold leading-snug" style={{ color: "var(--brand-text)" }}>
            {leader.name ?? "—"}
          </p>
          {leader.rank && (
            <span className="rounded-pill text-[10px] font-bold px-2 py-0.5 mt-0.5 shrink-0"
                  style={{ background: "var(--brand-navy)", color: "#fff" }}>
              {leader.rank}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-3">
          {leader.roleLabel && (
            <span className="rounded-pill text-[11px] font-semibold px-2.5 py-0.5"
                  style={{ background: style.bg, color: style.color }}>
              {leader.roleLabel}
            </span>
          )}
          {leader.scope && (
            <span className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
              · {leader.scope}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {leader.phone && (
            <a href={`tel:${leader.phone}`}
               className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium transition-opacity hover:opacity-75"
               style={{ background: style.bg, color: style.color, border: `1px solid ${style.color}40` }}>
              <Phone className="h-3.5 w-3.5" /> {leader.phone}
            </a>
          )}
          {leader.email && (
            <a href={`mailto:${leader.email}`}
               className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium transition-opacity hover:opacity-75"
               style={{ background: "#fff", color: "var(--brand-muted)", border: "1px solid var(--brand-border)" }}>
              <Mail className="h-3.5 w-3.5" /> Email
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Chain connector ──────────────────────────────────────────────────────────

function Connector() {
  return (
    <div className="flex justify-center">
      <div className="flex flex-col items-center py-1 gap-0">
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ width: 2, height: 5, background: i % 2 === 0 ? "var(--brand-border)" : "transparent" }} />
        ))}
        {/* Arrow head */}
        <div style={{
          width: 0, height: 0,
          borderLeft: "5px solid transparent",
          borderRight: "5px solid transparent",
          borderTop: "6px solid var(--brand-border)",
        }} />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MyLeadersPage() {
  const { data: session } = useSession();
  const { activeView }    = useActiveRole();

  const [chain,   setChain]   = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/me/leaders")
      .then((r) => r.json())
      .then((d) => { setChain(d.chain ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const myRole     = activeView?.role ?? session?.user?.role ?? null;
  const myName     = session?.user?.name ?? "You";
  const myInitials = myName.split(" ").filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  // Chain from API is ordered bottom-up (direct leader first).
  // Display top-down: reverse so Chief Shepherd is at top, direct leader is last before "You".
  const displayChain = [...chain].reverse();

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[600px] mx-auto pb-20 lg:pb-8">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold" style={{ color: "var(--brand-text)" }}>
          My Leaders
        </h1>
        <p className="text-[14px] mt-0.5" style={{ color: "var(--brand-muted)" }}>
          Your chain of command — who to speak to at each level
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton rounded-2xl" style={{ height: 110 - i * 10 }} />
          ))}
        </div>

      ) : chain.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ border: "1px solid var(--brand-border)" }}>
          <Users style={{ width: 40, height: 40, color: "var(--brand-muted)", margin: "0 auto 12px" }} />
          <p className="text-[15px] font-medium mb-1" style={{ color: "var(--brand-text)" }}>
            No leaders found
          </p>
          <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>
            The roles above yours may not have been activated yet. Contact your administrator.
          </p>
        </div>

      ) : (
        <div className="flex flex-col mt-2">

          {/* Top of chain down to direct leader */}
          {displayChain.map((leader, i) => (
            <div key={leader.id}>
              <LeaderCard
                leader={leader}
                isDirectLeader={i === displayChain.length - 1}
              />
              <Connector />
            </div>
          ))}

          {/* You — at the bottom of the chain */}
          <div className="rounded-2xl px-5 py-4 flex items-center gap-4"
               style={{ border: "2px solid var(--brand-navy)", background: "var(--brand-navy-light)" }}>
            <div className="flex items-center justify-center rounded-xl shrink-0 text-[14px] font-bold"
                 style={{ width: 48, height: 48, background: "var(--brand-navy)", color: "#fff" }}>
              {myInitials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[15px] font-semibold" style={{ color: "var(--brand-navy)" }}>
                  {myName}
                </p>
                <span className="rounded-pill text-[10px] font-bold px-2 py-0.5"
                      style={{ background: "var(--brand-navy)", color: "#fff" }}>
                  You
                </span>
              </div>
              {myRole && (
                <p className="text-[12px] mt-0.5 font-medium" style={{ color: "var(--brand-navy)" }}>
                  {ROLE_LABELS[myRole] ?? myRole}
                </p>
              )}
            </div>
          </div>

          {/* Footer note */}
          <p className="text-center text-[12px] mt-5" style={{ color: "var(--brand-muted)" }}>
            {chain.filter((l) => !l.vacant).length} of {chain.length} level{chain.length !== 1 ? "s" : ""} above you activated
            {chain.some((l) => l.vacant) ? " — vacant positions pending assignment" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
