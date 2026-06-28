import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageDepartments } from "@/lib/org-scope";

type Params = { params: { id: string } };

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const department = await prisma.department.findUnique({ where: { id: params.id }, select: { branchId: true } });
  if (!department) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canManageDepartments(session.user, department.branchId)) {
    return NextResponse.json({ error: "You're not permitted to edit departments" }, { status: 403 });
  }

  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

  try {
    const updated = await prisma.department.update({ where: { id: params.id }, data: { name: name.trim() } });
    return NextResponse.json(updated);
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return NextResponse.json({ error: "A department with this name already exists" }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const department = await prisma.department.findUnique({ where: { id: params.id }, select: { branchId: true } });
  if (!department) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canManageDepartments(session.user, department.branchId)) {
    return NextResponse.json({ error: "You're not permitted to delete departments" }, { status: 403 });
  }

  await prisma.department.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
