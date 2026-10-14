import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { contactWhereForScope, resolveAttendanceScope } from "@/lib/attendance-scope";
import { CONVERSATION_ROLES, radarFor } from "@/lib/evangelism-radar";

// GET /api/evangelism/radar (+ acting* params)
// Guests who aren't members yet and have come to 3+ services this month and need a conversation,
// those one service away, and those who said they want to join and are waiting to be added.
// For the people who hold those conversations: buscentre heads and above.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!CONVERSATION_ROLES.includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "The radar is for buscentre heads and above" }, { status: 403 });
  }

  const scope = resolveAttendanceScope(session.user as never, new URL(request.url).searchParams);
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const today = new Date().toISOString().slice(0, 10);
  const people = await radarFor(contactWhereForScope(scope), today);
  return NextResponse.json({
    people,
    counts: {
      radar:  people.filter((p) => p.group === "radar").length,
      wants:  people.filter((p) => p.group === "wants").length,
      nearly: people.filter((p) => p.group === "nearly").length,
    },
  });
}
