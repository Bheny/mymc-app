"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

type ActingUpFlag = {
  id:             string;
  userId:         string;
  userName:       string;
  realRole:       string;
  actingAs:       string;
  nodeName:       string;
  recommendation: string;
  severity:       string;
  flaggedAt:      string;
  user: { name: string; email: string };
};

type CapacityWarning = {
  id:           string;
  level:        string;
  parentName:   string;
  currentCount: number;
  maxCount:     number;
  createdAt:    string;
  createdBy:    { name: string };
};

function roleLabel(r: string) {
  return r.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function SeverityBadge({ severity }: { severity: string }) {
  const isRed = severity === "red";
  return (
    <span
      className="rounded-pill text-[11px] font-medium px-2 py-0.5"
      style={isRed
        ? { background: "#FDECEA", color: "#791F1F" }
        : { background: "#FEF3DC", color: "#854F0B" }}
    >
      {isRed ? "Red" : "Amber"}
    </span>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-6">
      <span className="text-[12px] font-medium uppercase tracking-[0.04em] whitespace-nowrap"
            style={{ color: "var(--brand-muted)" }}>
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: "var(--brand-border)" }} />
    </div>
  );
}

export default function WarningsPage() {
  const [flags,    setFlags]    = useState<ActingUpFlag[]>([]);
  const [warnings, setWarnings] = useState<CapacityWarning[]>([]);
  const [loading,  setLoading]  = useState(true);

  async function loadData() {
    const res = await fetch("/api/org/warnings");
    const data = await res.json();
    setFlags(data.actingUpFlags ?? []);
    setWarnings(data.capacityWarnings ?? []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function resolve(type: "actingUp" | "capacity", id: string) {
    await fetch("/api/org/warnings", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ type, id }),
    });
    loadData();
  }

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1200px] mx-auto">
        <div className="skeleton h-8 w-48 mb-4 rounded-lg" />
        <div className="skeleton h-40 w-full rounded-xl" />
      </div>
    );
  }

  const hasAny = flags.length + warnings.length > 0;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1200px] mx-auto pb-20 lg:pb-8">
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold" style={{ color: "var(--brand-text)" }}>
          Org Health
        </h1>
        <p className="mt-0.5 text-[14px]" style={{ color: "var(--brand-muted)" }}>
          Acting-up situations and capacity warnings across the hierarchy.
        </p>
      </div>

      {!hasAny ? (
        <div className="rounded-xl p-12 text-center" style={{ border: "1px solid var(--brand-border)" }}>
          <CheckCircle2 style={{ width: 40, height: 40, color: "var(--brand-success)", margin: "0 auto 12px" }} />
          <p className="text-[14px] font-medium" style={{ color: "var(--brand-text)" }}>
            All clear — no open warnings
          </p>
          <p className="text-[14px] mt-1" style={{ color: "var(--brand-muted)" }}>
            Acting-up flags and capacity warnings will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* ── Acting-up flags ── */}
          {flags.length > 0 && (
            <>
              <SectionDivider label={`Acting up (${flags.length})`} />
              <div className="flex flex-col gap-3">
                {flags.map((flag) => (
                  <div
                    key={flag.id}
                    className="rounded-xl p-5"
                    style={{
                      border:      "1px solid var(--brand-border)",
                      borderLeft:  flag.severity === "red"
                        ? "4px solid var(--brand-danger)"
                        : "4px solid var(--brand-warning)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle
                            style={{ width: 15, height: 15,
                              color: flag.severity === "red"
                                ? "var(--brand-danger)"
                                : "var(--brand-warning)" }}
                          />
                          <span className="text-[14px] font-medium" style={{ color: "var(--brand-text)" }}>
                            {flag.user.name}
                          </span>
                          <SeverityBadge severity={flag.severity} />
                        </div>
                        <p className="text-[13px] mb-1" style={{ color: "var(--brand-muted)" }}>
                          <strong>{roleLabel(flag.realRole)}</strong> acting as{" "}
                          <strong>{roleLabel(flag.actingAs)}</strong> at {flag.nodeName}
                        </p>
                        <p className="text-[13px] italic" style={{ color: "var(--brand-muted)" }}>
                          {flag.recommendation}
                        </p>
                      </div>
                      <Button
                        onClick={() => resolve("actingUp", flag.id)}
                        variant="outline"
                        className="shrink-0 h-8 text-[12px] px-3"
                        style={{ borderColor: "var(--brand-border)", borderRadius: 8 }}
                      >
                        Resolve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Capacity warnings ── */}
          {warnings.length > 0 && (
            <>
              <SectionDivider label={`Capacity warnings (${warnings.length})`} />
              <div className="flex flex-col gap-3">
                {warnings.map((w) => (
                  <div
                    key={w.id}
                    className="rounded-xl p-5"
                    style={{
                      border:     "1px solid var(--brand-border)",
                      borderLeft: "4px solid var(--brand-warning)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <ShieldAlert style={{ width: 15, height: 15, color: "var(--brand-warning)" }} />
                          <span className="text-[14px] font-medium" style={{ color: "var(--brand-text)" }}>
                            {w.parentName}
                          </span>
                          <span
                            className="rounded-pill text-[11px] font-medium px-2 py-0.5"
                            style={{ background: "#FEF3DC", color: "#854F0B" }}
                          >
                            {w.currentCount}/{w.maxCount} {w.level}s
                          </span>
                        </div>
                        <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>
                          Logged by {w.createdBy.name} ·{" "}
                          {new Date(w.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        onClick={() => resolve("capacity", w.id)}
                        variant="outline"
                        className="shrink-0 h-8 text-[12px] px-3"
                        style={{ borderColor: "var(--brand-border)", borderRadius: 8 }}
                      >
                        Resolve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
