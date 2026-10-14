"use client";

import Link from "next/link";
import useSWR from "swr";
import { LoadError } from "@/components/load-error";
import { MembershipActions } from "@/components/evangelism/membership-actions";
import { formatDay, formatMonth } from "@/lib/attendance-dashboard";
import { CONVERSATION_LABEL, RADAR_VISITS } from "@/lib/radar";
import type { RadarPerson } from "@/lib/evangelism-radar";

// Guests who aren't members yet and keep coming. The buscentre head speaks to anyone who has been to
// 3+ services this month; people who said they want to join are ready to be added to their cell.

type Data = { people: RadarPerson[]; counts: { radar: number; wants: number; nearly: number } };

function Person({ p, onChanged, canAdd }: { p: RadarPerson; onChanged: () => void; canAdd: boolean }) {
  const month = p.reachedOn ? formatMonth(p.reachedOn.slice(0, 7), true) : null;
  return (
    <div className="rounded-xl p-4 flex flex-col gap-3" style={{ border: "1px solid var(--brand-border)", background: "var(--surface)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/evangelism/people/${p.id}`} className="text-[15px] font-medium hover:underline" style={{ color: "var(--brand-text)" }}>{p.name}</Link>
          <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
            {p.cellName ?? <span style={{ color: "var(--brand-warning)" }}>No cell yet</span>}{p.phone ? ` · ${p.phone}` : ""}
          </p>
        </div>
        <span className="text-[12px] font-medium px-2.5 py-1 rounded-full shrink-0 tabular-nums" style={{ background: "var(--brand-navy-light)", color: p.group === "nearly" ? "var(--brand-muted)" : "var(--brand-warning)" }}>
          {p.visits} service{p.visits === 1 ? "" : "s"} this month
        </span>
      </div>

      <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
        {p.visitDates.length ? `Came on ${p.visitDates.map((d) => formatDay(d)).join(", ")}` : "No visits recorded"}
        {p.group === "radar" && month ? ` · reached ${RADAR_VISITS} in ${month}` : ""}
        {p.group === "nearly" ? ` · one more reaches ${RADAR_VISITS}` : ""}
      </p>

      {p.conversation && (
        <p className="text-[12px] rounded-lg px-3 py-2" style={{ background: "var(--brand-navy-light)", color: "var(--brand-text)" }}>
          Last conversation ({formatDay(p.conversation.at.slice(0, 10), { day: "numeric", month: "short" })}): <b>{CONVERSATION_LABEL[p.conversation.outcome ?? ""] ?? "recorded"}</b>
          {p.conversation.note ? ` — ${p.conversation.note}` : ""}
        </p>
      )}

      {p.group !== "nearly" && (
        <MembershipActions contactId={p.id} canConverse={p.group === "radar"} canAdd={canAdd} hasSurname={p.name.includes(" ")} hasCell={!!p.cellId} onChanged={onChanged} compact />
      )}
    </div>
  );
}

export function RadarList({ actingParam, canAdd }: { actingParam: string; canAdd: boolean }) {
  const { data, error, mutate } = useSWR<Data>(`/api/evangelism/radar${actingParam ? `?${actingParam}` : ""}`);
  if (error && !data) return <LoadError compact message={error.message ?? "Couldn't load the radar"} onRetry={() => mutate()} />;
  if (!data) return <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>Loading…</p>;

  const groups: { key: RadarPerson["group"]; title: string; hint: string }[] = [
    { key: "radar",  title: "Time for a conversation", hint: `Came to ${RADAR_VISITS}+ services this month. Ask if they would love to stay.` },
    { key: "wants",  title: "Want to join",            hint: "Said yes — add them to their cell." },
    { key: "nearly", title: "One service away",        hint: `Two services this month. One more brings them to you.` },
  ];

  if (data.people.length === 0) {
    return (
      <div className="text-center py-12 text-[14px]" style={{ color: "var(--brand-muted)" }}>
        No one on the radar. Guests who come to {RADAR_VISITS} services in a month appear here.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {groups.map((g) => {
        const list = data.people.filter((p) => p.group === g.key);
        if (!list.length) return null;
        return (
          <section key={g.key} className="flex flex-col gap-3">
            <div>
              <h2 className="text-[14px] font-semibold" style={{ color: "var(--brand-text)" }}>{g.title} · {list.length}</h2>
              <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>{g.hint}</p>
            </div>
            {list.map((p) => <Person key={p.id} p={p} canAdd={canAdd} onChanged={() => mutate()} />)}
          </section>
        );
      })}
    </div>
  );
}
