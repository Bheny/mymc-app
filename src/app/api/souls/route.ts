import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function resolveCell(
  session: { user: { cellId?: string | null; actingAt?: Record<string, string> } },
  override: string | null
): string | { error: string } | null {
  if (!override) return session.user.cellId ?? null;
  const actingAt = (session.user.actingAt ?? {}) as Record<string, string>;
  if (actingAt.cell_id === override) return override;
  return { error: "No acting access to this cell" };
}

// GET /api/souls?q=search&year=2026&month=5
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const cellResult = resolveCell(session, searchParams.get("actingCellId"));
  if (cellResult && typeof cellResult === "object") return NextResponse.json(cellResult, { status: 403 });
  const cellId = cellResult as string | null;
  if (!cellId) return NextResponse.json({ error: "No cell assigned" }, { status: 400 });

  const q     = searchParams.get("q")?.trim() ?? "";
  const year  = searchParams.get("year")  ? parseInt(searchParams.get("year")!)  : null;
  const month = searchParams.get("month") ? parseInt(searchParams.get("month")!) : null;

  // Build date filter
  let dateFilter: { gte?: Date; lte?: Date } | undefined;
  if (year && month) {
    dateFilter = {
      gte: new Date(year, month - 1, 1),
      lte: new Date(year, month, 0),      // last day of month
    };
  } else if (year) {
    dateFilter = {
      gte: new Date(year, 0, 1),
      lte: new Date(year, 11, 31),
    };
  }

  const souls = await prisma.soul.findMany({
    where: {
      cellId,
      ...(dateFilter ? { date: dateFilter } : {}),
      ...(q ? {
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName:  { contains: q, mode: "insensitive" } },
          { location:  { contains: q, mode: "insensitive" } },
          { phone:     { contains: q, mode: "insensitive" } },
        ],
      } : {}),
    },
    orderBy: { date: "desc" },
    include: {
      recordedBy: { select: { name: true } },
    },
  });

  return NextResponse.json(souls);
}

// POST /api/souls
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await request.json();
  const { firstName, lastName, phone, location, date, notes, actingCellId } = body;

  if (!firstName?.trim() || !lastName?.trim() || !date) {
    return NextResponse.json({ error: "firstName, lastName and date are required" }, { status: 400 });
  }

  const cellResult = resolveCell(session, actingCellId ?? null);
  if (cellResult && typeof cellResult === "object") return NextResponse.json(cellResult, { status: 403 });
  const cellId = cellResult as string | null;
  if (!cellId) return NextResponse.json({ error: "No cell assigned" }, { status: 400 });

  const soul = await prisma.soul.create({
    data: {
      firstName:    firstName.trim(),
      lastName:     lastName.trim(),
      phone:        phone?.trim()    || null,
      location:     location?.trim() || null,
      date:         new Date(date),
      notes:        notes?.trim()    || null,
      cellId,
      recordedById: session.user.id,
    },
    include: { recordedBy: { select: { name: true } } },
  });

  return NextResponse.json(soul, { status: 201 });
}
