import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Returns the caller's current acting roles FRESH from the database.
 * Used by useActiveRole so the role switcher appears immediately after
 * assignment without requiring the user to re-login.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const userRole = await prisma.userRole.findUnique({
    where:  { userId: session.user.id },
    select: { actingAs: true, actingAt: true },
  });

  return NextResponse.json({
    actingAs: userRole?.actingAs ?? [],
    actingAt: (userRole?.actingAt as Record<string, string>) ?? {},
  });
}
