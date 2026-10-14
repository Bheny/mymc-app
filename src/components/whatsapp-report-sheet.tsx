"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter,
} from "@/components/ui/sheet";

// wa.me links with very long text get truncated by some browsers
const WA_LINK_LIMIT = 3500;

export type ReportSection = {
  key:   string;
  label: string;
  /** How many items the section would list; 0 = nothing to say, so it starts unticked */
  count: number;
};

/**
 * Pick which parts of a summary to include, preview the WhatsApp message, then copy it
 * or send it to WhatsApp. The caller supplies the sections and the function that turns
 * the ticked ones into text.
 */
export function WhatsAppReportSheet({
  open, onClose, title, description, sections, build,
}: {
  open:        boolean;
  onClose:     () => void;
  title:       string;
  description: string;
  sections:    ReportSection[];
  build:       (selected: Record<string, boolean>) => string;
}) {
  // What the user has toggled; anything they haven't touched follows "has something to say"
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const [copied,  setCopied]  = useState(false);
  const [notice,  setNotice]  = useState("");

  const selected = useMemo(
    () => Object.fromEntries(sections.map((s) => [s.key, toggled[s.key] ?? s.count > 0])),
    [sections, toggled],
  );
  const text = useMemo(() => build(selected), [build, selected]);
  const anySelected = Object.values(selected).some(Boolean);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return true;
    } catch {
      setNotice("Couldn't copy automatically — select the text and copy it.");
      return false;
    }
  }

  async function share() {
    setNotice("");
    // Phones: the share sheet goes straight to WhatsApp with the full text
    if (navigator.share) {
      try { await navigator.share({ text }); } catch { /* cancelled */ }
      return;
    }
    if (text.length <= WA_LINK_LIMIT) {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
      return;
    }
    // Too long for a link — copy and let them paste
    if (await copy()) {
      setNotice("The report is long, so it's been copied — paste it into the WhatsApp group.");
      window.open("https://web.whatsapp.com/", "_blank", "noopener");
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent width={560}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <div className="flex flex-col gap-4">
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-[11px] font-semibold uppercase tracking-[0.07em] mb-1.5" style={{ color: "var(--brand-muted)" }}>
                Include
              </legend>
              {sections.map((s) => (
                <label key={s.key} className="flex items-center justify-between gap-3 text-[13px] cursor-pointer"
                       style={{ color: s.count ? "var(--brand-text)" : "var(--brand-muted)" }}>
                  <span className="flex items-center gap-2">
                    <input type="checkbox" checked={selected[s.key]}
                           onChange={(e) => setToggled((t) => ({ ...t, [s.key]: e.target.checked }))}
                           className="h-4 w-4 accent-[var(--brand-navy)]" />
                    {s.label}
                  </span>
                  <span className="tabular-nums text-[12px] rounded-pill px-2 py-0.5" style={{ color: "var(--brand-muted)" }}>
                    {s.count > 1 ? s.count : s.count === 1 ? "" : "nothing"}
                  </span>
                </label>
              ))}
            </fieldset>

            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--brand-muted)" }}>
                Preview <span className="normal-case tracking-normal font-normal">· {text.length.toLocaleString()} characters</span>
              </p>
              <pre className="whitespace-pre-wrap break-words rounded-lg p-3 text-[12.5px] leading-relaxed font-sans max-h-[50vh] overflow-y-auto select-text"
                   style={{ background: "var(--wa-bubble-bg)", color: "var(--wa-bubble-fg)", border: "1px solid var(--wa-bubble-border)" }}>
                {text}
              </pre>
              <p className="text-[11px]" style={{ color: "var(--brand-muted)" }}>
                *Stars* turn bold and _underscores_ italic once posted in WhatsApp.
              </p>
            </div>

            {notice && <p className="text-[12px]" style={{ color: "var(--brand-link)" }}>{notice}</p>}
          </div>
        </SheetBody>
        <SheetFooter>
          <Button variant="outline" onClick={copy} disabled={!anySelected} className="h-9 text-[13px]" style={{ borderRadius: 8 }}>
            {copied ? <><Check className="h-4 w-4 mr-1.5" /> Copied</> : <><Copy className="h-4 w-4 mr-1.5" /> Copy</>}
          </Button>
          <Button onClick={share} disabled={!anySelected} className="h-9 text-[13px]"
                  style={{ background: "#128C7E", color: "#fff", borderRadius: 8 }}>
            <Share2 className="h-4 w-4 mr-1.5" /> Share to WhatsApp
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
