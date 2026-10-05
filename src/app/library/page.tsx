"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  FileText, Youtube, Mic, Link2, Plus, Search, Share2, MoreVertical, Pin, PinOff,
  Pencil, Trash2, Globe, GlobeLock, Download, Upload, Loader2, Library, Image as ImageIcon,
  Music, Presentation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter,
} from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  LIBRARY_ACCEPT, LIBRARY_ALLOWED_MIME, LIBRARY_CATEGORIES, LIBRARY_MAX_FILE_BYTES,
  detectLinkKind, fileTypeLabel, formatBytes, isHttpUrl, youtubeId, type LibraryKind,
} from "@/lib/library";

// ─── Types ────────────────────────────────────────────────────────────────────

type Item = {
  id:           string;
  kind:         LibraryKind;
  title:        string;
  description:  string | null;
  category:     string | null;
  url:          string | null;
  thumbnailUrl: string | null;
  fileName:     string | null;
  mimeType:     string | null;
  sizeBytes:    number | null;
  mcId:         string | null;
  pinned:       boolean;
  shareToken:   string;
  shareEnabled: boolean;
  createdAt:    string;
  mc:           { id: string; name: string } | null;
  createdBy:    { id: string; name: string | null };
  canManage:    boolean;
};

type ListResponse = { items: Item[]; categories: string[]; canAdd: boolean; storageReady: boolean };

const KIND_TABS: { key: "" | LibraryKind; label: string }[] = [
  { key: "",        label: "All" },
  { key: "FILE",    label: "Documents" },
  { key: "YOUTUBE", label: "Videos" },
  { key: "PODCAST", label: "Podcasts" },
  { key: "LINK",    label: "Links" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ItemIcon({ item, size = 20 }: { item: Pick<Item, "kind" | "mimeType">; size?: number }) {
  const style = { width: size, height: size };
  if (item.kind === "YOUTUBE") return <Youtube style={style} />;
  if (item.kind === "PODCAST") return <Mic style={style} />;
  if (item.kind === "LINK")    return <Link2 style={style} />;
  const t = fileTypeLabel(item.mimeType);
  if (t === "Image")      return <ImageIcon style={style} />;
  if (t === "Audio")      return <Music style={style} />;
  if (t === "PowerPoint") return <Presentation style={style} />;
  return <FileText style={style} />;
}

function kindLabel(item: Pick<Item, "kind" | "mimeType">): string {
  if (item.kind === "YOUTUBE") return "Video";
  if (item.kind === "PODCAST") return "Podcast";
  if (item.kind === "LINK")    return "Link";
  return fileTypeLabel(item.mimeType);
}

/** What gets shared: the original link for media, the public page for files. */
function shareUrl(item: Item): string | null {
  if (item.kind !== "FILE" && item.url) return item.url;
  if (item.shareEnabled) return `${window.location.origin}/l/${item.shareToken}`;
  return null;
}

/** PUT a file to a Supabase signed upload URL, reporting progress (0–100). */
function uploadToSignedUrl(signedUrl: string, file: File, apiKey: string | null, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", file);
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("x-upsert", "false");
    if (apiKey) xhr.setRequestHeader("apikey", apiKey);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload  = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Upload failed — check your connection"));
    xhr.send(form);
  });
}

const fieldLabel = "text-[12px] font-medium uppercase tracking-[0.04em]";

// ─── Item card ────────────────────────────────────────────────────────────────

function ItemCard({
  item, onShare, onEdit, onTogglePin, onToggleShare, onDelete,
}: {
  item:          Item;
  onShare:       () => void;
  onEdit:        () => void;
  onTogglePin:   () => void;
  onToggleShare: () => void;
  onDelete:      () => void;
}) {
  const openHref = item.kind === "FILE" ? `/api/library/${item.id}/open` : item.url!;

  return (
    <div className="rounded-xl overflow-hidden flex flex-col bg-white"
         style={{ border: `1px solid ${item.pinned ? "var(--brand-navy)" : "var(--brand-border)"}` }}>
      {/* Thumbnail / icon */}
      <a href={openHref} target="_blank" rel="noopener noreferrer"
         className="relative block" style={{ aspectRatio: "16 / 9", background: "var(--brand-navy-light)" }}>
        {item.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center" style={{ color: "var(--brand-navy)" }}>
            <ItemIcon item={item} size={36} />
          </span>
        )}
        {item.pinned && (
          <span className="absolute top-2 left-2 flex items-center gap-1 rounded-pill text-[10px] font-semibold px-2 py-0.5"
                style={{ background: "var(--brand-navy)", color: "#fff" }}>
            <Pin className="h-2.5 w-2.5" /> Pinned
          </span>
        )}
      </a>

      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--brand-muted)" }}>
          <ItemIcon item={item} size={12} />
          <span>{kindLabel(item)}</span>
          {item.kind === "FILE" && item.sizeBytes ? <span>· {formatBytes(item.sizeBytes)}</span> : null}
          {item.category && <span className="truncate">· {item.category}</span>}
        </div>
        <a href={openHref} target="_blank" rel="noopener noreferrer"
           className="text-[14px] font-semibold leading-snug hover:underline line-clamp-2"
           style={{ color: "var(--brand-text)" }}>
          {item.title}
        </a>
        {item.description && (
          <p className="text-[12px] line-clamp-2" style={{ color: "var(--brand-muted)" }}>{item.description}</p>
        )}
        <p className="text-[11px] mt-auto pt-1" style={{ color: "var(--brand-muted)" }}>
          {item.mc ? item.mc.name : "Whole branch"}
          {item.kind === "FILE" && !item.shareEnabled && " · public link off"}
        </p>
      </div>

      <div className="flex items-center gap-1 px-2 pb-2">
        <Button variant="outline" onClick={onShare} className="h-8 flex-1 text-[12px]" style={{ borderRadius: 8 }}>
          <Share2 className="h-3.5 w-3.5 mr-1.5" /> Share
        </Button>
        {item.kind === "FILE" && (
          <a href={`/api/library/${item.id}/open?download=1`} aria-label={`Download ${item.title}`}
             className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[var(--brand-navy-light)]">
            <Download className="h-4 w-4" style={{ color: "var(--brand-muted)" }} />
          </a>
        )}
        {item.canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label={`Manage ${item.title}`}
                      className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[var(--brand-navy-light)]">
                <MoreVertical className="h-4 w-4" style={{ color: "var(--brand-muted)" }} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}><Pencil className="h-3.5 w-3.5 mr-2" /> Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={onTogglePin}>
                {item.pinned ? <><PinOff className="h-3.5 w-3.5 mr-2" /> Unpin</> : <><Pin className="h-3.5 w-3.5 mr-2" /> Pin to top</>}
              </DropdownMenuItem>
              {item.kind === "FILE" && (
                <DropdownMenuItem onClick={onToggleShare}>
                  {item.shareEnabled
                    ? <><GlobeLock className="h-3.5 w-3.5 mr-2" /> Turn off public link</>
                    : <><Globe className="h-3.5 w-3.5 mr-2" /> Turn on public link</>}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} style={{ color: "var(--brand-danger)" }}>
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

// ─── Add sheet ────────────────────────────────────────────────────────────────

type McOption = { id: string; name: string };

function AddItemSheet({
  open, onClose, onAdded, categories, storageReady,
}: {
  open:         boolean;
  onClose:      () => void;
  onAdded:      () => void;
  categories:   string[];
  storageReady: boolean;
}) {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isMcPastor = role === "mc_pastor";

  const [mode,        setMode]        = useState<"file" | "link">(storageReady ? "file" : "link");
  const [file,        setFile]        = useState<File | null>(null);
  const [url,         setUrl]         = useState("");
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [category,    setCategory]    = useState("");
  const [mcId,        setMcId]        = useState("");
  const [mcs,         setMcs]         = useState<McOption[]>([]);
  const [previewing,  setPreviewing]  = useState(false);
  const [progress,    setProgress]    = useState<number | null>(null);
  const [busy,        setBusy]        = useState(false);
  const [error,       setError]       = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setMode(storageReady ? "file" : "link");
    setFile(null); setUrl(""); setTitle(""); setDescription(""); setCategory("");
    setProgress(null); setError(""); setBusy(false);
    fetch("/api/org/mega-churches").then((r) => r.json()).then((d) => {
      const list: McOption[] = Array.isArray(d) ? d.map((m: McOption) => ({ id: m.id, name: m.name })) : [];
      setMcs(list);
      // MC pastors can only post to their own MC
      setMcId(isMcPastor ? session?.user?.mcId ?? list[0]?.id ?? "" : "");
    }).catch(() => {});
  }, [open, storageReady, isMcPastor, session?.user?.mcId]);

  function pickFile(f: File | null) {
    setError("");
    if (!f) { setFile(null); return; }
    if (!(f.type in LIBRARY_ALLOWED_MIME)) { setError("That file type isn't supported. Upload a PDF, image, Word, PowerPoint or audio file."); return; }
    if (f.size > LIBRARY_MAX_FILE_BYTES) { setError(`${f.name} is ${formatBytes(f.size)} — the limit is 25 MB.`); return; }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
  }

  async function previewLink() {
    if (!isHttpUrl(url.trim()) || title) return;
    setPreviewing(true);
    try {
      const r = await fetch(`/api/library/link-preview?url=${encodeURIComponent(url.trim())}`);
      if (r.ok) {
        const d = await r.json();
        if (d.title) setTitle((t) => t || d.title);
      }
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) { setError("Give it a title."); return; }
    if (isMcPastor && !mcId) { setError("Choose your MC."); return; }

    const base = { title: title.trim(), description, category, mcId: mcId || null };
    setBusy(true);
    try {
      let payload: Record<string, unknown>;
      if (mode === "file") {
        if (!file) { setError("Choose a file."); setBusy(false); return; }
        const r = await fetch("/api/library/upload-url", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, mimeType: file.type, size: file.size }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Could not start the upload");
        setProgress(0);
        await uploadToSignedUrl(d.signedUrl, file, d.apiKey, setProgress);
        payload = { ...base, storagePath: d.path, fileName: file.name, mimeType: file.type, sizeBytes: file.size };
      } else {
        if (!isHttpUrl(url.trim())) { setError("Enter a link starting with http:// or https://"); setBusy(false); return; }
        payload = { ...base, url: url.trim() };
      }

      const res = await fetch("/api/library", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Could not save");
      onAdded();
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setProgress(null);
    } finally {
      setBusy(false);
    }
  }

  const linkKind = isHttpUrl(url.trim()) ? detectLinkKind(url.trim()) : null;
  const ytId     = url ? youtubeId(url.trim()) : null;
  const allCategories = Array.from(new Set([...LIBRARY_CATEGORIES, ...categories]));

  return (
    <Sheet open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <SheetContent width={460}>
        <SheetHeader>
          <SheetTitle>Add to library</SheetTitle>
        </SheetHeader>
        <SheetBody>
          <form id="add-library-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* File / link toggle */}
            <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--brand-border)" }}>
              {(["file", "link"] as const).map((m) => (
                <button key={m} type="button"
                        disabled={m === "file" && !storageReady}
                        onClick={() => { setMode(m); setError(""); }}
                        className="flex-1 py-2.5 text-[13px] font-medium transition-colors disabled:opacity-40"
                        style={mode === m
                          ? { background: "var(--brand-navy)", color: "#fff" }
                          : { background: "#fff", color: "var(--brand-muted)" }}>
                  {m === "file" ? "Upload a file" : "Add a link"}
                </button>
              ))}
            </div>
            {!storageReady && (
              <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
                File uploads aren&apos;t set up yet. You can still add YouTube, podcast and other links.
              </p>
            )}

            {mode === "file" ? (
              <div className="flex flex-col gap-1.5">
                <label className={fieldLabel} style={{ color: "var(--brand-muted)" }}>File *</label>
                <input ref={fileInput} type="file" accept={LIBRARY_ACCEPT} className="hidden"
                       onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
                <button type="button"
                        onClick={() => fileInput.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files?.[0] ?? null); }}
                        className="flex flex-col items-center justify-center gap-1.5 rounded-xl px-4 py-6 text-center transition-colors hover:bg-[var(--brand-navy-light)]"
                        style={{ border: "1.5px dashed var(--brand-border)" }}>
                  {file ? (
                    <>
                      <ItemIcon item={{ kind: "FILE", mimeType: file.type }} size={24} />
                      <span className="text-[13px] font-medium break-all" style={{ color: "var(--brand-text)" }}>{file.name}</span>
                      <span className="text-[11px]" style={{ color: "var(--brand-muted)" }}>
                        {fileTypeLabel(file.type)} · {formatBytes(file.size)} — tap to change
                      </span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-6 w-6" style={{ color: "var(--brand-muted)" }} />
                      <span className="text-[13px] font-medium" style={{ color: "var(--brand-text)" }}>Choose or drop a file</span>
                      <span className="text-[11px]" style={{ color: "var(--brand-muted)" }}>
                        PDF, image, Word, PowerPoint or audio · up to 25 MB
                      </span>
                    </>
                  )}
                </button>
                {progress !== null && (
                  <div className="rounded-pill overflow-hidden mt-1" style={{ height: 6, background: "var(--brand-border)" }}>
                    <div className="h-full transition-[width]" style={{ width: `${progress}%`, background: "var(--brand-navy)" }} />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <label className={fieldLabel} style={{ color: "var(--brand-muted)" }}>Link *</label>
                <Input value={url} onChange={(e) => { setUrl(e.target.value); setError(""); }} onBlur={previewLink}
                       placeholder="https://youtube.com/… or a podcast link" inputMode="url"
                       className="h-10 text-[14px]" style={{ borderColor: "var(--brand-border)" }} />
                {linkKind && (
                  <p className="text-[12px] flex items-center gap-1.5" style={{ color: "var(--brand-muted)" }}>
                    <ItemIcon item={{ kind: linkKind, mimeType: null }} size={12} />
                    {linkKind === "YOUTUBE" ? "YouTube video" : linkKind === "PODCAST" ? "Podcast" : "Web link"}
                    {previewing && <Loader2 className="h-3 w-3 animate-spin" />}
                  </p>
                )}
                {ytId && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`} alt="" className="rounded-lg w-full" />
                )}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className={fieldLabel} style={{ color: "var(--brand-muted)" }}>Title *</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)}
                     placeholder="e.g. Shepherds' Handbook 2026" className="h-10 text-[14px]"
                     style={{ borderColor: "var(--brand-border)" }} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={fieldLabel} style={{ color: "var(--brand-muted)" }}>Description</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                        placeholder="optional" className="text-[14px]" style={{ borderColor: "var(--brand-border)" }} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={fieldLabel} style={{ color: "var(--brand-muted)" }}>Category</label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} list="library-categories"
                     placeholder="e.g. Sermon notes" className="h-10 text-[14px]"
                     style={{ borderColor: "var(--brand-border)" }} />
              <datalist id="library-categories">
                {allCategories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={fieldLabel} style={{ color: "var(--brand-muted)" }}>Who can see it</label>
              <select value={mcId} onChange={(e) => setMcId(e.target.value)} disabled={isMcPastor && mcs.length <= 1}
                      className="h-10 px-3 text-[14px] rounded-lg"
                      style={{ border: "1px solid var(--brand-border)", color: "var(--brand-text)", background: "#fff" }}>
                {!isMcPastor && <option value="">Whole branch</option>}
                {mcs.map((m) => <option key={m.id} value={m.id}>{m.name} only</option>)}
              </select>
            </div>

            {error && <p className="text-[13px]" style={{ color: "var(--brand-danger)" }}>{error}</p>}
          </form>
        </SheetBody>
        <SheetFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}
                  className="h-9 text-[13px]" style={{ borderRadius: 8 }}>Cancel</Button>
          <Button type="submit" form="add-library-form" disabled={busy}
                  className="h-9 text-[13px]" style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}>
            {busy ? (progress !== null && progress < 100 ? `Uploading ${progress}%…` : "Saving…") : "Add to library"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Edit sheet ───────────────────────────────────────────────────────────────

function EditItemSheet({
  item, onClose, onSaved, categories,
}: {
  item:       Item | null;
  onClose:    () => void;
  onSaved:    () => void;
  categories: string[];
}) {
  const [title,        setTitle]        = useState("");
  const [description,  setDescription]  = useState("");
  const [category,     setCategory]     = useState("");
  const [pinned,       setPinned]       = useState(false);
  const [shareEnabled, setShareEnabled] = useState(true);
  const [busy,         setBusy]         = useState(false);
  const [error,        setError]        = useState("");

  useEffect(() => {
    if (!item) return;
    setTitle(item.title);
    setDescription(item.description ?? "");
    setCategory(item.category ?? "");
    setPinned(item.pinned);
    setShareEnabled(item.shareEnabled);
    setError("");
  }, [item]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    setBusy(true);
    const res = await fetch(`/api/library/${item!.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, category, pinned, shareEnabled }),
    });
    setBusy(false);
    if (res.ok) { onSaved(); onClose(); }
    else { const d = await res.json().catch(() => ({})); setError(d.error ?? "Save failed."); }
  }

  const allCategories = Array.from(new Set([...LIBRARY_CATEGORIES, ...categories]));

  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()}>
      <SheetContent width={420}>
        <SheetHeader><SheetTitle>Edit library item</SheetTitle></SheetHeader>
        <SheetBody>
          <form id="edit-library-form" onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className={fieldLabel} style={{ color: "var(--brand-muted)" }}>Title *</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 text-[14px]"
                     style={{ borderColor: "var(--brand-border)" }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={fieldLabel} style={{ color: "var(--brand-muted)" }}>Description</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                        className="text-[14px]" style={{ borderColor: "var(--brand-border)" }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={fieldLabel} style={{ color: "var(--brand-muted)" }}>Category</label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} list="library-categories-edit"
                     className="h-10 text-[14px]" style={{ borderColor: "var(--brand-border)" }} />
              <datalist id="library-categories-edit">
                {allCategories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <label className="flex items-center justify-between gap-3 text-[14px]" style={{ color: "var(--brand-text)" }}>
              Pin to top of library
              <Switch checked={pinned} onCheckedChange={setPinned} />
            </label>
            {item?.kind === "FILE" && (
              <label className="flex items-center justify-between gap-3 text-[14px]" style={{ color: "var(--brand-text)" }}>
                <span>
                  Public share link
                  <span className="block text-[12px]" style={{ color: "var(--brand-muted)" }}>
                    Anyone with the link can open it without logging in
                  </span>
                </span>
                <Switch checked={shareEnabled} onCheckedChange={setShareEnabled} />
              </label>
            )}
            {error && <p className="text-[13px]" style={{ color: "var(--brand-danger)" }}>{error}</p>}
          </form>
        </SheetBody>
        <SheetFooter>
          <Button type="button" variant="outline" onClick={onClose} className="h-9 text-[13px]" style={{ borderRadius: 8 }}>
            Cancel
          </Button>
          <Button type="submit" form="edit-library-form" disabled={busy} className="h-9 text-[13px]"
                  style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const { toast } = useToast();
  const [data,     setData]     = useState<ListResponse | null>(null);
  const [q,        setQ]        = useState("");
  const [kind,     setKind]     = useState<"" | LibraryKind>("");
  const [category, setCategory] = useState("");
  const [adding,   setAdding]   = useState(false);
  const [editing,  setEditing]  = useState<Item | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (kind)     params.set("kind", kind);
    if (category) params.set("category", category);
    const res = await fetch(`/api/library?${params}`);
    if (res.ok) setData(await res.json());
  }, [q, kind, category]);

  // Debounce search typing
  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  async function share(item: Item) {
    const url = shareUrl(item);
    if (!url) {
      toast({ title: "Public link is off", description: "Turn it on from the item's menu to share outside the app." });
      return;
    }
    if (navigator.share) {
      try { await navigator.share({ title: item.title, text: item.description ?? item.title, url }); }
      catch { /* user cancelled */ }
      return;
    }
    await navigator.clipboard.writeText(url);
    toast({ title: "Link copied", description: "Paste it into WhatsApp, email or anywhere else." });
  }

  async function patch(item: Item, body: object, message: string) {
    const res = await fetch(`/api/library/${item.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (res.ok) { toast({ title: message }); load(); }
    else toast({ title: "Something went wrong", variant: "destructive" });
  }

  async function remove(item: Item) {
    if (!window.confirm(`Delete "${item.title}"? Anyone with its share link will lose access.`)) return;
    const res = await fetch(`/api/library/${item.id}`, { method: "DELETE" });
    if (res.ok) { toast({ title: "Deleted" }); load(); }
    else toast({ title: "Could not delete", variant: "destructive" });
  }

  const items = data?.items ?? [];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1200px] mx-auto pb-20 lg:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[24px] font-semibold" style={{ color: "var(--brand-text)" }}>Library</h1>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--brand-muted)" }}>
            Documents, videos and podcasts — ready to share
          </p>
        </div>
        {data?.canAdd && (
          <Button onClick={() => setAdding(true)} className="h-9 px-4 text-[14px] font-medium self-start sm:self-auto"
                  style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}>
            <Plus className="h-4 w-4 mr-1.5" /> Add
          </Button>
        )}
      </div>

      {/* Search + filters */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--brand-muted)" }} />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the library"
                 className="h-10 pl-9 text-[14px]" style={{ borderColor: "var(--brand-border)" }} />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {KIND_TABS.map((t) => (
            <button key={t.key} onClick={() => setKind(t.key)}
                    className="shrink-0 rounded-pill text-[12px] font-medium px-3 py-1.5 transition-colors"
                    style={kind === t.key
                      ? { background: "var(--brand-navy)", color: "#fff" }
                      : { background: "var(--brand-navy-light)", color: "var(--brand-navy)" }}>
              {t.label}
            </button>
          ))}
          {(data?.categories.length ?? 0) > 0 && <span className="shrink-0 w-px mx-1" style={{ background: "var(--brand-border)" }} />}
          {data?.categories.map((c) => (
            <button key={c} onClick={() => setCategory(category === c ? "" : c)}
                    className="shrink-0 rounded-pill text-[12px] font-medium px-3 py-1.5 transition-colors"
                    style={category === c
                      ? { background: "var(--brand-navy)", color: "#fff" }
                      : { border: "1px solid var(--brand-border)", color: "var(--brand-muted)" }}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {!data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-64 rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ border: "1px solid var(--brand-border)" }}>
          <Library style={{ width: 40, height: 40, color: "var(--brand-muted)", margin: "0 auto 12px" }} />
          <p className="text-[14px] font-medium" style={{ color: "var(--brand-text)" }}>
            {q || kind || category ? "Nothing matches" : "The library is empty"}
          </p>
          <p className="text-[13px] mt-1" style={{ color: "var(--brand-muted)" }}>
            {q || kind || category
              ? "Try a different search or filter."
              : data.canAdd ? "Add a PDF, YouTube video or podcast link to get started." : "Check back soon."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onShare={() => share(item)}
              onEdit={() => setEditing(item)}
              onTogglePin={() => patch(item, { pinned: !item.pinned }, item.pinned ? "Unpinned" : "Pinned to top")}
              onToggleShare={() => patch(item, { shareEnabled: !item.shareEnabled },
                item.shareEnabled ? "Public link turned off" : "Public link turned on")}
              onDelete={() => remove(item)}
            />
          ))}
        </div>
      )}

      <AddItemSheet
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={() => { toast({ title: "Added to library" }); load(); }}
        categories={data?.categories ?? []}
        storageReady={data?.storageReady ?? false}
      />
      <EditItemSheet
        item={editing}
        onClose={() => setEditing(null)}
        onSaved={load}
        categories={data?.categories ?? []}
      />
    </div>
  );
}
