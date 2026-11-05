"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter,
} from "@/components/ui/sheet";
import { Segmented, selectStyle } from "@/components/attendance/dash-ui";
import { buildAttendanceReport, reportDate, type AttendanceReportData } from "@/lib/attendance-report";

// wa.me links with very long text get truncated by some browsers
const WA_LINK_LIMIT = 3500;

type Type = "LC_LIVE" | "MGS";
const suggestType = (): Type => (new Date().getDay() === 3 ? "LC_LIVE" : new Date().getDay() === 0 ? "MGS" : "LC_LIVE");

/**
 * The attendance report for one bacenta at one service, in the WhatsApp format the groups use:
 * pick the service and date, check the preview, then copy it or send it to WhatsApp.
 * A bacenta head always gets their own bacenta; everyone above picks one.
 */
export function AttendanceReportSheet({ open, onClose, role, actingParam }: {
  open: boolean; onClose: () => void; role?: string; actingParam: string;
}) {
  const picksBacenta = role === "admin" || role === "chief_shepherd" || role === "mc_pastor";

  const [type, setType] = useState<Type>(suggestType);
  const [date, setDate] = useState("");
  const [bacentaId, setBacentaId] = useState("");
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState("");

  const { data: bacentas } = useSWR<{ id: string; name: string }[]>(open && picksBacenta ? "/api/org/buscentres" : null);

  const key = open && (!picksBacenta || bacentaId)
    ? `/api/attendance/report?type=${type}${date ? `&date=${date}` : ""}${bacentaId ? `&buscentreId=${bacentaId}` : ""}${actingParam ? `&${actingParam}` : ""}`
    : null;
  const { data, error } = useSWR<AttendanceReportData>(key);

  const text = useMemo(() => (data ? buildAttendanceReport(data) : ""), [data]);

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
    if (navigator.share) { try { await navigator.share({ text }); } catch { /* cancelled */ } return; }
    if (text.length <= WA_LINK_LIMIT) { window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener"); return; }
    if (await copy()) {
      setNotice("The report is long, so it's been copied — paste it into the WhatsApp group.");
      window.open("https://web.whatsapp.com/", "_blank", "noopener");
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent width={520}>
        <SheetHeader>
          <SheetTitle>Attendance report</SheetTitle>
          <SheetDescription>Names of everyone present, cell by cell, ready to post in WhatsApp.</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--brand-muted)" }}>Service</span>
                <Segmented<Type> ariaLabel="Service" value={type} onChange={(t) => { setType(t); setDate(""); }}
                  options={[{ key: "LC_LIVE", label: "LC Live" }, { key: "MGS", label: "MGS" }]} />
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--brand-muted)" }}>Date</span>
                <input type="date" value={date || data?.date || ""} onChange={(e) => setDate(e.target.value)}
                       className="h-10 sm:h-9 px-3 text-[13px] rounded-lg" style={selectStyle} />
              </label>
            </div>

            {data && data.dates.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {data.dates.slice(0, 5).map((d) => (
                  <button key={d} type="button" onClick={() => setDate(d)}
                          className="h-8 px-2.5 rounded-pill text-[12px] font-medium"
                          style={(date || data.date) === d
                            ? { background: "var(--brand-navy)", color: "#fff" }
                            : { background: "var(--brand-navy-light)", color: "var(--brand-link)" }}>
                    {reportDate(d)}
                  </button>
                ))}
              </div>
            )}

            {picksBacenta && (
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--brand-muted)" }}>Bacenta</span>
                <select value={bacentaId} onChange={(e) => { setBacentaId(e.target.value); setDate(""); }}
                        className="h-10 sm:h-9 px-3 text-[13px] rounded-lg" style={selectStyle}>
                  <option value="">Choose a bacenta…</option>
                  {(bacentas ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
            )}

            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--brand-muted)" }}>
                Preview{text ? <span className="normal-case tracking-normal font-normal"> · {text.length.toLocaleString()} characters</span> : null}
              </p>
              {!key ? (
                <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>Choose a bacenta to see its report.</p>
              ) : error && !data ? (
                <p className="text-[13px]" style={{ color: "var(--brand-danger)" }}>{error.message || "Couldn't build the report."}</p>
              ) : !data ? (
                <div className="skeleton h-40 rounded-lg" />
              ) : (
                <>
                  <pre className="whitespace-pre-wrap break-words rounded-lg p-3 text-[12.5px] leading-relaxed font-sans max-h-[50dvh] overflow-y-auto select-text"
                       style={{ background: "var(--wa-bubble-bg)", color: "var(--wa-bubble-fg)", border: "1px solid var(--wa-bubble-border)" }}>
                    {text}
                  </pre>
                  {!data.date && (
                    <p className="text-[12px]" style={{ color: "var(--brand-warning)" }}>No {type === "MGS" ? "MGS" : "LC Live"} has been recorded for this bacenta yet.</p>
                  )}
                  <p className="text-[11px]" style={{ color: "var(--brand-muted)" }}>
                    *Stars* turn bold once posted in WhatsApp. Mark someone &ldquo;Joined online&rdquo; when recording to show (Online).
                  </p>
                </>
              )}
            </div>

            {notice && <p className="text-[12px]" style={{ color: "var(--brand-link)" }}>{notice}</p>}
          </div>
        </SheetBody>
        <SheetFooter>
          <Button variant="outline" onClick={copy} disabled={!text} className="h-10 sm:h-9 text-[13px]" style={{ borderRadius: 8 }}>
            {copied ? <><Check className="h-4 w-4 mr-1.5" /> Copied</> : <><Copy className="h-4 w-4 mr-1.5" /> Copy</>}
          </Button>
          <Button onClick={share} disabled={!text} className="h-10 sm:h-9 text-[13px]" style={{ background: "#128C7E", color: "#fff", borderRadius: 8 }}>
            <Share2 className="h-4 w-4 mr-1.5" /> Share to WhatsApp
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
