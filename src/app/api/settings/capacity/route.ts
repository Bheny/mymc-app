import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CAPACITY, CAPACITY_LEVELS, getCapacityLimits, isCapacityLevel } from "@/lib/capacity";

const EDITOR_ROLES = ["admin", "chief_shepherd"];

/** GET — current structure limits (any signed-in user; UI badges depend on them). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const limits = await getCapacityLimits();
  return NextResponse.json({
    limits,
    levels: CAPACITY_LEVELS.map((level) => ({
      level,
      label:      CAPACITY[level].label,
      defaultMax: CAPACITY[level].max,
      ...limits[level],
    })),
    canEdit: EDITOR_ROLES.includes(session.user.role ?? ""),
  });
}

/**
 * PUT — update one or more limits.
 * Body: { limits: { [level]: { max: number, enforce: boolean } } }
 */
export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!EDITOR_ROLES.includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Only admins and chief shepherds can change structure limits" }, { status: 403 });
  }

  const body = await request.json();
  const input = body?.limits;
  if (!input || typeof input !== "object") {
    return NextResponse.json({ error: "limits is required" }, { status: 400 });
  }

  const updates: { level: string; max: number; enforce: boolean }[] = [];
  for (const [level, value] of Object.entries(input as Record<string, { max?: unknown; enforce?: unknown }>)) {
    if (!isCapacityLevel(level)) {
      return NextResponse.json({ error: `Unknown level: ${level}` }, { status: 400 });
    }
    const max = Number(value?.max);
    if (!Number.isInteger(max) || max < 1 || max > 1000) {
      return NextResponse.json({ error: `${CAPACITY[level].label} must be a whole number between 1 and 1000` }, { status: 400 });
    }
    updates.push({ level, max, enforce: value?.enforce === true });
  }

  try {
    await prisma.$transaction(
      updates.map(({ level, max, enforce }) =>
        prisma.capacityLimit.upsert({
          where:  { level },
          create: { level, max, enforce, updatedById: session.user.id },
          update: { max, enforce, updatedById: session.user.id },
        })
      )
    );
  } catch (err) {
    console.error("[settings/capacity] save failed:", err);
    return NextResponse.json(
      { error: "Could not save limits — the capacity_limits table may not exist yet (run `npx prisma db push`)." },
      { status: 500 }
    );
  }

  return NextResponse.json({ limits: await getCapacityLimits() });
}
