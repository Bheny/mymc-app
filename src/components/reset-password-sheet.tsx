"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Copy, KeyRound, Loader2, Share2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter,
} from "@/components/ui/sheet";
import { fetchJson } from "@/lib/fetch-json";

type Info =
  | { allowed: false; error: string }
  | { allowed: true; user: { name: string | null; email: string }; lastReset: { at: string; by: string | null } | null };

type Result = { tempPassword: string; user: { name: string | null; email: string } };

const whenLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * Reset someone's password: confirm → a temporary password is shown ONCE, with a
 * ready-to-send WhatsApp message. They must choose their own at next login.
 */
export function ResetPasswordSheet({
  open, onClose, userId, displayName,
}: {
  open:        boolean;
  onClose:     () => void;
  userId:      string;
  displayName: string;
}) {
  const [info,    setInfo]    = useState<Info | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState("");
  const [result,  setResult]  = useState<Result | null>(null);
  const [copied,  setCopied]  = useState<"password" | "message" | null>(null);

  // Check permission and the last reset when opened; forget everything — including the
  // password — when closed
  useEffect(() => {
    if (!open) { setInfo(null); setError(""); setResult(null); setCopied(null); setBusy(false); return; }
    let alive = true;
    setLoading(true);
    fetchJson<Info>(`/api/org/users/${userId}/reset-password`)
      .then((d) => { if (alive) setInfo(d); })
      .catch((e) => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open, userId]);

  async function reset() {
    setBusy(true); setError("");
    try {
      setResult(await fetchJson<Result>(`/api/org/users/${userId}/reset-password`, { method: "POST", timeoutMs: 30_000 }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const message = useMemo(() => {
    if (!result) return "";
    const first = (result.user.name ?? displayName).split(" ")[0];
    return [
      `Hi ${first},`,
      "",
      "Your MyMC password has been reset.",
      "",
      `🔗 ${window.location.origin}/login`,
      `✉️ Email: ${result.user.email}`,
      `🔑 Temporary password: ${result.tempPassword}`,
      "",
      "You'll be asked to choose your own password when you log in. Please don't share this message with anyone.",
    ].join("\n");
  }, [result, displayName]);

  async function copy(what: "password" | "message") {
    try {
      await navigator.clipboard.writeText(what === "password" ? result!.tempPassword : message);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("Couldn't copy automatically — select the text and copy it.");
    }
  }

  async function share() {
    if (navigator.share) {
      try { await navigator.share({ text: message }); } catch { /* cancelled */ }
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  }

  const allowed = info?.allowed ? info : null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent width={460}>
        <SheetHeader>
          <SheetTitle>{result ? "Password reset" : "Reset password"}</SheetTitle>
          <SheetDescription>{displayName}</SheetDescription>
        </SheetHeader>

        <SheetBody>
          {result ? (
            <div className="flex flex-col gap-4">
              <p className="rounded-lg px-3 py-2.5 text-[13px] flex items-start gap-2"
                 style={{ background: "var(--tint-ok-bg)", color: "var(--tint-ok-fg)" }}>
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                {result.user.name ?? displayName}&apos;s old password no longer works. Send them the temporary one below.
              </p>

              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--brand-muted)" }}>
                  Temporary password
                </p>
                <div className="flex items-center justify-between gap-3 rounded-lg px-4 py-3"
                     style={{ background: "var(--brand-navy-light)", border: "1px solid var(--brand-border)" }}>
                  <code className="text-[20px] font-semibold tracking-wider select-all" style={{ color: "var(--brand-text)" }}>
                    {result.tempPassword}
                  </code>
                  <Button variant="outline" onClick={() => copy("password")} className="h-8 text-[12px] shrink-0" style={{ borderRadius: 8 }}>
                    {copied === "password" ? <><Check className="h-3.5 w-3.5 mr-1" /> Copied</> : <><Copy className="h-3.5 w-3.5 mr-1" /> Copy</>}
                  </Button>
                </div>
                <p className="text-[12px] flex items-start gap-1.5" style={{ color: "var(--tint-warn-fg)" }}>
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  This is the only time it&apos;s shown. If it&apos;s lost, reset again.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--brand-muted)" }}>
                  Message to send
                </p>
                <pre className="whitespace-pre-wrap break-words rounded-lg p-3 text-[12.5px] leading-relaxed font-sans select-text"
                     style={{ background: "var(--wa-bubble-bg)", color: "var(--wa-bubble-fg)", border: "1px solid var(--wa-bubble-border)" }}>
                  {message}
                </pre>
              </div>
              {error && <p className="text-[12px]" style={{ color: "var(--brand-danger)" }}>{error}</p>}
            </div>
          ) : loading ? (
            <div className="flex flex-col gap-3">
              <div className="skeleton h-16 rounded-xl" />
              <div className="skeleton h-24 rounded-xl" />
            </div>
          ) : info && !info.allowed ? (
            <p className="rounded-lg px-3 py-2.5 text-[13px] flex items-start gap-2"
               style={{ background: "var(--tint-warn-bg)", color: "var(--tint-warn-fg)" }}>
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {info.error}
            </p>
          ) : allowed ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: "var(--brand-navy-light)" }}>
                <KeyRound className="h-5 w-5 shrink-0" style={{ color: "var(--brand-link)" }} />
                <div className="min-w-0">
                  <p className="text-[14px] font-medium truncate" style={{ color: "var(--brand-text)" }}>{allowed.user.name ?? displayName}</p>
                  <p className="text-[12px] truncate" style={{ color: "var(--brand-muted)" }}>{allowed.user.email}</p>
                </div>
              </div>
              <ul className="flex flex-col gap-1.5 text-[13px]" style={{ color: "var(--brand-text)" }}>
                <li>• Their current password stops working straight away.</li>
                <li>• You&apos;ll get a temporary password to send them.</li>
                <li>• They choose their own when they next log in.</li>
              </ul>
              {allowed.lastReset && (
                <p className="rounded-lg px-3 py-2 text-[12px] flex items-start gap-1.5"
                   style={{ background: "var(--tint-warn-bg)", color: "var(--tint-warn-fg)" }}>
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  Already reset on {whenLabel(allowed.lastReset.at)}{allowed.lastReset.by ? ` by ${allowed.lastReset.by}` : ""}.
                </p>
              )}
              {error && <p className="text-[13px]" style={{ color: "var(--brand-danger)" }}>{error}</p>}
            </div>
          ) : (
            <p className="text-[13px]" style={{ color: "var(--brand-danger)" }}>{error || "Couldn't check this account."}</p>
          )}
        </SheetBody>

        <SheetFooter>
          {result ? (
            <>
              <Button variant="outline" onClick={() => copy("message")} className="h-9 text-[13px]" style={{ borderRadius: 8 }}>
                {copied === "message" ? <><Check className="h-4 w-4 mr-1.5" /> Copied</> : <><Copy className="h-4 w-4 mr-1.5" /> Copy message</>}
              </Button>
              <Button onClick={share} className="h-9 text-[13px]" style={{ background: "#128C7E", color: "#fff", borderRadius: 8 }}>
                <Share2 className="h-4 w-4 mr-1.5" /> Share to WhatsApp
              </Button>
              <Button variant="outline" onClick={onClose} className="h-9 text-[13px]" style={{ borderRadius: 8 }}>Done</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} className="h-9 text-[13px]" style={{ borderRadius: 8 }}>Cancel</Button>
              <Button onClick={reset} disabled={!allowed || busy} className="h-9 text-[13px]"
                      style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}>
                {busy ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Resetting…</> : "Reset password"}
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
