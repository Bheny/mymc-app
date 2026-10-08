"use client";

import { useEffect, useState } from "react";
import {
  Sheet as SheetIcon, Loader2, CheckCircle2, AlertTriangle, ExternalLink, RefreshCw, Plus, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Source = {
  id: string; name: string; url: string; gid: string; tabName: string | null;
  directoryGid?: string | null; directoryTabName?: string | null; mcPastor?: string | null;
};
type ChurchDirectory = { url: string; gid: string; tabName: string | null };
type Config = { label: string | null; sources: Source[]; directory?: ChurchDirectory | null };
type ChurchStatus = { count: number } | { error: string };
type Status =
  | { ok: true; rowCount: number; headers: string[]; directoryCount?: number; directoryError?: string }
  | { ok: false; error: string };
type Tab    = { gid: string; name: string };
// directoryGid: undefined = let the server auto-detect, "" = none
type Draft  = { key: string; id?: string; name: string; url: string; gid: string; directoryGid?: string; mcPastor: string };

const fieldLabel = "text-[12px] font-medium uppercase tracking-[0.04em]";
const newDraft = (): Draft => ({ key: Math.random().toString(36).slice(2), name: "", url: "", gid: "", mcPastor: "" });

/** One MC sheet in edit mode: name, link, and a tab picker loaded from the link. */
function SourceEditor({
  draft, index, error, canRemove, churchDirectory, onChange, onRemove,
}: {
  draft:     Draft;
  index:     number;
  error?:    string;
  canRemove: boolean;
  // With a church directory the sheet is just a source of reports, not an MC
  churchDirectory: boolean;
  onChange:  (patch: Partial<Draft>) => void;
  onRemove:  () => void;
}) {
  const [tabs,    setTabs]    = useState<Tab[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const link = draft.url.trim();
    if (!/^https:\/\/docs\.google\.com\/spreadsheets\//.test(link)) { setTabs([]); return; }
    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/settings/legacy-sheet?tabs=${encodeURIComponent(link)}`);
        const d = await r.json();
        if (!alive) return;
        const list: Tab[] = d.tabs ?? [];
        setTabs(list);
        // Keep valid existing choices; otherwise take the suggestions
        const patch: Partial<Draft> = {};
        if (!list.some((x) => x.gid === draft.gid)) patch.gid = d.suggested ?? "";
        if (draft.directoryGid === undefined || (draft.directoryGid && !list.some((x) => x.gid === draft.directoryGid))) {
          patch.directoryGid = d.suggestedDirectory ?? "";
        }
        if (Object.keys(patch).length) onChange(patch);
      } catch {
        if (alive) setTabs([]);
      } finally {
        if (alive) setLoading(false);
      }
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.url]);

  const id = `legacy-${draft.key}`;
  return (
    <div className="flex flex-col gap-3 rounded-lg p-3"
         style={{ border: `1px solid ${error ? "var(--red-200)" : "var(--brand-border)"}`, background: error ? "var(--red-50b)" : "var(--surface)" }}>
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold" style={{ color: "var(--brand-muted)" }}>Sheet {index + 1}</span>
        {canRemove && (
          <button type="button" onClick={onRemove} aria-label={`Remove sheet ${index + 1}`}
                  className="p-1 rounded hover:bg-[var(--brand-navy-light)]">
            <Trash2 className="h-3.5 w-3.5" style={{ color: "var(--brand-muted)" }} />
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-name`} className={fieldLabel} style={{ color: "var(--brand-muted)" }}>
          {churchDirectory ? "Sheet label" : "MC name"} <span style={{ color: "var(--brand-danger)" }}>*</span>
        </label>
        <Input id={`${id}-name`} value={draft.name} onChange={(e) => onChange({ name: e.target.value })}
               placeholder={churchDirectory ? "e.g. Lampo form responses" : "e.g. Lampo"}
               className="h-10 text-[14px]" style={{ borderColor: "var(--brand-border)" }} />
        <p className="text-[11px]" style={{ color: "var(--brand-muted)" }}>
          {churchDirectory
            ? "Names this sheet in warnings. MCs come from the church directory — this label only stands in as the MC for cells the directory doesn't list."
            : "Each sheet counts as one MC. Add a church directory above to group cells into MCs from there instead."}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-url`} className={fieldLabel} style={{ color: "var(--brand-muted)" }}>
          Sheet link <span style={{ color: "var(--brand-danger)" }}>*</span>
        </label>
        <Input id={`${id}-url`} value={draft.url} onChange={(e) => onChange({ url: e.target.value })}
               placeholder="https://docs.google.com/spreadsheets/d/…" inputMode="url"
               className="h-10 text-[14px]" style={{ borderColor: "var(--brand-border)" }} />
      </div>
      {(tabs.length > 0 || loading) && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-tab`} className={fieldLabel} style={{ color: "var(--brand-muted)" }}>Tab to read</label>
          {loading && !tabs.length ? (
            <p className="text-[12px] flex items-center gap-1.5" style={{ color: "var(--brand-muted)" }}>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Finding tabs…
            </p>
          ) : (
            <select id={`${id}-tab`} value={draft.gid} onChange={(e) => onChange({ gid: e.target.value })}
                    className="h-10 px-3 text-[14px] rounded-lg"
                    style={{ border: "1px solid var(--brand-border)", color: "var(--brand-text)", background: "var(--surface)" }}>
              {tabs.map((t) => <option key={t.gid} value={t.gid}>{t.name}</option>)}
            </select>
          )}
        </div>
      )}
      {churchDirectory ? (
        <details className="group">
          <summary className="cursor-pointer text-[12px] font-medium select-none" style={{ color: "var(--brand-link)" }}>
            Fallback options
            <span className="font-normal" style={{ color: "var(--brand-muted)" }}> — only for cells the church directory doesn&apos;t list</span>
          </summary>
          <div className="flex flex-col gap-3 pt-3">
            {tabs.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${id}-dir`} className={fieldLabel} style={{ color: "var(--brand-muted)" }}>
                  Directory tab <span className="normal-case tracking-normal font-normal">(optional)</span>
                </label>
                <select id={`${id}-dir`} value={draft.directoryGid ?? ""} onChange={(e) => onChange({ directoryGid: e.target.value })}
                        className="h-10 px-3 text-[14px] rounded-lg"
                        style={{ border: "1px solid var(--brand-border)", color: "var(--brand-text)", background: "var(--surface)" }}>
                  <option value="">None</option>
                  {tabs.filter((t) => t.gid !== draft.gid).map((t) => <option key={t.gid} value={t.gid}>{t.name}</option>)}
                </select>
                <p className="text-[11px]" style={{ color: "var(--brand-muted)" }}>
                  A tab listing each cell with its bacenta, senior shepherd and cell shepherd (e.g. Bacenta Info) — shown in the
                  dashboard&apos;s cell info.
                </p>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-pastor`} className={fieldLabel} style={{ color: "var(--brand-muted)" }}>
                MC pastor <span className="normal-case tracking-normal font-normal">(optional)</span>
              </label>
              <Input id={`${id}-pastor`} value={draft.mcPastor} onChange={(e) => onChange({ mcPastor: e.target.value })}
                     placeholder="e.g. Pastor Che" className="h-10 text-[14px]" style={{ borderColor: "var(--brand-border)" }} />
            </div>
          </div>
        </details>
      ) : (
        <>
      {tabs.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-dir`} className={fieldLabel} style={{ color: "var(--brand-muted)" }}>
            Directory tab <span className="normal-case tracking-normal font-normal">(optional)</span>
          </label>
          <select id={`${id}-dir`} value={draft.directoryGid ?? ""} onChange={(e) => onChange({ directoryGid: e.target.value })}
                  className="h-10 px-3 text-[14px] rounded-lg"
                  style={{ border: "1px solid var(--brand-border)", color: "var(--brand-text)", background: "var(--surface)" }}>
            <option value="">None</option>
            {tabs.filter((t) => t.gid !== draft.gid).map((t) => <option key={t.gid} value={t.gid}>{t.name}</option>)}
          </select>
          <p className="text-[11px]" style={{ color: "var(--brand-muted)" }}>
            A tab listing each cell with its bacenta, senior shepherd and cell shepherd (e.g. Bacenta Info) — shown in the
            dashboard&apos;s cell info.
          </p>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-pastor`} className={fieldLabel} style={{ color: "var(--brand-muted)" }}>
          MC pastor <span className="normal-case tracking-normal font-normal">(optional)</span>
        </label>
        <Input id={`${id}-pastor`} value={draft.mcPastor} onChange={(e) => onChange({ mcPastor: e.target.value })}
               placeholder="e.g. Pastor Che" className="h-10 text-[14px]" style={{ borderColor: "var(--brand-border)" }} />
      </div>
        </>
      )}
      {error && (
        <p className="text-[12px] flex items-start gap-1.5" style={{ color: "var(--brand-danger)" }}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {error}
        </p>
      )}
    </div>
  );
}

/** The shared church directory: a link + the tab that lists cell → bacenta → MC. */
function ChurchDirectoryEditor({
  url, gid, error, onChange,
}: {
  url: string; gid: string; error?: string;
  onChange: (patch: { url?: string; gid?: string }) => void;
}) {
  const [tabs,    setTabs]    = useState<Tab[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const link = url.trim();
    if (!/^https:\/\/docs\.google\.com\/spreadsheets\//.test(link)) { setTabs([]); return; }
    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/settings/legacy-sheet?tabs=${encodeURIComponent(link)}`);
        const d = await r.json();
        if (!alive) return;
        const list: Tab[] = d.tabs ?? [];
        setTabs(list);
        if (!list.some((x) => x.gid === gid)) onChange({ gid: d.suggestedDirectory ?? list[0]?.gid ?? "" });
      } catch {
        if (alive) setTabs([]);
      } finally {
        if (alive) setLoading(false);
      }
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return (
    <div className="flex flex-col gap-3 rounded-lg p-3"
         style={{ border: `1px solid ${error ? "var(--red-200)" : "var(--brand-border)"}`, background: error ? "var(--red-50b)" : "var(--brand-navy-light)" }}>
      <div>
        <p className="text-[12px] font-semibold" style={{ color: "var(--brand-text)" }}>Church directory</p>
        <p className="text-[11px] mt-0.5" style={{ color: "var(--brand-muted)" }}>
          One tab listing every cell with its bacenta, senior shepherd, cell shepherd and MC (and MC sections like
          &ldquo;LAMPO MC — Pastor Che&rdquo;). Each cell&apos;s MC and bacenta come from here, so restructuring is just
          an edit to this tab — no new sheets needed.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="church-dir-url" className={fieldLabel} style={{ color: "var(--brand-muted)" }}>
          Link <span className="normal-case tracking-normal font-normal">(optional)</span>
        </label>
        <Input id="church-dir-url" value={url} onChange={(e) => onChange({ url: e.target.value })}
               placeholder="https://docs.google.com/spreadsheets/d/…" inputMode="url"
               className="h-10 text-[14px] bg-[var(--surface)]" style={{ borderColor: "var(--brand-border)" }} />
      </div>
      {(tabs.length > 0 || loading) && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="church-dir-tab" className={fieldLabel} style={{ color: "var(--brand-muted)" }}>Tab</label>
          {loading && !tabs.length ? (
            <p className="text-[12px] flex items-center gap-1.5" style={{ color: "var(--brand-muted)" }}>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Finding tabs…
            </p>
          ) : (
            <select id="church-dir-tab" value={gid} onChange={(e) => onChange({ gid: e.target.value })}
                    className="h-10 px-3 text-[14px] rounded-lg"
                    style={{ border: "1px solid var(--brand-border)", color: "var(--brand-text)", background: "var(--surface)" }}>
              {tabs.map((t) => <option key={t.gid} value={t.gid}>{t.name}</option>)}
            </select>
          )}
        </div>
      )}
      {error && (
        <p className="text-[12px] flex items-start gap-1.5" style={{ color: "var(--brand-danger)" }}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {error}
        </p>
      )}
    </div>
  );
}

/**
 * Admin / chief-shepherd control for the Google Sheets behind the Legacy
 * dashboard — one form-responses sheet (or tab) per MC. Renders nothing for
 * users who can't manage it.
 */
export function LegacySheetSettings() {
  const [allowed,  setAllowed]  = useState<boolean | null>(null);
  const [config,   setConfig]   = useState<Config | null>(null);
  const [status,   setStatus]   = useState<Record<string, Status> | null>(null);
  const [editing,  setEditing]  = useState(false);
  const [drafts,   setDrafts]   = useState<Draft[]>([newDraft()]);
  const [errors,   setErrors]   = useState<Record<number, string>>({});
  const [busy,     setBusy]     = useState<"save" | "check" | "remove" | null>(null);
  const [error,    setError]    = useState("");
  const [dirUrl,   setDirUrl]   = useState("");
  const [dirGid,   setDirGid]   = useState("");
  const [dirError, setDirError] = useState("");
  const [church,   setChurch]   = useState<ChurchStatus | null>(null);

  async function load(check = true) {
    const res = await fetch(`/api/settings/legacy-sheet${check ? "?check=1" : ""}`);
    if (res.status === 403 || res.status === 401) { setAllowed(false); return; }
    const d = await res.json();
    setAllowed(true);
    setConfig(d.config);
    setStatus(d.status);
    setChurch(d.church ?? null);
    setEditing(!d.config);
  }

  useEffect(() => { load().catch(() => setAllowed(false)); }, []);

  if (!allowed) return null;

  function startEdit() {
    setDrafts(config?.sources.length
      ? config.sources.map((s) => ({
          key: s.id, id: s.id, name: s.name, url: s.url, gid: s.gid,
          // Never configured (saved before directories existed) → let the tab list suggest one
          directoryGid: s.directoryGid === undefined ? undefined : s.directoryGid ?? "",
          mcPastor: s.mcPastor ?? "",
        }))
      : [newDraft()]);
    setDirUrl(config?.directory?.url ?? "");
    setDirGid(config?.directory?.gid ?? "");
    setErrors({}); setError(""); setDirError("");
    setEditing(true);
  }

  function patchDraft(i: number, patch: Partial<Draft>) {
    setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));
    if (patch.name !== undefined || patch.url !== undefined) setErrors((e) => { const n = { ...e }; delete n[i]; return n; });
    setError("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save"); setError(""); setErrors({}); setDirError("");
    const res = await fetch("/api/settings/legacy-sheet", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: config?.label ?? null,
        directory: dirUrl.trim() ? { url: dirUrl.trim(), gid: dirGid || undefined } : null,
        sources: drafts.map((d) => ({
          id: d.id, name: d.name, url: d.url, gid: d.gid || undefined,
          directoryGid: d.directoryGid, mcPastor: d.mcPastor,
        })),
      }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      if (d.directoryError) { setDirError(d.error); return; }
      setErrors(d.errors ?? {}); setError(d.error ?? "Could not save."); return;
    }
    setConfig(d.config);
    setStatus(d.status);
    setChurch(d.church ?? null);
    setEditing(false);
  }

  async function recheck() {
    setBusy("check");
    await load(true).catch(() => {});
    setBusy(null);
  }

  async function disconnect() {
    if (!window.confirm("Disconnect all sheets? The Legacy dashboard will be empty until new links are added.")) return;
    setBusy("remove");
    await fetch("/api/settings/legacy-sheet", { method: "DELETE" });
    setBusy(null);
    setConfig(null); setStatus(null); setChurch(null); setDirUrl(""); setDirGid(""); setDrafts([newDraft()]); setEditing(true);
  }

  return (
    <section>
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--brand-muted)" }}>
        Legacy data sources
      </p>
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--brand-border)" }}>
        <div className="flex items-start gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--brand-border)" }}>
          <SheetIcon className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "var(--brand-muted)" }} />
          <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
            The form-responses sheets the Legacy dashboard combines, plus an optional church directory that decides
            which MC and bacenta each cell belongs to. Share each as <b>Anyone with the link → Viewer</b>.
            Sheets can be separate files or tabs of the same file. The app only reads them, refreshing about once a minute.
          </p>
        </div>

        {editing ? (
          <form onSubmit={save} className="flex flex-col gap-3 px-4 py-4">
            <ChurchDirectoryEditor
              url={dirUrl} gid={dirGid} error={dirError}
              onChange={(p) => {
                if (p.url !== undefined) setDirUrl(p.url);
                if (p.gid !== undefined) setDirGid(p.gid);
                setDirError("");
              }}
            />
            <p className="text-[11px] font-semibold uppercase tracking-[0.07em] mt-1" style={{ color: "var(--brand-muted)" }}>
              {dirUrl.trim() ? "Report sheets" : "MC sheets"}
            </p>
            {drafts.map((d, i) => (
              <SourceEditor
                key={d.key}
                draft={d}
                index={i}
                error={errors[i]}
                canRemove={drafts.length > 1}
                churchDirectory={!!dirUrl.trim()}
                onChange={(patch) => patchDraft(i, patch)}
                onRemove={() => { setDrafts((ds) => ds.filter((_, j) => j !== i)); setErrors({}); }}
              />
            ))}
            <button type="button" onClick={() => setDrafts((ds) => [...ds, newDraft()])}
                    className="self-start inline-flex items-center gap-1.5 text-[13px] font-medium hover:underline"
                    style={{ color: "var(--brand-link)" }}>
              <Plus className="h-3.5 w-3.5" /> Add another sheet
            </button>
            {error && (
              <p className="text-[12px] flex items-start gap-1.5" style={{ color: "var(--brand-danger)" }}>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              {config && (
                <Button type="button" variant="outline" onClick={() => setEditing(false)}
                        className="h-9 text-[13px]" style={{ borderRadius: 8 }}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={busy === "save"} className="h-9 text-[13px]"
                      style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}>
                {busy === "save" ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Checking sheets…</> : "Save sheets"}
              </Button>
            </div>
          </form>
        ) : config && (
          <div className="flex flex-col gap-3 px-4 py-4">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-medium" style={{ color: "var(--brand-text)" }}>
                {config.sources.length} report sheet{config.sources.length === 1 ? "" : "s"} connected
              </p>
              <button onClick={recheck} disabled={!!busy} aria-label="Check the sheets again"
                      className="p-1.5 rounded-lg hover:bg-[var(--brand-navy-light)] transition-colors">
                <RefreshCw className={`h-4 w-4 ${busy === "check" ? "animate-spin" : ""}`} style={{ color: "var(--brand-muted)" }} />
              </button>
            </div>

            {config.directory ? (
              <div className="rounded-lg px-3 py-2.5 flex flex-col gap-1"
                   style={{ background: church && "error" in church ? "var(--tint-danger-bg)" : church ? "var(--tint-ok-bg)" : "var(--brand-navy-light)" }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-medium" style={{ color: "var(--brand-text)" }}>Church directory</span>
                  <a href={config.directory.url} target="_blank" rel="noopener noreferrer" aria-label="Open the church directory in Google Sheets"
                     className="text-[12px] inline-flex items-center gap-1 hover:underline shrink-0" style={{ color: "var(--brand-link)" }}>
                    Open <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                {config.directory.tabName && (
                  <span className="text-[12px]" style={{ color: "var(--brand-muted)" }}>Tab: {config.directory.tabName}</span>
                )}
                {church && ("error" in church ? (
                  <span className="text-[12px] flex items-start gap-1.5" style={{ color: "var(--tint-danger-fg)" }}>
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {church.error}
                  </span>
                ) : (
                  <span className="text-[12px] flex items-center gap-1.5" style={{ color: "var(--tint-ok-fg)" }}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> {church.count} cells listed — MCs and bacentas come from here
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
                No church directory — each sheet is treated as one MC. Add one under Edit sheets to group cells into MCs by the directory.
              </p>
            )}

            <ul className="flex flex-col gap-2">
              {config.sources.map((s) => {
                const st = status?.[s.id];
                return (
                  <li key={s.id} className="rounded-lg px-3 py-2.5 flex flex-col gap-1"
                      style={{ background: st && !st.ok ? "var(--tint-danger-bg)" : st?.ok ? "var(--tint-ok-bg)" : "var(--brand-navy-light)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[14px] font-medium" style={{ color: "var(--brand-text)" }}>{s.name}</span>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${s.name} in Google Sheets`}
                         className="text-[12px] inline-flex items-center gap-1 hover:underline shrink-0" style={{ color: "var(--brand-link)" }}>
                        Open <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    {s.tabName && <span className="text-[12px]" style={{ color: "var(--brand-muted)" }}>Tab: {s.tabName}</span>}
                    {s.mcPastor && <span className="text-[12px]" style={{ color: "var(--brand-muted)" }}>MC pastor: {s.mcPastor}</span>}
                    {s.directoryTabName && (
                      <span className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
                        Directory: {s.directoryTabName}
                        {st?.ok && st.directoryCount ? ` · ${st.directoryCount} cells` : ""}
                        {st?.ok && st.directoryError ? ` · ${st.directoryError}` : ""}
                      </span>
                    )}
                    {st?.ok ? (
                      <span className="text-[12px] flex items-center gap-1.5" style={{ color: "var(--tint-ok-fg)" }}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Readable · {st.rowCount} rows
                      </span>
                    ) : st ? (
                      <span className="text-[12px] flex items-start gap-1.5" style={{ color: "var(--tint-danger-fg)" }}>
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {st.error}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={disconnect} disabled={!!busy} className="h-9 text-[13px]"
                      style={{ borderRadius: 8, borderColor: "var(--brand-danger)", color: "var(--brand-danger)" }}>
                Disconnect all
              </Button>
              <Button variant="outline" onClick={startEdit} disabled={!!busy} className="h-9 text-[13px]" style={{ borderRadius: 8 }}>
                Edit sheets
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
