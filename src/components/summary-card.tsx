import { TrendingUp, TrendingDown } from "lucide-react";

interface SummaryCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  target?: string | number;
  trend?: number;       // e.g. 12 = +12%, -5 = -5% — shows coloured arrow
  trendLabel?: string;  // suffix after the trend number, e.g. "vs last month"
  subtitle?: string;    // plain grey text shown below the value, no arrow
}

export function SummaryCard({
  title,
  value,
  icon,
  target,
  trend,
  trendLabel = "vs last month",
  subtitle,
}: SummaryCardProps) {
  const hasTrend = trend !== undefined;
  const isPositive = hasTrend && trend >= 0;

  return (
    <div
      className="bg-white rounded-xl p-5 flex flex-col gap-3"
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
}
