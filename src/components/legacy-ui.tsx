"use client";

// Small building blocks shared by the Legacy dashboard and its sections.

export function Card({ title, subtitle, action, children }: {
  title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="bg-[var(--surface)] rounded-xl p-4 sm:p-5 flex flex-col gap-3 min-w-0"
             style={{ border: "1px solid var(--brand-border)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold" style={{ color: "var(--brand-text)" }}>{title}</h2>
          {subtitle && <p className="text-[12px] mt-0.5" style={{ color: "var(--brand-muted)" }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[var(--surface)] rounded-xl p-4 flex flex-col gap-2 min-w-0" style={{ border: "1px solid var(--brand-border)" }}>
      <span className="text-[11px] font-medium uppercase tracking-[0.04em] leading-tight" style={{ color: "var(--brand-muted)" }}>
        {label}
      </span>
      <span className="text-[28px] font-semibold leading-none" style={{ color: "var(--brand-text)" }}>{value}</span>
      {sub && <span className="text-[12px]" style={{ color: "var(--brand-muted)" }}>{sub}</span>}
    </div>
  );
}
