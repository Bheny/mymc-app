// Roles allowed to drill into a buscentre/cell dashboard that isn't their own
// (their own is always allowed via the bare /buscentre and /cell routes).
// Client-safe — no Prisma import. Server-side enforcement lives in view-scope.ts.
export const BUSCENTRE_DASHBOARD_ROLES = ["admin", "chief_shepherd", "mc_pastor", "buscentre_head"];
export const CELL_DASHBOARD_ROLES      = ["admin", "chief_shepherd", "mc_pastor", "buscentre_head"];
