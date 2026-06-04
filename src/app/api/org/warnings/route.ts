import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const [actingUpFlags, capacityWarnings] = await Promise.all([
    prisma.actingUpFlag.findMany({
      where:   { resolved: false },
      include: { user: { select: { name: true, email: true } } },
      orderBy: [{ severity: "desc" }, { flaggedAt: "desc" }],
    }),
    prisma.capacityWarning.findMany({
      where:   { resolved: false },
      include: { createdBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({ actingUpFlags, capacityWarnings });
}

// PATCH to resolve a flag or warning
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { type, id } = await request.json();

  if (type === "actingUp") {
    await prisma.actingUpFlag.update({
      where: { id },
      data:  { resolved: true, resolvedAt: new Date() },
    });
  } else if (type === "capacity") {
    await prisma.capacityWarning.update({
      where: { id },
      data:  { resolved: true, resolvedAt: new Date() },
    });
  } else {
    return NextResponse.json({ error: "type must be 'actingUp' or 'capacity'" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
