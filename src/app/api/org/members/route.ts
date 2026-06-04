import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Search members by name — used by the activation flow
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q        = searchParams.get("q")        ?? "";
  const isUser   = searchParams.get("isUser");   // "true" | "false" | null
  const cellId   = searchParams.get("cellId");

  const members = await prisma.member.findMany({
    where: {
      ...(q ? {
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName:  { contains: q, mode: "insensitive" } },
        ],
      } : {}),
      ...(isUser !== null ? { isUser: isUser === "true" } : {}),
      ...(cellId ? { cellId } : {}),
    },
    include: {
      cell: {
        select: {
          id: true, name: true,
          buscentre: {
            select: {
              id: true, name: true, mcId: true,
              mc: { select: { branchId: true } },
            },
          },
        },
      },
      shepherd: { select: { id: true, user: { select: { name: true } } } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 30,
  });

  return NextResponse.json(members);
}
