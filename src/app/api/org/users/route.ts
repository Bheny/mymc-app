import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Returns all active users with their current role — used by assignment dropdowns.
// ?eligible=mc_pastor → only users with no role OR already mc_pastor (safe to re-assign)
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const eligible = searchParams.get("eligible"); // e.g. "mc_pastor"

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      ...(eligible
        ? {
            OR: [
              { role: null },
              { role: { role: eligible as never } },
            ],
          }
        : {}),
    },
    select: {
      id:    true,
      name:  true,
      email: true,
      role:  { select: { role: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(users);
}
