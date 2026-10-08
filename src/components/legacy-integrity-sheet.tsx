"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter,
} from "@/components/ui/sheet";
import {
  buildIntegrityReport, INTEGRITY_SECTIONS, type IntegrityInput, type IntegritySection,
} from "@/lib/legacy-integrity";

// wa.me links with very long text get truncated by some browsers
const WA_LINK_LIMIT = 3500;

const ALL_ON = Object.fromEntries(
  Object.keys(INTEGRITY_SECTIONS).map((k) => [k, true]),
) as Record<IntegritySection, boolean>;

/**
 * Data-integrity report for the current Legacy view, formatted for a
 * WhatsApp group: pick sections, preview, then copy or share.
 */
export function LegacyIntegritySheet({
  open, onClose, input,
}: {
  open:    boolean;
  onClose: () => void;
  input:   Omit<IntegrityInput, "sections">;
}) {
  const [sections, setSections] = useState(ALL_ON);
  const [copied,   setCopied]   = useState(false);
  const [notice,   setNotice]   = useState("");

  const { text, counts } = useMemo(() => buildIntegrityReport({ ...input, sections }), [input, sections]);

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
          <SheetTitle>Data integrity report</SheetTitle>
          <SheetDescription>
            For the current filters · formatted for WhatsApp
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          <div className="flex flex-col gap-4">
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-[11px] font-semibold uppercase tracking-[0.07em] mb-1.5" style={{ color: "var(--brand-muted)" }}>
                Include
              </legend>
              {(Object.keys(INTEGRITY_SECTIONS) as IntegritySection[]).map((k) => (
                <label key={k} className="flex items-center justify-between gap-3 text-[13px] cursor-pointer"
                       style={{ color: counts[k] ? "var(--brand-text)" : "var(--brand-muted)" }}>
                  <span className="flex items-center gap-2">
                    <input type="checkbox" checked={sections[k]} onChange={(e) => setSections((s) => ({ ...s, [k]: e.target.checked }))}
                           className="h-4 w-4 accent-[var(--brand-navy)]" />
                    {INTEGRITY_SECTIONS[k]}
                  </span>
                  <span className="tabular-nums text-[12px] rounded-pill px-2 py-0.5"
                        style={counts[k] ? { background: "var(--tint-warn-bg)", color: "var(--tint-warn-fg)" } : { color: "var(--brand-muted)" }}>
                    {counts[k] || "none"}
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
          <Button variant="outline" onClick={copy} className="h-9 text-[13px]" style={{ borderRadius: 8 }}>
            {copied ? <><Check className="h-4 w-4 mr-1.5" /> Copied</> : <><Copy className="h-4 w-4 mr-1.5" /> Copy</>}
          </Button>
          <Button onClick={share} className="h-9 text-[13px]" style={{ background: "#128C7E", color: "#fff", borderRadius: 8 }}>
            <Share2 className="h-4 w-4 mr-1.5" /> Share to WhatsApp
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
