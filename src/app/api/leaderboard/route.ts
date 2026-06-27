import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { type ServiceType, cellsForFilter, recentServices, snapshotFromAttendance } from "@/lib/attendance-overview";

const LEADERBOARD_TYPES: ServiceType[] = ["MGS", "LC_LIVE", "SPECIAL_MEETING"];

function thresholdFor(type: ServiceType): number {
  return type === "SPECIAL_MEETING" ? 26 : 13;
}

export type LeaderboardRow = {
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

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const serviceTypeParam = searchParams.get("serviceType") ?? "MGS";
  if (!LEADERBOARD_TYPES.includes(serviceTypeParam as ServiceType)) {
    return NextResponse.json({ error: "Invalid service type" }, { status: 400 });
  }
  const serviceType = serviceTypeParam as ServiceType;
  const threshold    = thresholdFor(serviceType);

  // Leaderboard is org-wide and identical for every role — no scope filter.
  const cells = await cellsForFilter({});

  const unranked = await Promise.all(cells.map(async (c) => {
    const [current, previous] = await recentServices(c.id, serviceType);
    const snapshot         = current  ? snapshotFromAttendance(current.date,  current.attendance,  current._count.firstTimers)  : null;
    const previousSnapshot = previous ? snapshotFromAttendance(previous.date, previous.attendance, previous._count.firstTimers) : null;

    const present = snapshot?.present ?? 0;
    const previousPresent = previousSnapshot?.present ?? null;
    const delta = previousPresent !== null ? present - previousPresent : null;
    const trend: "up" | "down" | "same" | null =
      delta === null ? null : delta > 0 ? "up" : delta < 0 ? "down" : "same";

    return {
      id:               c.id,
      name:             c.name,
      buscentreName:    c.buscentreName,
      mcName:           c.mcName,
      present,
      total:            snapshot?.total ?? 0,
      date:             snapshot?.date ?? null,
      previousPresent,
      previousDate:     previousSnapshot?.date ?? null,
      delta,
      trend,
      crossedThreshold: present >= threshold,
    };
  }));

  const sorted = unranked.sort((a, b) => b.present - a.present || a.name.localeCompare(b.name));

  const rows: LeaderboardRow[] = sorted.map((row, i) => {
    const rank = i + 1;
    return {
      ...row,
      rank,
      inTopTen:   rank <= 10,
      inTopThree: rank <= 3 && row.crossedThreshold,
    };
  });

  return NextResponse.json({ serviceType, threshold, generatedAt: new Date().toISOString(), rows });
}
