"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Clock, HelpCircle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody } from "@/components/ui/sheet";

type MemberStatus = "PRESENT" | "ABSENT" | "EXCUSED" | "NOT_MARKED";

type MemberRow = {
  id:       string;
  name:     string;
  phone:    string | null;
  isActive: boolean;
  status:   MemberStatus;
};

type CellDetail = {
  cell: {
    id:         string;
    name:       string;
    buscentre:  { id: string; name: string } | null;
    mc:         { id: string; name: string } | null;
  };
  serviceType: string;
  threshold:   number;
  service:     { id: string; date: string; speaker: string | null; mode: string } | null;
  present:     number;
  total:       number;
  members:     MemberRow[];
};

const STATUS_CONFIG: Record<MemberStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  PRESENT:    { label: "Present",    color: "var(--brand-success)", icon: CheckCircle2 },
  ABSENT:     { label: "Absent",     color: "var(--brand-danger)",  icon: XCircle },
  EXCUSED:    { label: "Excused",    color: "var(--brand-warning)", icon: Clock },
  NOT_MARKED: { label: "Not marked", color: "var(--brand-muted)",   icon: HelpCircle },
};

const SERVICE_LABEL: Record<string, string> = {
  MGS:             "MGS (Sun)",
  LC_LIVE:         "LC Live (Wed)",
  SPECIAL_MEETING: "Special Meeting",
};

function formatDate(iso: string | null) {
  if (!iso) return "No service recorded yet";
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export function LeaderboardCellSheet({
  cellId,
  serviceType,
  open,
  onOpenChange,
}: {
  cellId:       string | null;
  serviceType:  string;
  open:         boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [data,    setData]    = useState<CellDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !cellId) return;
    setLoading(true);
    setData(null);
    fetch(`/api/leaderboard/${cellId}?serviceType=${serviceType}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, cellId, serviceType]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent width={420}>
        <SheetHeader>
          <SheetTitle>{data?.cell.name ?? "Cell details"}</SheetTitle>
          <SheetDescription>
            {data ? `${data.cell.buscentre?.name ?? "—"} · ${data.cell.mc?.name ?? "—"}` : "Loading…"}
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          {loading || !data ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="rounded-xl p-4 mb-5" style={{ border: "1px solid var(--brand-border)", background: "#FAFAFA" }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.05em]" style={{ color: "var(--brand-muted)" }}>
                    {SERVICE_LABEL[data.serviceType] ?? data.serviceType}
                  </span>
                  <span className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
                    {formatDate(data.service?.date ?? null)}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[28px] font-semibold" style={{ color: "var(--brand-text)" }}>{data.present}</span>
                  <span className="text-[14px]" style={{ color: "var(--brand-muted)" }}>/ {data.total} members present</span>
                </div>
                {data.service?.speaker && (
                  <p className="text-[12px] mt-1" style={{ color: "var(--brand-muted)" }}>Speaker: {data.service.speaker}</p>
                )}
                <p className="text-[12px] mt-1.5 font-medium"
                   style={{ color: data.present >= data.threshold ? "var(--brand-success)" : "var(--brand-muted)" }}>
                  {data.present >= data.threshold
                    ? `Crossed the ${data.threshold} mark`
                    : `${data.threshold - data.present} short of the ${data.threshold} mark`}
                </p>
              </div>

              {/* Member list */}
              <p className="text-[11px] font-semibold uppercase tracking-[0.05em] mb-2" style={{ color: "var(--brand-muted)" }}>
                Members ({data.members.length})
              </p>
              <div className="flex flex-col">
                {data.members.length === 0 ? (
                  <p className="text-[13px] py-6 text-center" style={{ color: "var(--brand-muted)" }}>
                    No members in this cell yet.
                  </p>
                ) : data.members.map((m, i) => {
                  const cfg  = STATUS_CONFIG[m.status];
                  const Icon = cfg.icon;
                  return (
                    <div key={m.id} className="flex items-center gap-3 py-2.5"
                         style={{ borderTop: i === 0 ? "none" : "1px solid var(--brand-border)" }}>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-[13px] font-medium" style={{ color: "var(--brand-text)" }}>{m.name}</p>
                        {m.phone && <p className="truncate text-[12px]" style={{ color: "var(--brand-muted)" }}>{m.phone}</p>}
                      </div>
                      <span className="flex items-center gap-1 text-[12px] font-medium shrink-0" style={{ color: cfg.color }}>
                        <Icon className="h-3.5 w-3.5" /> {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
