import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageDepartments } from "@/lib/org-scope";

type Params = { params: { id: string; leaderId: string } };

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const department = await prisma.department.findUnique({ where: { id: params.id }, select: { branchId: true } });
  if (!department) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canManageDepartments(session.user, department.branchId)) {
    return NextResponse.json({ error: "You're not permitted to manage department leaders" }, { status: 403 });
  }

  await prisma.departmentLeader.deleteMany({ where: { id: params.leaderId, departmentId: params.id } });
  return NextResponse.json({ success: true });
}
