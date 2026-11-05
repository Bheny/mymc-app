"use client";

import { useState } from "react";
import useSWR from "swr";
import { Phone, Search } from "lucide-react";
import { Card, Segmented } from "@/components/attendance/dash-ui";
import { formatDay, TYPE_LABEL, type SvcType } from "@/lib/attendance-dashboard";

// Everyone marked absent (or excused) at an LC Live or MGS service this week — or last week — in
// the viewer's scope, with the services they missed and a tap-to-call number, so they can be followed up.

type Missed = { type: string; date: string; status: string };
type Person = {
  id: string; name: string; phone: string | null; shepherd: string | null;
  cellId: string; cell: string; buscentre: string; missed: Missed[];
};
type Data = {
  from: string; to: string; today: string; people: Person[];
  totals: { people: number; absences: number; absent: number };
};

const INITIAL = 15;

function MissedBadge({ m }: { m: Missed }) {
  const absent = m.status === "ABSENT";
  return (
    <span className="rounded-pill text-[11px] font-medium px-2 py-0.5 whitespace-nowrap"
          style={absent
            ? { background: "var(--tint-danger-bg)", color: "var(--tint-danger-fg)" }
            : { background: "var(--tint-warn-bg)", color: "var(--tint-warn-fg)" }}>
      {TYPE_LABEL[m.type as SvcType] ?? m.type} · {formatDay(m.date)}{absent ? "" : " · excused"}
    </span>
  );
}

export function MissedThisWeek({ actingParam }: { actingParam: string }) {
  const [week, setWeek] = useState<"current" | "last">("current");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const { data, error } = useSWR<Data>(`/api/attendance/missed?week=${week}${actingParam ? `&${actingParam}` : ""}`);

  const q = query.trim().toLowerCase();
  const people = (data?.people ?? []).filter((p) => !q || p.name.toLowerCase().includes(q) || p.cell.toLowerCase().includes(q));
  const shown = showAll || q ? people : people.slice(0, INITIAL);
  const manyCells = new Set((data?.people ?? []).map((p) => p.cellId)).size > 1;

  return (
    <Card
      title="Missed service this week"
      subtitle={data ? `${formatDay(data.from)} – ${formatDay(data.to)} · LC Live and MGS` : "LC Live and MGS"}
      action={
        <Segmented<"current" | "last"> ariaLabel="Week" value={week} onChange={(w) => { setWeek(w); setShowAll(false); }}
          options={[{ key: "current", label: "This week" }, { key: "last", label: "Last week" }]} />
      }>
      {error && !data ? (
        <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>Couldn&apos;t load who missed service.</p>
      ) : !data ? (
        <div className="flex flex-col gap-2">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-12 rounded-lg" />)}</div>
      ) : data.people.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--brand-muted)" }}>
          No one is marked absent for this week. Services that haven&apos;t been recorded yet aren&apos;t counted.
        </p>
      ) : (
        <>
          <p className="text-[13px]" style={{ color: "var(--brand-text)" }}>
            <span className="font-semibold">{data.totals.people}</span> {data.totals.people === 1 ? "person" : "people"} missed
            {" "}<span className="font-semibold">{data.totals.absences}</span> {data.totals.absences === 1 ? "service" : "services"}
          </p>

          {data.people.length > 8 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--brand-muted)" }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or cell…"
                     className="w-full h-10 sm:h-9 pl-9 pr-3 text-[14px] sm:text-[13px] rounded-lg"
                     style={{ border: "1px solid var(--brand-border)", color: "var(--brand-text)", background: "var(--surface)" }} />
            </div>
          )}

          <ul className="flex flex-col">
            {shown.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3 border-t first:border-t-0" style={{ borderColor: "var(--brand-border)" }}>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium truncate" style={{ color: "var(--brand-text)" }}>{p.name}</p>
                  <p className="text-[12px] truncate" style={{ color: "var(--brand-muted)" }}>
                    {p.cell}{manyCells ? ` · ${p.buscentre}` : ""}{p.shepherd ? ` · ${p.shepherd}` : ""}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1.5">{p.missed.map((m, i) => <MissedBadge key={i} m={m} />)}</div>
                </div>
                {p.phone && (
                  <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`} aria-label={`Call ${p.name}`}
                     className="h-11 w-11 sm:h-9 sm:w-9 rounded-lg inline-flex items-center justify-center shrink-0"
                     style={{ background: "var(--brand-navy-light)", color: "var(--brand-link)" }}>
                    <Phone className="h-4 w-4" />
                  </a>
                )}
              </li>
            ))}
            {people.length === 0 && <li className="py-3 text-[13px]" style={{ color: "var(--brand-muted)" }}>No one matches &ldquo;{query}&rdquo;.</li>}
          </ul>

          {!showAll && !q && people.length > INITIAL && (
            <button className="self-start text-[13px] font-medium h-9" style={{ color: "var(--brand-link)" }} onClick={() => setShowAll(true)}>
              Show all {people.length}
            </button>
          )}
        </>
      )}
    </Card>
  );
}
