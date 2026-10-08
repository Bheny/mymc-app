"use client";

import { useEffect, useState } from "react";
import { Network, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { invalidateCapacityLimits } from "@/hooks/use-capacity-limits";
import type { CapacityLevel } from "@/lib/capacity-defaults";

type LevelRow = {
  level:      CapacityLevel;
  label:      string;
  defaultMax: number;
  max:        number;
  enforce:    boolean;
};

type Draft = Record<string, { max: string; enforce: boolean }>;

function toDraft(levels: LevelRow[]): Draft {
  return Object.fromEntries(levels.map((l) => [l.level, { max: String(l.max), enforce: l.enforce }]));
}

/**
 * Admin / chief-shepherd control for hierarchy limits (buscentres per MC,
 * cells per buscentre, etc.). Renders nothing for users who can't edit.
 */
export function StructureLimitsSettings() {
  const [levels,  setLevels]  = useState<LevelRow[] | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [draft,   setDraft]   = useState<Draft>({});
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [saved,   setSaved]   = useState(false);

  useEffect(() => {
    fetch("/api/settings/capacity")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setLevels(d.levels);
        setCanEdit(!!d.canEdit);
        setDraft(toDraft(d.levels));
      })
      .catch(() => {});
  }, []);

  if (!levels || !canEdit) return null;

  const dirty = levels.some((l) =>
    draft[l.level]?.max !== String(l.max) || draft[l.level]?.enforce !== l.enforce
  );

  function setField(level: string, patch: Partial<{ max: string; enforce: boolean }>) {
    setDraft((d) => ({ ...d, [level]: { ...d[level], ...patch } }));
    setSaved(false);
    setError("");
  }

  async function save() {
    for (const l of levels!) {
      const n = Number(draft[l.level].max);
      if (!Number.isInteger(n) || n < 1) { setError(`${l.label} must be a whole number of at least 1.`); return; }
    }
    setSaving(true); setError("");
    const res = await fetch("/api/settings/capacity", {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        limits: Object.fromEntries(levels!.map((l) => [
          l.level, { max: Number(draft[l.level].max), enforce: draft[l.level].enforce },
        ])),
      }),
    });
    setSaving(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error ?? "Failed to save."); return; }
    const next = levels!.map((l) => ({ ...l, ...d.limits[l.level] }));
    setLevels(next);
    setDraft(toDraft(next));
    invalidateCapacityLimits();
    setSaved(true);
  }

  return (
    <section>
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.07em]"
         style={{ color: "var(--brand-muted)" }}>
        Structure limits
      </p>
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--brand-border)" }}>
        <div className="flex items-start gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--brand-border)" }}>
          <Network className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "var(--brand-muted)" }} />
          <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
            Maximum size of each level in the hierarchy. When <b>Enforce</b> is off, going over the
            limit is allowed but logged as a capacity warning. When it&apos;s on, it&apos;s blocked.
          </p>
        </div>

        {levels.map((l, i) => {
          const d = draft[l.level];
          const isDefault = d.max === String(l.defaultMax);
          return (
            <div key={l.level}
                 className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
                 style={{ borderBottom: i === levels.length - 1 ? "none" : "1px solid var(--brand-border)" }}>
              <div className="flex-1 min-w-[160px]">
                <p className="text-[14px] font-medium" style={{ color: "var(--brand-text)" }}>{l.label}</p>
                <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: "var(--brand-muted)" }}>
                  Default {l.defaultMax}
                  {!isDefault && (
                    <button onClick={() => setField(l.level, { max: String(l.defaultMax) })}
                            className="inline-flex items-center gap-0.5 hover:underline ml-1"
                            style={{ color: "var(--brand-link)" }}>
                      <RotateCcw className="h-2.5 w-2.5" /> reset
                    </button>
                  )}
                </p>
              </div>
              <Input
                type="number" min={1} inputMode="numeric"
                value={d.max}
                onChange={(e) => setField(l.level, { max: e.target.value })}
                aria-label={`${l.label} maximum`}
                className="h-9 w-20 text-[14px] text-center"
                style={{ borderColor: "var(--brand-border)" }}
              />
              <label className="flex items-center gap-2 text-[12px]" style={{ color: "var(--brand-muted)" }}>
                <Switch checked={d.enforce} onCheckedChange={(v) => setField(l.level, { enforce: v })}
                        aria-label={`Enforce ${l.label} limit`} />
                Enforce
              </label>
            </div>
          );
        })}

        {(dirty || error || saved) && (
          <div className="flex items-center justify-end gap-3 px-4 py-3"
               style={{ borderTop: "1px solid var(--brand-border)", background: "var(--brand-navy-light)" }}>
            {error && <p className="text-[12px] mr-auto" style={{ color: "var(--brand-danger)" }}>{error}</p>}
            {saved && !dirty && <p className="text-[12px] mr-auto" style={{ color: "var(--brand-success)" }}>Limits saved.</p>}
            {dirty && (
              <>
                <Button variant="outline" onClick={() => { setDraft(toDraft(levels)); setError(""); }}
                        className="h-9 text-[13px]" style={{ borderRadius: 8 }}>
                  Discard
                </Button>
                <Button onClick={save} disabled={saving} className="h-9 text-[13px]"
                        style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save limits"}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
