"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";

export type PickedMember = { id: string; name: string };

type Found = {
  id: string; firstName: string; lastName: string;
  cell?: { name: string } | null; buscentre?: { name: string } | null; mc?: { name: string } | null;
};

const placeOf = (m: Found) => m.cell?.name ?? m.buscentre?.name ?? m.mc?.name ?? "";

// Search-as-you-type picker for one member of the church (any cell, any level) — used wherever a
// record credits a member, e.g. who won a soul or who brought a first timer.
export function MemberPicker({
  value, onChange, placeholder = "Search a member by name…", className = "",
}: {
  value:        PickedMember | null;
  onChange:     (m: PickedMember | null) => void;
  placeholder?: string;
  className?:   string;
}) {
  const [q, setQ]             = useState("");
  const [results, setResults] = useState<Found[]>([]);
  const [open, setOpen]       = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const found = await fetchJson<Found[]>(`/api/members?q=${encodeURIComponent(q.trim())}&isActive=true`);
        if (mine === seq.current) setResults(found.slice(0, 8));
      } catch { if (mine === seq.current) setResults([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  if (value) {
    return (
      <div className={`h-10 px-3 flex items-center justify-between rounded-lg text-[14px] ${className}`}
           style={{ border: "1px solid var(--brand-border)", background: "var(--surface)", color: "var(--brand-text)" }}>
        <span className="truncate">{value.name}</span>
        <button type="button" title="Clear" onClick={() => { onChange(null); setQ(""); }}>
          <X className="h-3.5 w-3.5" style={{ color: "var(--brand-muted)" }} />
        </button>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--brand-muted)" }} />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="h-10 pl-9 pr-3 text-[14px] rounded-lg w-full"
        style={{ border: "1px solid var(--brand-border)", background: "var(--surface)", outline: "none" }}
      />
      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-lg overflow-hidden shadow-lg"
             style={{ background: "var(--surface)", border: "1px solid var(--brand-border)" }}>
          {results.map((m) => (
            <button
              key={m.id} type="button"
              className="flex w-full items-center justify-between gap-3 text-left px-3 py-2 text-[14px] hover:bg-[var(--brand-navy-light)]"
              style={{ color: "var(--brand-text)" }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange({ id: m.id, name: `${m.firstName} ${m.lastName}` }); setQ(""); setResults([]); setOpen(false); }}
            >
              <span className="truncate">{m.firstName} {m.lastName}</span>
              <span className="text-[11px] shrink-0" style={{ color: "var(--brand-muted)" }}>{placeOf(m)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
