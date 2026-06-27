import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authorizeBuscentreView } from "@/lib/view-scope";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const actingBuscentreId = searchParams.get("actingBuscentreId");
  const viewBuscentreId   = searchParams.get("viewBuscentreId");
  const period             = (searchParams.get("period") ?? "year") as "month" | "year";

  let buscentreId = session.user.buscentreId;

  if (actingBuscentreId) {
    const actingAt = (session.user.actingAt ?? {}) as Record<string, string>;
    if (actingAt.buscentre_id === actingBuscentreId) buscentreId = actingBuscentreId;
    else return NextResponse.json({ error: "No acting access to this buscentre" }, { status: 403 });
  } else if (viewBuscentreId) {
    const { id, status } = await authorizeBuscentreView(session.user.role, session.user, viewBuscentreId);
    if (status !== 200) return NextResponse.json({ error: "You don't have access to this buscentre" }, { status });
    buscentreId = id;
  }

  if (!buscentreId) return NextResponse.json({ error: "No buscentre assigned" }, { status: 400 });

  const now  = new Date();
  const from = period === "month"
    ? new Date(now.getFullYear(), now.getMonth(), 1)
    : new Date(now.getFullYear(), 0, 1);

  const [activeMembers, services] = await Promise.all([
    // Active members across the entire buscentre (via cell relation)
    prisma.member.count({
      where: { cell: { buscentreId }, isActive: true },
    }),
    // All services for all cells in the buscentre within the period
    prisma.service.findMany({
      where: {
        cell: { buscentreId },
        date: { gte: from },
      },
      select: {
        type: true,
        attendance: {
          where:  { status: "PRESENT" },
          select: { id: true },
        },
      },
    }),
  ]);

  const lcServices    = services.filter((s) => s.type === "LC_LIVE");
  const mgsServices   = services.filter((s) => s.type === "MGS");
  const shepherdsSvcs = services.filter((s) => s.type === "SHEPHERDS_MEETING");
  const specialSvcs   = services.filter((s) => s.type === "SPECIAL_MEETING");

  function calcStats(svcs: typeof lcServices) {
    const serviceCount = svcs.length;
    if (serviceCount === 0) return { avgPresent: 0, attendanceRate: 0, serviceCount: 0 };
    const totalPresent = svcs.reduce((sum, s) => sum + s.attendance.length, 0);
    const avgPresent   = Math.round((totalPresent / serviceCount) * 10) / 10;
    const attendanceRate = activeMembers > 0
      ? Math.round((avgPresent / activeMembers) * 100)
      : 0;
    return { avgPresent, attendanceRate, serviceCount };
  }

  return NextResponse.json({
    period,
    activeMembers,
    lcLive:           calcStats(lcServices),
    mgs:              calcStats(mgsServices),
    shepherdsMeeting: calcStats(shepherdsSvcs),
    specialMeeting:   calcStats(specialSvcs),
  });
}
