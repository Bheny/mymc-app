import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { canViewLegacy, loadLegacyView } from "@/lib/legacy-data";

export const maxDuration = 30;

/**
 * GET — the first timers registrations, cleaned, for /legacy/first-timers.
 * Only privacy-safe rows are returned (no names or phone numbers). ?fresh=1 bypasses
 * the 60s sheet cache.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!canViewLegacy(session.user.role)) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const fresh = !!new URL(request.url).searchParams.get("fresh");
  const view = await loadLegacyView({ fresh });
  if (!view) return NextResponse.json({ configured: false });

  return NextResponse.json({
    configured:  true,
    connected:   !!view.firstTimers,
    label:       view.label,
    fetchedAt:   view.fetchedAt,
    mcs:         view.mcs,
    firstTimers: view.firstTimers,
    // First timers the cells' reports counted, "MC|YYYY-MM" → n
    reportedFirstTimers: view.reportedFirstTimers,
  });
}
