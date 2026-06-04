import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string } };

/** PATCH — update a user's supervisorId (set their direct overseer) */
export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { supervisorId } = await request.json();

  // Validate the supervisor user exists if being set
  if (supervisorId) {
    const supervisor = await prisma.user.findUnique({ where: { id: supervisorId } });
    if (!supervisor) return NextResponse.json({ error: "Supervisor user not found" }, { status: 404 });
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data:  { supervisorId: supervisorId ?? null },
    select: {
      id: true, name: true,
      supervisorId: true,
      supervisor: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(user);
}
