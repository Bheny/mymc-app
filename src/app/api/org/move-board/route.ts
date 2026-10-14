import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCapacityLimit } from "@/lib/capacity";
import { resolveNode } from "@/lib/evangelism";
import { actorViews, canManage } from "@/lib/member-moves";

// GET /api/org/move-board?buscentreId=…  |  ?cellId=…  |  ?shepherdId=…
// The people under one part of the structure, laid out for the Move members
// screen: cells → shepherds → members, plus members with no shepherd (cell level)
// and members held directly by the buscentre. You need to lead the part you ask for.
// Each member carries a `lock` reason when they can't be moved this way.

const memberSelect = {
  id: true, firstName: true, lastName: true, isActive: true,
  shepherdRole: { select: { id: true } },
  user: { select: { role: { select: { id: true } } } },
} as const;

type Row = { id: string; firstName: string; lastName: string; isActive: boolean; shepherdRole: { id: string } | null; user: { role: { id: string } | null } | null };
const shape = (m: Row) => ({
  id: m.id, name: `${m.firstName} ${m.lastName}`, isActive: m.isActive,
  lock: m.shepherdRole ? "Is a shepherd — change that from the Org page" : m.user?.role ? "Has a system role — change that from the Org page" : null,
});
const byName = <T extends { lastName: string; firstName: string }>(a: T, b: T) =>
  a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const sp          = new URL(request.url).searchParams;
  const buscentreId = sp.get("buscentreId");
  const cellId      = sp.get("cellId");
  const shepherdId  = sp.get("shepherdId");
  if (!buscentreId && !cellId && !shepherdId) return NextResponse.json({ error: "buscentreId, cellId or shepherdId is required" }, { status: 400 });

  // Which node are we being asked about, and may this person lead it?
  let cellFilter: { id?: string; buscentreId?: string };
  let node = null;
  let onlyShepherd: string | null = null;
  if (shepherdId) {
    const s = await prisma.shepherd.findUnique({ where: { id: shepherdId }, select: { cellId: true } });
    if (!s) return NextResponse.json({ error: "Shepherd not found" }, { status: 404 });
    node = await resolveNode("CELL", s.cellId);
    cellFilter = { id: s.cellId }; onlyShepherd = shepherdId;
  } else if (cellId) {
    node = await resolveNode("CELL", cellId); cellFilter = { id: cellId };
  } else {
    node = await resolveNode("BUSCENTRE", buscentreId!); cellFilter = { buscentreId: buscentreId! };
  }
  if (!node) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManage(await actorViews(session.user.id), node)) {
    return NextResponse.json({ error: "You don't lead this part of the church" }, { status: 403 });
  }

  const cells = await prisma.cell.findMany({
    where: cellFilter,
    orderBy: { name: "asc" },
    select: {
      id: true, name: true,
      shepherds: {
        where: onlyShepherd ? { id: onlyShepherd } : {},
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          user:   { select: { name: true } },
          person: { select: { firstName: true, lastName: true } },
          members: { select: memberSelect },
        },
      },
      // Members of the cell who aren't under a shepherd
      members: { where: { shepherdId: null }, select: memberSelect },
    },
  });

  const direct = !onlyShepherd && !cellId && buscentreId
    ? await prisma.member.findMany({ where: { buscentreId, cellId: null }, select: memberSelect })
    : [];
  const capacity = await getCapacityLimit("member");

  return NextResponse.json({
    capacity,
    buscentreId: !onlyShepherd && !cellId ? buscentreId : null,
    cells: cells.map((c) => ({
      id: c.id, name: c.name,
      shepherds: c.shepherds.map((s) => ({
        id: s.id,
        name: s.user?.name ?? (s.person ? `${s.person.firstName} ${s.person.lastName}` : "Unfilled slot"),
        members: [...s.members].sort(byName).map(shape),
      })),
      unshepherded: onlyShepherd ? [] : [...c.members].sort(byName).map(shape),
    })),
    direct: [...direct].sort(byName).map(shape),
  });
}
