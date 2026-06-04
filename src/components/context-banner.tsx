"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ChevronRight } from "lucide-react";

type Context = {
  role:      string | null;
  cell:      { id: string; name: string } | null;
  buscentre: { id: string; name: string } | null;
  mc:        { id: string; name: string } | null;
  branch:    { id: string; name: string } | null;
};

// Roles that get the context banner — these users have a narrow scope
// and need to know where they sit in the hierarchy.
const SCOPED_ROLES = new Set(["cell_shepherd", "shepherd", "buscentre_head", "mc_pastor"]);

function roleLabel(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ContextBanner() {
  const { data: session } = useSession();
  const [ctx, setCtx] = useState<Context | null>(null);

  const role = session?.user?.role ?? null;

  useEffect(() => {
    if (!role || !SCOPED_ROLES.has(role)) return;
    fetch("/api/me/context")
      .then((r) => r.json())
      .then(setCtx)
      .catch(() => {});
  }, [role]);

  // Only show for scoped roles
  if (!role || !SCOPED_ROLES.has(role) || !ctx) return null;

  // Build the breadcrumb trail narrowest → broadest
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
        top:          56,          // stick just below the header
        zIndex:       20,
        background:   "var(--brand-navy-light)",
        borderBottom: "1px solid var(--brand-border)",
        fontSize:     12,
      }}
    >
      {/* Role badge */}
      <span
        className="rounded-pill font-medium px-2 py-0.5 shrink-0"
        style={{ background: "var(--brand-navy)", color: "#fff", fontSize: 11 }}
      >
        {roleLabel(role)}
      </span>

      {/* Hierarchy breadcrumb */}
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
