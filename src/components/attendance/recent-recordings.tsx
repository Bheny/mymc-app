"use client";

import Link from "next/link";
import useSWR from "swr";
import { ChevronRight } from "lucide-react";
import { Card, fmt } from "@/components/attendance/dash-ui";
import { formatDay, TYPE_LABEL, type SvcType } from "@/lib/attendance-dashboard";

// For buscentre heads: the services recorded across their buscentre, each one a link to its page
// where attendance can be checked and corrected.

type Row = {
  id: string; type: string; date: string; mode: string; cancelled: boolean;
  cell: { id: string; name: string }; firstTimers: number;
  stats: { total: number; present: number; absent: number; excused: number };
};

const label = (t: string) => (t in TYPE_LABEL ? TYPE_LABEL[t as SvcType] : t === "SHEPHERDS_MEETING" ? "Shepherds meeting" : "Special meeting");

export function RecentRecordings({ actingParam }: { actingParam: string }) {
  const { data, error } = useSWR<Row[]>(`/api/services/recent?take=20${actingParam ? `&${actingParam}` : ""}`);

  return (
    <Card title="Recent recordings" subtitle="Open a service to check it or correct anyone's attendance">
      {error && !data ? (
        <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>Couldn&apos;t load the recorded services.</p>
      ) : !data ? (
        <div className="flex flex-col gap-2">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-12 rounded-lg" />)}</div>
      ) : data.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>Nothing has been recorded yet.</p>
      ) : (
        <ul className="flex flex-col">
          {data.map((s) => (
            <li key={s.id} className="border-t first:border-t-0" style={{ borderColor: "var(--brand-border)" }}>
              <Link href={`/attendance/${s.id}`} className="flex items-center gap-3 py-3 hover:bg-[var(--brand-navy-light)] -mx-2 px-2 rounded-lg transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium truncate" style={{ color: "var(--brand-text)" }}>
                    {s.cell.name} <span className="font-normal" style={{ color: "var(--brand-muted)" }}>· {label(s.type)}{s.mode === "ONLINE" ? " · online" : ""}</span>
                  </p>
                  <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
                    {formatDay(s.date.slice(0, 10), { weekday: "short", day: "numeric", month: "short" })}
                    {s.cancelled ? " · cancelled" : ` · ${fmt(s.stats.present)} of ${fmt(s.stats.total)} present${s.firstTimers ? ` · ${s.firstTimers} first timer${s.firstTimers === 1 ? "" : "s"}` : ""}`}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--brand-muted)" }} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
