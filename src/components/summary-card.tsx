import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";

/** Link into the Members page with a status filter, optionally limited to one bacenta or cell. */
export function membersLink(filter: "all" | "active" | "inactive" | "system", scope: { buscentreId?: string; cellId?: string } = {}) {
  const p = new URLSearchParams();
  if (filter !== "all") p.set("filter", filter);
  if (scope.buscentreId) p.set("buscentreId", scope.buscentreId);
  if (scope.cellId) p.set("cellId", scope.cellId);
  const qs = p.toString();
  return qs ? `/members?${qs}` : "/members";
}

interface SummaryCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  target?: string | number;
  trend?: number;       // e.g. 12 = +12%, -5 = -5% — shows coloured arrow
  trendLabel?: string;  // suffix after the trend number, e.g. "vs last month"
  subtitle?: string;    // plain grey text shown below the value, no arrow
  href?: string;        // makes the whole card a link
}

export function SummaryCard({
  title,
  value,
  icon,
  target,
  trend,
  trendLabel = "vs last month",
  subtitle,
  href,
}: SummaryCardProps) {
  const hasTrend = trend !== undefined;
  const isPositive = hasTrend && trend >= 0;

  const card = (
    <div
      className={`bg-[var(--surface)] rounded-xl p-5 flex flex-col gap-3 h-full ${href ? "transition-colors [@media(hover:hover)]:group-hover:border-[var(--brand-link)] group-active:bg-[var(--brand-navy-light)]" : ""}`}
      style={{ border: "1px solid var(--brand-border)" }}
    >
      {/* Label row */}
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[12px] font-medium uppercase tracking-[0.04em] leading-none"
          style={{ color: "var(--brand-muted)" }}
        >
          {title}
        </span>
        {icon && (
          <span style={{ color: "var(--brand-muted)" }} className="shrink-0">
            {icon}
          </span>
        )}
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-1.5">
        <span
          className="text-[32px] font-semibold leading-none"
          style={{ color: "var(--brand-text)" }}
        >
          {value}
        </span>
        {target && (
          <span className="text-[14px]" style={{ color: "var(--brand-muted)" }}>
            /{target}
          </span>
        )}
      </div>

      {/* Subtitle — plain informational text */}
      {subtitle && !hasTrend && (
        <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>{subtitle}</p>
      )}

      {/* Trend indicator */}
      {hasTrend && (
        <div className="flex items-center gap-1">
          {isPositive ? (
            <TrendingUp
              className="h-3.5 w-3.5"
              style={{ color: "var(--brand-success)" }}
            />
          ) : (
            <TrendingDown
              className="h-3.5 w-3.5"
              style={{ color: "var(--brand-danger)" }}
            />
          )}
          <span
            className="text-[12px] font-medium"
            style={{ color: isPositive ? "var(--brand-success)" : "var(--brand-danger)" }}
          >
            {isPositive ? "+" : ""}
            {trend}% {trendLabel}
          </span>
        </div>
      )}
    </div>
  );

  return href ? (
    <Link href={href} className="group block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand-link)]">
      {card}
    </Link>
  ) : card;
}
