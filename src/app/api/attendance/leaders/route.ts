import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { resolveRecordingCell } from "@/lib/recording-scope";
import { leadersForCell } from "@/lib/leader-attendance";

// GET /api/attendance/leaders?cellId=&type=&date=
// The senior shepherds / MC pastors who can be counted at this cell for this service, and who has
// already been counted at another cell that day.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const sp = new URL(request.url).searchParams;
  const type = sp.get("type") ?? "", date = sp.get("date") ?? "";
  if (!type || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "type and date are required" }, { status: 400 });

  const cell = await resolveRecordingCell(session.user, sp.get("cellId"));
  if ("error" in cell) return NextResponse.json({ error: cell.error }, { status: cell.status });

  return NextResponse.json(await leadersForCell(cell.cellId, type, date, sp.get("serviceId") ?? undefined));
}
