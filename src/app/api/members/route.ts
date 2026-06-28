import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkCapacity, logCapacityWarning } from "@/lib/capacity";
import { buildLeadershipIndex, resolveFromIndex } from "@/lib/leadership";

// ─── Shared include ───────────────────────────────────────────────────────────
// Covers all four placement levels so the table always has what it needs.

const MEMBER_INCLUDE = {
  shepherd:  { select: { id: true, user: { select: { id: true, name: true } }, person: { select: { firstName: true, lastName: true } } } },
  cell:      { select: { id: true, name: true, buscentre: { select: { id: true, name: true } } } },
  buscentre: { select: { id: true, name: true } },
  mc:        { select: { id: true, name: true } },
} as const;

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q           = searchParams.get("q")           ?? "";
  const shepherdId  = searchParams.get("shepherdId")  ?? "";
  const cellId      = searchParams.get("cellId")      ?? "";
  const buscentreId = searchParams.get("buscentreId") ?? "";
  const mcId        = searchParams.get("mcId")        ?? "";
  const isActive    = searchParams.get("isActive");
  const isUser      = searchParams.get("isUser");

  const members = await prisma.member.findMany({
    where: {
      // AND combines every condition independently — avoids the silent OR-key
      // collision that occurs when both a search query and a scope filter are active.
      AND: [
        ...(q ? [{
          OR: [
            { firstName: { contains: q, mode: "insensitive" as const } },
            { lastName:  { contains: q, mode: "insensitive" as const } },
            { phone:     { contains: q, mode: "insensitive" as const } },
            { email:     { contains: q, mode: "insensitive" as const } },
            { cell:      { name: { contains: q, mode: "insensitive" as const } } },
            { cell:      { buscentre: { name: { contains: q, mode: "insensitive" as const } } } },
            { buscentre: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }] : []),
        ...(shepherdId  ? [{ shepherdId }]  : []),
        ...(cellId      ? [{ cellId }]      : []),
        ...(buscentreId ? [{
          OR: [
            { buscentreId },
            { cell: { buscentreId } },
          ],
        }] : []),
        ...(mcId        ? [{ mcId }]        : []),
        ...(isActive !== null ? [{ isActive: isActive === "true" }] : []),
        ...(isUser   !== null ? [{ isUser:   isUser   === "true" }] : []),
      ],
    },
    include: MEMBER_INCLUDE,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const branchId = session.user.branchId;
  const index = branchId ? await buildLeadershipIndex(branchId) : null;
  const withEffectiveShepherd = members.map((m) => ({
    ...m,
    effectiveShepherdName: index ? resolveFromIndex(m, index) : "Unassigned",
  }));

  return NextResponse.json(withEffectiveShepherd);
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await request.json();
  const {
    level = "shepherd",          // "shepherd" | "cell" | "buscentre" | "mc"
    shepherdId, cellId, buscentreId, mcId,
    firstName, lastName, phone, email, gender, dateOfBirth, joinedDate,
    departmentIds,
  } = body;

  if (!firstName?.trim() || !lastName?.trim()) {
    return NextResponse.json({ error: "firstName and lastName are required" }, { status: 400 });
  }

  if (departmentIds !== undefined && (!Array.isArray(departmentIds) || departmentIds.length > 2)) {
    return NextResponse.json({ error: "A member can belong to at most 2 departments" }, { status: 400 });
  }

  // Validate the placement anchor exists and build data payload
  let placementData: Record<string, string | null> = {};
  let capacityWarning: string | null = null;

  if (level === "shepherd") {
    if (!shepherdId) return NextResponse.json({ error: "shepherdId required for shepherd-level members" }, { status: 400 });
    if (!cellId)     return NextResponse.json({ error: "cellId required for shepherd-level members" }, { status: 400 });

    const shepherd = await prisma.shepherd.findUnique({ where: { id: shepherdId } });
    if (!shepherd) return NextResponse.json({ error: "Shepherd not found" }, { status: 404 });

    const cap = await checkCapacity("member", shepherdId);
    if (cap.atCapacity) {
      const cell = await prisma.cell.findUnique({ where: { id: cellId }, select: { name: true } });
      await logCapacityWarning({
        level: "member", parentId: shepherdId,
        parentName: `Shepherd in ${cell?.name ?? cellId}`,
        count: cap.count, createdById: session.user.id,
      });
      capacityWarning = `This shepherd is at member capacity (${cap.count}/${cap.max}). Warning logged.`;
    }

    placementData = { shepherdId, cellId, buscentreId: null, mcId: null };

  } else if (level === "cell") {
    if (!cellId) return NextResponse.json({ error: "cellId required for cell-level members" }, { status: 400 });
    const cell = await prisma.cell.findUnique({ where: { id: cellId } });
    if (!cell) return NextResponse.json({ error: "Cell not found" }, { status: 404 });
    placementData = { shepherdId: null, cellId, buscentreId: null, mcId: null };

  } else if (level === "buscentre") {
    if (!buscentreId) return NextResponse.json({ error: "buscentreId required for buscentre-level members" }, { status: 400 });
    const bc = await prisma.buscentre.findUnique({ where: { id: buscentreId } });
    if (!bc) return NextResponse.json({ error: "Buscentre not found" }, { status: 404 });
    placementData = { shepherdId: null, cellId: null, buscentreId, mcId: null };

  } else if (level === "mc") {
    if (!mcId) return NextResponse.json({ error: "mcId required for MC-level members" }, { status: 400 });
    const mc = await prisma.megaChurch.findUnique({ where: { id: mcId } });
    if (!mc) return NextResponse.json({ error: "MegaChurch not found" }, { status: 404 });
    placementData = { shepherdId: null, cellId: null, buscentreId: null, mcId };

  } else {
    return NextResponse.json({ error: `Unknown level: ${level}` }, { status: 400 });
  }

  const member = await prisma.member.create({
    data: {
      ...placementData,
      firstName:   firstName.trim(),
      lastName:    lastName.trim(),
      phone:       phone      || null,
      email:       email      || null,
      gender:      gender     || null,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      joinedDate:  joinedDate  ? new Date(joinedDate)  : null,
      ...(departmentIds?.length
        ? { departments: { create: departmentIds.map((departmentId: string) => ({ departmentId })) } }
        : {}),
    },
    include: MEMBER_INCLUDE,
  });

  return NextResponse.json(
    capacityWarning ? { ...member, _capacityWarning: capacityWarning } : member,
    { status: 201 }
  );
}
