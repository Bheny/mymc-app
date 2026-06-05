"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useActiveRole } from "@/hooks/use-active-role";

type Context = {
  role:      string | null;
  cell:      { id: string; name: string } | null;
  buscentre: { id: string; name: string } | null;
  mc:        { id: string; name: string } | null;
  branch:    { id: string; name: string } | null;
};

const SCOPED_ROLES = new Set(["cell_shepherd", "shepherd", "buscentre_head", "mc_pastor"]);

function roleLabel(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ContextBanner() {
  const { activeView, ready } = useActiveRole();
  const [ctx, setCtx] = useState<Context | null>(null);

  // Use the ACTIVE role (acting or primary), not the JWT primary role
  const activeRole       = activeView?.role ?? null;
  const actingCellId      = activeView?.isActing && activeView.cellId      ? activeView.cellId      : null;
  const actingBuscentreId = activeView?.isActing && activeView.buscentreId ? activeView.buscentreId : null;

  useEffect(() => {
    if (!ready || !activeRole || !SCOPED_ROLES.has(activeRole)) {
      setCtx(null);
      return;
    }
    const params = new URLSearchParams();
    if (actingBuscentreId) params.set("actingBuscentreId", actingBuscentreId);
    if (actingCellId)      params.set("actingCellId",      actingCellId);

    fetch(`/api/me/context?${params}`)
      .then((r) => r.json())
      .then(setCtx)
      .catch(() => {});
  // Re-fetch whenever the active view changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, activeRole, actingBuscentreId, actingCellId]);

  // Don't render until role is settled (prevents primary-role flash)
  if (!ready || !activeRole || !SCOPED_ROLES.has(activeRole) || !ctx) return null;

  const crumbs: string[] = [];
  if (ctx.cell)      crumbs.push(ctx.cell.name);
  if (ctx.buscentre) crumbs.push(ctx.buscentre.name);
  if (ctx.mc)        crumbs.push(ctx.mc.name);

  if (crumbs.length === 0) return null;

  return (
    <div
      className="flex items-center gap-2 px-4 sm:px-6 py-2"
      style={{
        position:     "sticky",
        top:          56,
        zIndex:       20,
        background:   "var(--brand-navy-light)",
        borderBottom: "1px solid var(--brand-border)",
        fontSize:     12,
      }}
    >
      <span
        className="rounded-pill font-medium px-2 py-0.5 shrink-0"
        style={{ background: "var(--brand-navy)", color: "#fff", fontSize: 11 }}
      >
        {roleLabel(activeRole)}
        {activeView?.isActing && (
          <span style={{ opacity: 0.7, marginLeft: 4 }}>· acting</span>
        )}
      </span>

      {crumbs.map((crumb, i) => (
        <span key={crumb} className="flex items-center gap-2">
          <span style={{ color: "var(--brand-text)", fontWeight: i === 0 ? 500 : 400 }}>
            {crumb}
          </span>
          {i < crumbs.length - 1 && (
            <ChevronRight className="h-3 w-3 shrink-0" style={{ color: "var(--brand-muted)" }} />
          )}
        </span>
      ))}
    </div>
  );
}
