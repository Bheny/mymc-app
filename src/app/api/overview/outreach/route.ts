import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { contactWhereForScope, resolveAttendanceScope } from "@/lib/attendance-scope";
import { followUpNeeds, outreachFunnel, QUIET_DAYS } from "@/lib/attendance-dashboard";
import { loadContactRows } from "@/lib/evangelism-overview";
import { CONVERSATION_ROLES, radarFor } from "@/lib/evangelism-radar";
import { getLaunchDate } from "@/lib/platform";

// GET /api/overview/outreach?period=launch|month (+ acting* params)
// The outreach and follow-up numbers for the main overview page, for the caller's scope:
// souls won, how far the people we've met have got, who needs a follow-up, and — for buscentre
// heads and above — the guests on the radar for a conversation.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const sp = new URL(request.url).searchParams;
  const scope = resolveAttendanceScope(session.user as never, sp);
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const launch = new Date((await getLaunchDate()) + "T00:00:00Z");
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const month = sp.get("period") === "month" && monthStart > launch;
  const since = month ? monthStart : launch;
  const contactWhere = contactWhereForScope(scope);

  const [contacts, soulsTracker] = await Promise.all([
    loadContactRows(contactWhere, since, now),
    prisma.soul.count({ where: { cell: scope.cellWhere, date: { gte: since } } }),
  ]);

  let soulsOutreach = 0;
  try {
    soulsOutreach = await prisma.encounter.count({
      where: {
        response: "RECEIVED_CHRIST", metAt: { gte: since }, contact: contactWhere,
        // souls copied across from the soul tracker are already counted above
        OR: [{ clientRef: null }, { NOT: { clientRef: { startsWith: "backfill:soul:" } } }],
      },
    });
  } catch { /* evangelism tables not there yet */ }

  // The radar belongs to the people who hold the conversations
  let radar: { radar: number; wants: number; nearly: number; names: string[] } | null = null;
  if (CONVERSATION_ROLES.includes(session.user.role ?? "")) {
    try {
      const people = await radarFor(contactWhere, today);
      const need = people.filter((p) => p.group === "radar");
      radar = {
        radar: need.length, wants: people.filter((p) => p.group === "wants").length, nearly: people.filter((p) => p.group === "nearly").length,
        names: need.slice(0, 3).map((p) => p.name),
      };
    } catch { radar = { radar: 0, wants: 0, nearly: 0, names: [] }; }
  }

  return NextResponse.json({
    period: month ? "month" : "launch", since: since.toISOString().slice(0, 10), quietDays: QUIET_DAYS,
    souls: { total: soulsTracker + soulsOutreach, tracker: soulsTracker, outreach: soulsOutreach },
    funnel: outreachFunnel(contacts),
    needs: followUpNeeds(contacts, today),
    radar,
  });
}
