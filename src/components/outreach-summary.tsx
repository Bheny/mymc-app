"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Heart, Megaphone, PhoneCall, Radar } from "lucide-react";
import { Segmented } from "@/components/attendance/dash-ui";

// Outreach and follow-up numbers for the main overview: souls won, how far the people we've met
// have got, who needs a follow-up, and — for buscentre heads and above — the guests who've come
// often enough that it's time for a conversation about staying.

type Data = {
  period: "launch" | "month"; since: string; quietDays: number;
  souls:  { total: number; tracker: number; outreach: number };
  funnel: { met: number; reached: number; invited: number; came: number; joined: number };
  needs:  { open: number; notContacted: number; noCell: number; missedInvite: number; quiet: number; total: number };
  radar:  { radar: number; wants: number; nearly: number; names: string[] } | null;
};

function Card({ title, value, icon, color, href, children }: {
  title: string; value: number | string; icon: React.ReactNode; color?: string; href?: string; children?: React.ReactNode;
}) {
  const body = (
    <div className="bg-[var(--surface)] rounded-xl p-5 flex flex-col gap-3 h-full" style={{ border: "1px solid var(--brand-border)" }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium uppercase tracking-[0.04em] leading-none" style={{ color: "var(--brand-muted)" }}>{title}</span>
        <span className="shrink-0" style={{ color: "var(--brand-muted)" }}>{icon}</span>
      </div>
      <span className="text-[32px] font-semibold leading-none" style={{ color: color ?? "var(--brand-text)" }}>{value}</span>
      <div className="text-[12px] flex flex-col gap-0.5" style={{ color: "var(--brand-muted)" }}>{children}</div>
    </div>
  );
  return href ? <Link href={href} className="block hover:opacity-90 transition-opacity">{body}</Link> : body;
}

export function OutreachSummary({ actingParam = "" }: { actingParam?: string }) {
  const [period, setPeriod] = useState<"launch" | "month">("launch");
  const { data, error } = useSWR<Data>(`/api/overview/outreach?period=${period}${actingParam ? `&${actingParam}` : ""}`);

  const warn = "var(--brand-warning)";
  return (
    <section className="flex flex-col gap-3 mb-2">
      <div className="flex items-center gap-3 my-6 mb-1">
        <span className="text-[12px] font-medium uppercase tracking-[0.04em] whitespace-nowrap" style={{ color: "var(--brand-muted)" }}>Outreach &amp; follow-up</span>
        <div className="flex-1 h-px" style={{ background: "var(--brand-border)" }} />
        <Segmented<"launch" | "month"> ariaLabel="Period" value={period} onChange={setPeriod}
          options={[{ key: "month", label: "This month" }, { key: "launch", label: "Since launch" }]} />
      </div>

      {error && !data ? (
        <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>Couldn&apos;t load the outreach numbers.</p>
      ) : !data ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-[132px] rounded-xl" />)}</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {data.radar && (
            <Card title="On the radar" value={data.radar.radar} icon={<Radar className="h-4 w-4" />}
                  color={data.radar.radar ? warn : undefined} href="/evangelism?tab=radar">
              {data.radar.radar > 0 ? (
                <>
                  <span>{data.radar.names.join(", ")}{data.radar.radar > data.radar.names.length ? ` +${data.radar.radar - data.radar.names.length}` : ""}</span>
                  <span style={{ color: warn }}>3+ services this month · time to talk</span>
                </>
              ) : <span>No one waiting for a conversation</span>}
              {data.radar.wants > 0 && <span>{data.radar.wants} want{data.radar.wants === 1 ? "s" : ""} to join · add to their cell</span>}
              {data.radar.nearly > 0 && <span>{data.radar.nearly} one service away</span>}
            </Card>
          )}
          <Card title="Souls won" value={data.souls.total} icon={<Heart className="h-4 w-4" />}>
            {data.souls.total ? <span>{data.souls.outreach} on outreach · {data.souls.tracker} soul tracker</span> : <span>None recorded yet</span>}
          </Card>
          <Card title="People met on outreach" value={data.funnel.met} icon={<Megaphone className="h-4 w-4" />} href="/evangelism">
            {data.funnel.met ? (
              <>
                <span>{data.funnel.reached} reached · {data.funnel.invited} invited</span>
                <span>{data.funnel.came} came to a service{data.funnel.joined ? ` · ${data.funnel.joined} joined` : ""}</span>
              </>
            ) : <span>No outreach contacts yet</span>}
          </Card>
          <Card title="Needs follow-up" value={data.needs.total} icon={<PhoneCall className="h-4 w-4" />} href="/evangelism"
                color={data.needs.total ? warn : data.needs.open ? "var(--brand-success)" : undefined}>
            {data.needs.total ? (
              <>
                {data.needs.notContacted > 0 && <span>{data.needs.notContacted} not contacted yet</span>}
                {data.needs.missedInvite > 0 && <span>{data.needs.missedInvite} missed their invite</span>}
                {data.needs.quiet > 0 && <span>{data.needs.quiet} quiet for {data.quietDays}+ days</span>}
                {data.needs.noCell > 0 && <span>{data.needs.noCell} not assigned to a cell</span>}
              </>
            ) : <span>{data.needs.open ? "Everyone is up to date" : "No open outreach contacts"}</span>}
          </Card>
        </div>
      )}
    </section>
  );
}
