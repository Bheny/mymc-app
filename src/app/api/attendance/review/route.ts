import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { type ServiceType, cellsForFilter, latestService, snapshotFromAttendance } from "@/lib/attendance-overview";

const NET_REVELATION = 13;
const NET2 = NET_REVELATION * 2;

const SERVICE_TYPES: ServiceType[] = ["LC_LIVE", "MGS", "SHEPHERDS_MEETING", "SPECIAL_MEETING"];

function roleScope(role: string | null | undefined, user: {
  cellId?:       string | null;
  buscentreId?:  string | null;
  mcId?:         string | null;
  branchId?:     string | null;
}): Prisma.CellWhereInput | null {
  switch (role) {
    case "cell_shepherd":
    case "shepherd":
      return user.cellId ? { id: user.cellId } : null;
    case "buscentre_head":
      return user.buscentreId ? { buscentreId: user.buscentreId } : null;
    case "mc_pastor":
      return user.mcId ? { buscentre: { mcId: user.mcId } } : null;
    case "chief_shepherd":
      return user.branchId ? { buscentre: { mc: { branchId: user.branchId } } } : null;
    case "admin":
      return {};
    default:
      return null;
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(request.url);

  const base = roleScope(session.user.role, session.user);
  if (!base) return NextResponse.json({ error: "Attendance review is not available for this role" }, { status: 403 });

  const serviceTypeParam = searchParams.get("serviceType") ?? "LC_LIVE";
  if (!SERVICE_TYPES.includes(serviceTypeParam as ServiceType)) {
    return NextResponse.json({ error: "Invalid service type" }, { status: 400 });
  }
  const serviceType = serviceTypeParam as ServiceType;

  const mcId        = searchParams.get("mcId");
  const buscentreId = searchParams.get("buscentreId");
  const cellId      = searchParams.get("cellId");

  const filters: Prisma.CellWhereInput[] = [base];
  if (cellId)           filters.push({ id: cellId });
  else if (buscentreId) filters.push({ buscentreId });
  else if (mcId)        filters.push({ buscentre: { mcId } });

  const cellWhere: Prisma.CellWhereInput = filters.length > 1 ? { AND: filters } : base;

  const cells = await cellsForFilter(cellWhere);
  const rows = await Promise.all(cells.map(async (c) => {
    const svc = await latestService(c.id, serviceType);
    const snapshot = svc ? snapshotFromAttendance(svc.date, svc.attendance, svc._count.firstTimers) : null;
    return {
      id:               c.id,
      name:             c.name,
      buscentreName:    c.buscentreName,
      mcName:           c.mcName,
      present:          snapshot?.present ?? 0,
      total:            snapshot?.total ?? 0,
      date:             snapshot?.date ?? null,
      metNetRevelation: (snapshot?.present ?? 0) >= NET_REVELATION,
      metNet2:          (snapshot?.present ?? 0) >= NET2,
    };
  }));

  return NextResponse.json({ serviceType, cells: rows });
}
