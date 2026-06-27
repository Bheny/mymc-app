"use client";

import { useEffect, useState } from "react";
import { Trophy, TrendingUp, TrendingDown, Minus, ChevronRight, Sparkles } from "lucide-react";
import { LeaderboardCellSheet } from "@/components/leaderboard-cell-sheet";

type ServiceType = "MGS" | "LC_LIVE" | "SPECIAL_MEETING";

type LeaderboardRow = {
  id:               string;
  name:             string;
  buscentreName:    string;
  mcName:           string;
  rank:             number;
  present:          number;
  total:            number;
  date:             string | null;
  previousPresent:  number | null;
  previousDate:     string | null;
  delta:            number | null;
  trend:            "up" | "down" | "same" | null;
  crossedThreshold: boolean;
  inTopTen:         boolean;
  inTopThree:       boolean;
};

const SERVICE_TABS: { key: ServiceType; label: string }[] = [
  { key: "MGS",             label: "MGS" },
  { key: "LC_LIVE",         label: "LC Live" },
  { key: "SPECIAL_MEETING", label: "Special Meeting" },
];

const RANK_BADGE: Record<number, { bg: string; color: string }> = {
  1: { bg: "#FDE68A", color: "#854D0E" },
  2: { bg: "#E5E7EB", color: "#374151" },
  3: { bg: "#FED7AA", color: "#9A3412" },
};

function formatDate(iso: string | null) {
  if (!iso) return "No service yet";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function RankBadge({ rank }: { rank: number }) {
  const medal = RANK_BADGE[rank];
  return (
    <div
      className="flex items-center justify-center rounded-full text-[13px] font-semibold shrink-0"
      style={{
        width: 32, height: 32,
        background: medal?.bg ?? (rank <= 10 ? "var(--brand-navy-light)" : "#F3F4F6"),
        color:      medal?.color ?? (rank <= 10 ? "var(--brand-navy)" : "var(--brand-muted)"),
      }}
    >
      {rank}
    </div>
  );
}

function TrendIndicator({ delta, trend }: { delta: number | null; trend: LeaderboardRow["trend"] }) {
  if (trend === null || delta === null) {
    return <span className="text-[11px]" style={{ color: "var(--brand-muted)" }}>New</span>;
  }
  if (trend === "same") {
    return <span className="flex items-center gap-0.5 text-[11px]" style={{ color: "var(--brand-muted)" }}><Minus className="h-3 w-3" /> 0</span>;
  }
  const Icon  = trend === "up" ? TrendingUp : TrendingDown;
  const color = trend === "up" ? "var(--brand-success)" : "var(--brand-danger)";
  return (
    <span className="flex items-center gap-0.5 text-[11px] font-medium" style={{ color }}>
      <Icon className="h-3 w-3" /> {delta > 0 ? `+${delta}` : delta}
    </span>
  );
}

export default function LeaderboardPage() {
  const [serviceType, setServiceType] = useState<ServiceType>("MGS");
  const [rows,        setRows]        = useState<LeaderboardRow[]>([]);
  const [threshold,   setThreshold]   = useState(13);
  const [loading,     setLoading]     = useState(true);
  const [sheetCellId, setSheetCellId] = useState<string | null>(null);
  const [sheetOpen,   setSheetOpen]   = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leaderboard?serviceType=${serviceType}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(Array.isArray(d.rows) ? d.rows : []);
        setThreshold(d.threshold ?? 13);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [serviceType]);

  function openCell(id: string) {
    setSheetCellId(id);
    setSheetOpen(true);
  }

  const qualifiedCount = rows.filter((r) => r.crossedThreshold).length;
  const topTen  = rows.filter((r) => r.inTopTen);
  const rest    = rows.filter((r) => !r.inTopTen);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[900px] mx-auto pb-20 lg:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-[24px] font-semibold flex items-center gap-2" style={{ color: "var(--brand-text)" }}>
          <Trophy className="h-6 w-6" style={{ color: "#D97706" }} /> Leaderboard
        </h1>
      </div>
      <p className="text-[14px] mb-5" style={{ color: "var(--brand-muted)" }}>
        Every cell, ranked by attendance at its most recent service · target is {threshold}+
      </p>

      {/* Service type toggle */}
      <div className="flex rounded-lg overflow-hidden mb-4 w-fit" style={{ border: "1px solid var(--brand-border)" }}>
        {SERVICE_TABS.map(({ key, label }, i) => (
          <button
            key={key}
            onClick={() => setServiceType(key)}
            className="px-3.5 py-1.5 text-[12.5px] font-medium transition-colors"
            style={{
              background:  serviceType === key ? "var(--brand-navy)" : "#fff",
              color:       serviceType === key ? "#fff" : "var(--brand-muted)",
              borderRight: i < SERVICE_TABS.length - 1 ? "1px solid var(--brand-border)" : "none",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Summary line */}
      {!loading && rows.length > 0 && (
        <div className="flex items-center gap-1.5 mb-4 text-[13px]" style={{ color: "var(--brand-muted)" }}>
          <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--brand-success)" }} />
          <span>{qualifiedCount} of {rows.length} cell{rows.length !== 1 ? "s" : ""} crossed the {threshold} mark</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ border: "1px solid var(--brand-border)" }}>
          <Trophy style={{ width: 40, height: 40, color: "var(--brand-muted)", margin: "0 auto 12px" }} />
          <p className="text-[14px] font-medium" style={{ color: "var(--brand-text)" }}>No cells to rank yet</p>
        </div>
      ) : (
        <>
          {/* Top 10 */}
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="h-3.5 w-3.5" style={{ color: "var(--brand-muted)" }} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--brand-muted)" }}>
              Top 10
            </span>
          </div>
          <div className="rounded-xl overflow-hidden mb-6" style={{ border: "1px solid var(--brand-border)" }}>
            {topTen.map((row, i) => (
              <LeaderboardRowItem key={row.id} row={row} threshold={threshold} isFirst={i === 0} onTap={() => openCell(row.id)} />
            ))}
          </div>

          {/* Everyone else */}
          {rest.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--brand-muted)" }}>
                  All other cells
                </span>
              </div>
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--brand-border)" }}>
                {rest.map((row, i) => (
                  <LeaderboardRowItem key={row.id} row={row} threshold={threshold} isFirst={i === 0} onTap={() => openCell(row.id)} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <LeaderboardCellSheet
        cellId={sheetCellId}
        serviceType={serviceType}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}

function LeaderboardRowItem({
  row, threshold, isFirst, onTap,
}: {
  row: LeaderboardRow; threshold: number; isFirst: boolean; onTap: () => void;
}) {
  return (
    <button
      onClick={onTap}
      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--brand-navy-light)] transition-colors"
      style={{ borderTop: isFirst ? "none" : "1px solid var(--brand-border)" }}
    >
      <RankBadge rank={row.rank} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13.5px] font-medium" style={{ color: "var(--brand-text)" }}>
            {row.name}
          </span>
          {row.inTopThree && (
            <span className="rounded-pill text-[10px] font-semibold px-1.5 py-0.5 shrink-0"
                  style={{ background: "var(--brand-success)", color: "#fff" }}>
              Crossed {threshold}+
            </span>
          )}
        </div>
        <p className="truncate text-[12px] mt-0.5" style={{ color: "var(--brand-muted)" }}>
          {row.buscentreName} · {row.mcName}
        </p>
      </div>

      <div className="flex flex-col items-end gap-0.5 shrink-0 tabular-nums">
        <span className="text-[14px] font-semibold" style={{ color: row.crossedThreshold ? "var(--brand-success)" : "var(--brand-text)" }}>
          {row.present} <span className="font-normal text-[12px]" style={{ color: "var(--brand-muted)" }}>/ {threshold}</span>
        </span>
        <TrendIndicator delta={row.delta} trend={row.trend} />
      </div>

      <span className="text-[11px] shrink-0 w-16 text-right" style={{ color: "var(--brand-muted)" }}>
        {formatDate(row.date)}
      </span>

      <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--brand-muted)" }} />
    </button>
  );
}
