import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canCreateMc } from "@/lib/org-scope";
import { mcScope } from "@/lib/view-scope";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");

  // branchId is an optional narrowing filter on top of the caller's own scope —
  // it can never widen what they're allowed to see (e.g. a chief_shepherd passing
  // another branch's id just gets an empty list, not that branch's MCs).
  const scope = mcScope(session.user.role, session.user);
  if (!scope) return NextResponse.json([]);

  const mcs = await prisma.megaChurch.findMany({
    where:   { AND: [scope, branchId ? { branchId } : {}] },
    include: { _count: { select: { buscentres: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(mcs);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { branchId, name } = await request.json();
  if (!branchId || !name) {
    return NextResponse.json({ error: "branchId and name are required" }, { status: 400 });
  }

  if (!canCreateMc(session.user, branchId)) {
    return NextResponse.json({ error: "You're not permitted to create a mega-church here" }, { status: 403 });
  }

  const mc = await prisma.megaChurch.create({ data: { branchId, name } });
  return NextResponse.json(mc, { status: 201 });
}
