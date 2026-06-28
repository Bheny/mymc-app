import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageDepartments } from "@/lib/org-scope";

type Params = { params: { id: string } };

const MAX_ASSISTANTS = 2;

export async function POST(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const department = await prisma.department.findUnique({ where: { id: params.id }, select: { branchId: true } });
  if (!department) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canManageDepartments(session.user, department.branchId)) {
    return NextResponse.json({ error: "You're not permitted to manage department leaders" }, { status: 403 });
  }

  const { memberId, role } = await request.json();
  if (!memberId || (role !== "HEAD" && role !== "ASSISTANT")) {
    return NextResponse.json({ error: "memberId and a valid role (HEAD or ASSISTANT) are required" }, { status: 400 });
  }

  const member = await prisma.member.findUnique({ where: { id: memberId }, select: { id: true } });
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  if (role === "HEAD") {
    await prisma.departmentLeader.deleteMany({ where: { departmentId: params.id, role: "HEAD" } });
  } else {
    const assistantCount = await prisma.departmentLeader.count({
      where: { departmentId: params.id, role: "ASSISTANT" },
    });
    if (assistantCount >= MAX_ASSISTANTS) {
      return NextResponse.json({ error: `This department already has ${MAX_ASSISTANTS} assistants` }, { status: 400 });
    }
  }

  try {
    const leader = await prisma.departmentLeader.create({
      data: { departmentId: params.id, memberId, role },
      select: { id: true, role: true, member: { select: { id: true, firstName: true, lastName: true } } },
    });
    return NextResponse.json(leader, { status: 201 });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return NextResponse.json({ error: "This member already has a role in this department" }, { status: 409 });
    }
    throw e;
  }
}
