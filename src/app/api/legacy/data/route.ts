import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { canViewLegacy, loadLegacyView } from "@/lib/legacy-data";

// Reads several Google Sheets (plus tab lists) per request — allow more than
// Vercel's default function time
export const maxDuration = 30;

/**
 * GET — the Legacy dashboard's data. ?fresh=1 bypasses the 60s sheet cache.
 * The first timers registrations are served separately (/api/legacy/first-timers);
 * this only says whether that tab is connected, so the page can show its button.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!canViewLegacy(session.user.role)) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const fresh = !!new URL(request.url).searchParams.get("fresh");
  const view = await loadLegacyView({ fresh });
  if (!view) return NextResponse.json({ configured: false });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { firstTimers, reportedFirstTimers, mcs, ...rest } = view;
  return NextResponse.json({ configured: true, ...rest, firstTimersConnected: !!firstTimers });
}
