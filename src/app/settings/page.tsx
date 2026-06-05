"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  User, Mail, Briefcase, MapPin, Calendar,
  Award, KeyRound, LogOut, Pencil, Check, X, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

// ─── Constants ────────────────────────────────────────────────────────────────

const RANKS = ["Reverend", "Pastor", "Senior Shepherd", "Shepherd", "Member"] as const;
type Rank = typeof RANKS[number];

const ROLE_LABELS: Record<string, string> = {
  admin:          "Admin",
  chief_shepherd: "Chief Shepherd",
  mc_pastor:      "MC Pastor",
  buscentre_head: "Buscentre Head",
  cell_shepherd:  "Cell Shepherd",
  shepherd:       "Shepherd",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type MeData = {
  id:          string;
  name:        string | null;
  email:       string;
  rank:        string | null;
  activatedAt: string | null;
  role: {
    role:        string;
    cell:        { name: string } | null;
    buscentre:   { name: string } | null;
    mc:          { name: string } | null;
  } | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.07em]"
       style={{ color: "var(--brand-muted)" }}>
      {children}
    </p>
  );
}

function Row({ icon: Icon, label, children, last = false }: {
  icon:     React.ElementType;
  label:    string;
  children: React.ReactNode;
  last?:    boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3"
         style={{ borderBottom: last ? "none" : "1px solid var(--brand-border)" }}>
      <Icon className="h-4 w-4 shrink-0" style={{ color: "var(--brand-muted)" }} />
      <span className="text-[12px] font-medium uppercase tracking-[0.04em] w-28 shrink-0"
            style={{ color: "var(--brand-muted)" }}>
        {label}
      </span>
      <div className="flex-1 flex items-center">
        {children}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [me,      setMe]      = useState<MeData | null>(null);
  const [loading, setLoading] = useState(true);

  // Name editing
  const [editingName, setEditingName] = useState(false);
  const [nameInput,   setNameInput]   = useState("");
  const [savingName,  setSavingName]  = useState(false);
  const [nameError,   setNameError]   = useState("");

  // Rank editing
  const [editingRank, setEditingRank] = useState(false);
  const [savingRank,  setSavingRank]  = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => { setMe(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // ── Name save ──────────────────────────────────────────────────────────────
  function startEditName() {
    setNameInput(me?.name ?? "");
    setNameError("");
    setEditingName(true);
  }

  async function saveName() {
    if (!nameInput.trim()) { setNameError("Name cannot be empty."); return; }
    setSavingName(true); setNameError("");
    const res = await fetch("/api/me", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name: nameInput.trim() }),
    });
    setSavingName(false);
    if (res.ok) {
      const updated = await res.json();
      setMe((prev) => prev ? { ...prev, name: updated.name } : prev);
      setEditingName(false);
    } else {
      setNameError("Failed to save.");
    }
  }

  // ── Rank save ──────────────────────────────────────────────────────────────
  async function saveRank(rank: Rank | null) {
    setSavingRank(true);
    const res = await fetch("/api/me", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ rank }),
    });
    setSavingRank(false);
    if (res.ok) {
      const updated = await res.json();
      setMe((prev) => prev ? { ...prev, rank: updated.rank } : prev);
    }
    setEditingRank(false);
  }

  // ── Derived display values ─────────────────────────────────────────────────
  const roleName  = me?.role?.role ? ROLE_LABELS[me.role.role] ?? me.role.role : "—";
  const scopeParts = [
    me?.role?.cell?.name      && `Cell: ${me.role.cell.name}`,
    me?.role?.buscentre?.name && `Buscentre: ${me.role.buscentre.name}`,
    me?.role?.mc?.name        && `MC: ${me.role.mc.name}`,
  ].filter(Boolean) as string[];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[680px] mx-auto pb-20 lg:pb-8">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[24px] font-semibold" style={{ color: "var(--brand-text)" }}>Settings</h1>
        <p className="text-[14px] mt-0.5" style={{ color: "var(--brand-muted)" }}>
          Manage your account and preferences
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}
        </div>
      ) : (
        <div className="flex flex-col gap-8">

          {/* ── Profile ── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <SectionTitle>Profile</SectionTitle>
              {!editingName && !editingRank && (
                <button
                  onClick={() => { startEditName(); }}
                  className="flex items-center gap-1.5 text-[12px] font-medium rounded-lg px-2.5 py-1 transition-colors hover:bg-[var(--brand-navy-light)]"
                  style={{ color: "var(--brand-navy)" }}
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
              )}
            </div>

            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--brand-border)" }}>

              {/* Name */}
              <Row icon={User} label="Name">
                {editingName ? (
                  <>
                    <Input
                      autoFocus
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                      className="h-8 text-[14px] flex-1 mr-2"
                      style={{ borderColor: nameError ? "var(--brand-danger)" : "var(--brand-border)" }}
                    />
                    <button onClick={saveName} disabled={savingName}
                            className="p-1.5 rounded-lg hover:bg-[var(--brand-navy-light)] transition-colors">
                      {savingName
                        ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--brand-navy)" }} />
                        : <Check className="h-4 w-4" style={{ color: "var(--brand-success)" }} />}
                    </button>
                    <button onClick={() => setEditingName(false)}
                            className="p-1.5 rounded-lg hover:bg-[var(--brand-navy-light)] transition-colors ml-0.5">
                      <X className="h-4 w-4" style={{ color: "var(--brand-muted)" }} />
                    </button>
                  </>
                ) : (
                  <span className="text-[14px]" style={{ color: "var(--brand-text)" }}>
                    {me?.name ?? "—"}
                  </span>
                )}
              </Row>
              {nameError && (
                <p className="px-4 pb-2 text-[12px]" style={{ color: "var(--brand-danger)" }}>{nameError}</p>
              )}

              {/* Email */}
              <Row icon={Mail} label="Email">
                <span className="text-[14px]" style={{ color: "var(--brand-text)" }}>{me?.email ?? "—"}</span>
              </Row>

              {/* Rank */}
              <Row icon={Award} label="Rank">
                {editingRank ? (
                  <>
                    <select
                      autoFocus
                      defaultValue={me?.rank ?? ""}
                      onChange={(e) => saveRank(e.target.value as Rank || null)}
                      onBlur={() => setEditingRank(false)}
                      className="flex-1 h-8 px-2 text-[14px] rounded-lg mr-2"
                      style={{ border: "1px solid var(--brand-border)", background: "#fff", color: "var(--brand-text)" }}
                    >
                      <option value="">— Not set —</option>
                      {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    {savingRank && <Loader2 className="h-4 w-4 animate-spin shrink-0" style={{ color: "var(--brand-muted)" }} />}
                  </>
                ) : me?.rank ? (
                  <>
                    <span className="rounded-pill text-[12px] font-semibold px-3 py-1 mr-2"
                          style={{ background: "var(--brand-navy)", color: "#fff" }}>
                      {me.rank}
                    </span>
                    <button onClick={() => setEditingRank(true)}
                            className="text-[11px] font-medium hover:underline"
                            style={{ color: "var(--brand-muted)" }}>
                      change
                    </button>
                  </>
                ) : (
                  <button onClick={() => setEditingRank(true)}
                          className="text-[13px] font-medium hover:underline"
                          style={{ color: "var(--brand-navy)" }}>
                    Set rank
                  </button>
                )}
              </Row>

              {/* Role */}
              <Row icon={Briefcase} label="Role">
                <span className="rounded-pill text-[12px] font-medium px-2.5 py-0.5"
                      style={{ background: "var(--brand-navy-light)", color: "var(--brand-navy)" }}>
                  {roleName}
                </span>
              </Row>

              {/* Scope */}
              {scopeParts.length > 0 && (
                <Row icon={MapPin} label="Scope">
                  <span className="text-[14px]" style={{ color: "var(--brand-text)" }}>
                    {scopeParts.join("  ·  ")}
                  </span>
                </Row>
              )}

              {/* Member since */}
              {me?.activatedAt && (
                <Row icon={Calendar} label="Member since" last>
                  <span className="text-[14px]" style={{ color: "var(--brand-text)" }}>
                    {new Date(me.activatedAt).toLocaleDateString("en-GB", {
                      day: "numeric", month: "long", year: "numeric",
                    })}
                  </span>
                </Row>
              )}
            </div>
          </section>

          {/* ── Security ── */}
          <section>
            <div className="mb-4"><SectionTitle>Security</SectionTitle></div>
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--brand-border)" }}>
              <div className="flex items-center justify-between px-4 py-4">
                <div className="flex items-center gap-3">
                  <KeyRound className="h-4 w-4 shrink-0" style={{ color: "var(--brand-muted)" }} />
                  <div>
                    <p className="text-[14px] font-medium" style={{ color: "var(--brand-text)" }}>Password</p>
                    <p className="text-[12px] mt-0.5" style={{ color: "var(--brand-muted)" }}>
                      Update your login password
                    </p>
                  </div>
                </div>
                <Link href="/change-password">
                  <Button variant="outline" className="h-9 text-[13px]" style={{ borderRadius: 8 }}>
                    Change password
                  </Button>
                </Link>
              </div>
            </div>
          </section>

          {/* ── Session ── */}
          <section>
            <div className="mb-4"><SectionTitle>Session</SectionTitle></div>
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--brand-border)" }}>
              <div className="flex items-center justify-between px-4 py-4">
                <div className="flex items-center gap-3">
                  <LogOut className="h-4 w-4 shrink-0" style={{ color: "var(--brand-muted)" }} />
                  <div>
                    <p className="text-[14px] font-medium" style={{ color: "var(--brand-text)" }}>Sign out</p>
                    <p className="text-[12px] mt-0.5" style={{ color: "var(--brand-muted)" }}>
                      You will be redirected to the login page
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => router.push("/api/auth/signout")}
                  className="h-9 text-[13px]"
                  style={{ borderRadius: 8, borderColor: "var(--brand-danger)", color: "var(--brand-danger)" }}
                >
                  Sign out
                </Button>
              </div>
            </div>
          </section>

        </div>
      )}
    </div>
  );
}
