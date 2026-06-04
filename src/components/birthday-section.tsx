"use client";

import { Gift } from "lucide-react";
import type { BirthdayEntry } from "@/lib/birthdays";

function dayLabel(daysUntil: number): { text: string; style: React.CSSProperties } {
  if (daysUntil === 0) return { text: "Today 🎂",  style: { background: "#E0F4EC", color: "#085041" } };
  if (daysUntil === 1) return { text: "Tomorrow",  style: { background: "#FEF3DC", color: "#854F0B" } };
  if (daysUntil <= 7)  return { text: `In ${daysUntil} days`, style: { background: "var(--brand-navy-light)", color: "var(--brand-navy)" } };
  return                      { text: `In ${daysUntil} days`, style: { background: "#F3F4F6",              color: "var(--brand-muted)" } };
}

export function BirthdaySection({ birthdays }: { birthdays: BirthdayEntry[] }) {
  if (birthdays.length === 0) return null;

  return (
    <div className="mb-6">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4" style={{ color: "var(--brand-navy)" }} />
          <span className="text-[12px] font-medium uppercase tracking-[0.06em]"
                style={{ color: "var(--brand-muted)" }}>
            Upcoming Birthdays
          </span>
        </div>
        <div className="flex-1 h-px" style={{ background: "var(--brand-border)" }} />
        <span className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
          Next 30 days
        </span>
      </div>

      {/* Birthday list */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--brand-border)" }}>
        {birthdays.map((b, i) => {
          const { text, style } = dayLabel(b.daysUntil);
          const initials = `${b.firstName[0] ?? ""}${b.lastName[0] ?? ""}`.toUpperCase();

          return (
            <div
              key={b.id}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--brand-navy-light)]"
              style={{ borderBottom: i < birthdays.length - 1 ? "1px solid var(--brand-border)" : "none" }}
            >
              {/* Avatar */}
              <div
                className="flex items-center justify-center rounded-lg text-[12px] font-semibold shrink-0"
                style={{
                  width: 36, height: 36,
                  background: b.daysUntil === 0 ? "#1A8C6C" : "var(--brand-navy)",
                  color: "#fff",
                }}
              >
                {initials}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium truncate" style={{ color: "var(--brand-text)" }}>
                  {b.firstName} {b.lastName}
                </p>
                <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
                  {b.dateLabel}
                </p>
              </div>

              {/* Days badge */}
              <span
                className="rounded-pill text-[11px] font-medium px-2.5 py-1 shrink-0"
                style={style}
              >
                {text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
